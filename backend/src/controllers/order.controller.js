// Order controller — customer place order + admin manage
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');
const { getIO } = require('../config/socket');
const { calcDiscount } = require('../utils/promoUtils');
const { awardPointsForOrder, revokePointsForOrder, getConfig } = require('./loyalty.controller');
const { sendToAdmins } = require('./push.controller');
const { checkAndEnterDraw } = require('./luckyDraw.controller');
const { updateMissionProgress } = require('./mission.controller');

// ─── Shared include for order items ──────────────────────────────────────────
const ORDER_ITEMS_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, imageUrl: true, price: true } },
    },
  },
};

// ─── POST /api/orders ─────────────────────────────────────────────────────────
const createOrder = async (req, res) => {
  try {
    const { items, address, paymentType, notes, dealOverrides, promoCode, redeemPoints } = req.body;
    const userId = req.user.id;

    if (!items || items.length === 0) {
      return error(res, 'Cart is empty.', 400);
    }

    // Guard: max 50 items per order (prevent abuse)
    if (items.length > 50) {
      return error(res, 'Order cannot contain more than 50 items.', 400);
    }

    // Guard: each item quantity must be a positive integer ≤ 100
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        return error(res, 'Each item quantity must be between 1 and 100.', 400);
      }
      // Custom price sanity check
      if (item.customPrice !== undefined && item.customPrice !== null) {
        const cp = Number(item.customPrice);
        if (isNaN(cp) || cp < 0 || cp > 100000) {
          return error(res, 'Invalid custom item price.', 400);
        }
      }
    }

    // Separate menu product items from custom-name-only items (e.g. custom deal items)
    const menuItems   = items.filter((i) => i.productId);
    const customItems = items.filter((i) => !i.productId); // custom deal items — no DB product

    const productIds = menuItems.map((i) => i.productId);
    // De-duplicate product IDs before querying (same product can appear in
    // multiple deal items across different deal quantities)
    const uniqueProductIds = [...new Set(productIds)];
    const products = uniqueProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: uniqueProductIds }, isAvailable: true },
          include: {
            variants: { select: { id: true, price: true, isAvailable: true } },
          },
        })
      : [];

    if (products.length !== uniqueProductIds.length) {
      return error(res, 'One or more items are unavailable or no longer exist.', 400);
    }

    // Build price map — if item has variantId, use variant price; else base price
    const priceMap    = {};
    const variantMap  = {};  // variantId → price
    products.forEach((p) => {
      priceMap[p.id] = Number(p.price);
      p.variants?.forEach((v) => { variantMap[v.id] = Number(v.price); });
    });

    // Build a map of dealCartKey → { dealId, dealTitle } from dealOverrides
    // so we can tag each item with its deal info when building orderItems.
    // dealOverrides come from the frontend cart and carry cartKey + dealId.
    const dealMetaMap = {}; // cartKey → { dealId, dealTitle }
    if (dealOverrides?.length > 0) {
      for (const override of dealOverrides) {
        if (!override.dealId) continue;
        const deal = await prisma.deal.findFirst({
          where: { id: Number(override.dealId), isActive: true },
          select: { id: true, title: true },
        });
        if (deal) {
          const key = override.cartKey || String(override.dealId);
          dealMetaMap[key] = { dealId: deal.id, dealTitle: deal.title };
        }
      }
    }

    // Build order items and sum full (non-deal) prices for menu items
    let totalAmount = 0;
    const orderItems = menuItems.map((item) => {
      // Use variant price if variantId present, else base product price
      const price = item.variantId && variantMap[item.variantId] !== undefined
        ? variantMap[item.variantId]
        : priceMap[item.productId];
      totalAmount += price * item.quantity;
      const base = { productId: item.productId, quantity: item.quantity, priceAtOrder: price };
      // Attach deal info if this item belongs to a deal
      if (item.dealCartKey && dealMetaMap[item.dealCartKey]) {
        const { dealId, dealTitle } = dealMetaMap[item.dealCartKey];
        return { ...base, dealId, dealTitle, dealCartKey: item.dealCartKey };
      }
      return base;
    });

    // Also add custom item prices to total (they are part of deals)
    for (const ci of customItems) {
      if (ci.customPrice) {
        totalAmount += Number(ci.customPrice) * (ci.quantity || 1);
      }
    }

    // Apply deal price overrides:
    // For each deal in the cart, replace the sum of that deal's items
    // with the deal's actual dealPrice from the DB.
    if (dealOverrides?.length > 0) {
      for (const override of dealOverrides) {
        if (!override.dealId) continue;

        const deal = await prisma.deal.findFirst({
          where: { id: Number(override.dealId), isActive: true },
          include: {
            items: {
              include: { product: true },
            },
          },
        });

        if (deal) {
          // Sum of all deal item prices at their individual rates
          let dealItemsFullTotal = 0;
          for (const di of deal.items) {
            const qty = di.quantity;
            if (di.product) {
              dealItemsFullTotal += Number(di.product.price) * qty;
            } else if (di.customPrice) {
              dealItemsFullTotal += Number(di.customPrice) * qty;
            }
          }

          // Multiply by cart quantity (user may have added the deal more than once)
          const cartQty = override.cartQuantity || 1;
          const saving = (dealItemsFullTotal - Number(deal.dealPrice)) * cartQty;
          if (saving > 0) totalAmount -= saving;
        }
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      // ── Promo code validation (inside tx for race-condition safety) ──────
      let promoRecord = null;
      let discountAmount = 0;

      if (promoCode) {
        const upperCode = promoCode.trim().toUpperCase();
        promoRecord = await tx.promoCode.findUnique({
          where: { code: upperCode },
          include: { usages: { where: { userId }, select: { id: true } } },
        });

        if (!promoRecord || !promoRecord.isActive) {
          throw Object.assign(new Error('Invalid or expired promo code.'), { code: 'PROMO_INVALID' });
        }
        if (promoRecord.expiresAt && new Date() > new Date(promoRecord.expiresAt)) {
          throw Object.assign(new Error('This promo code has expired.'), { code: 'PROMO_INVALID' });
        }
        if (promoRecord.usageLimit !== null && promoRecord.usageCount >= promoRecord.usageLimit) {
          throw Object.assign(new Error('This promo code has reached its usage limit.'), { code: 'PROMO_INVALID' });
        }
        if (promoRecord.usages.length >= promoRecord.perUserLimit) {
          throw Object.assign(new Error('You have already used this promo code.'), { code: 'PROMO_INVALID' });
        }
        if (promoRecord.minOrderAmount && totalAmount < Number(promoRecord.minOrderAmount)) {
          throw Object.assign(
            new Error(`Minimum order amount for this code is Rs. ${Number(promoRecord.minOrderAmount).toLocaleString()}.`),
            { code: 'PROMO_INVALID' }
          );
        }

        discountAmount = calcDiscount(promoRecord, totalAmount);
        totalAmount = Math.max(0, totalAmount - discountAmount);
      }

      // ── Loyalty points redemption ─────────────────────────────────────────
      let pointsRedeemed = 0;
      let pointsDiscount = 0;

      if (redeemPoints && Number(redeemPoints) > 0) {
        const pts = Math.floor(Number(redeemPoints));
        const loyaltyCfg = await getConfig();
        const userRecord = await tx.user.findUnique({
          where: { id: userId },
          select: { pointsBalance: true },
        });

        // Silently skip if balance insufficient (order still placed)
        if (userRecord && pts <= userRecord.pointsBalance) {
          pointsRedeemed = pts;
          pointsDiscount = pts * loyaltyCfg.redeemValue;
          totalAmount = Math.max(0, totalAmount - pointsDiscount);

          // Deduct points atomically
          await tx.user.update({
            where: { id: userId },
            data: { pointsBalance: { increment: -pointsRedeemed } },
          });
        }
      }
      // ── Build deal summary note (kept for backward compatibility) ────────
      // New orders use dealId on items; notes only carries user's personal note.

      // Merge user note with deal summary (kept for backward compat with old orders)
      const finalNotes = [notes].filter(Boolean).join(' | ') || null;

      // Build complete orderItems list including custom deal items
      const allOrderItems = [...orderItems];
      for (const ci of customItems) {
        const base = {
          quantity:    ci.quantity || 1,
          priceAtOrder: Number(ci.customPrice) || 0,
          customName:  ci.customName || '',
        };
        if (ci.dealCartKey && dealMetaMap[ci.dealCartKey]) {
          const { dealId, dealTitle } = dealMetaMap[ci.dealCartKey];
          allOrderItems.push({ ...base, dealId, dealTitle, dealCartKey: ci.dealCartKey });
        } else {
          allOrderItems.push(base);
        }
      }

      const newOrder = await tx.order.create({
        data: {
          userId, totalAmount, paymentType, address,
          discountAmount: (discountAmount || 0) + pointsDiscount,
          promoCode: promoRecord ? promoRecord.code : null,
          notes: finalNotes, status: 'PENDING',
          items: { create: allOrderItems },
        },
        include: {
          ...ORDER_ITEMS_INCLUDE,
        },
      });
      await tx.payment.create({
        data: { orderId: newOrder.id, method: paymentType, status: 'PENDING' },
      });

      // Record promo usage + increment counter
      if (promoRecord) {
        await tx.promoUsage.create({
          data: {
            promoId: promoRecord.id,
            userId,
            orderId: newOrder.id,
            discount: discountAmount,
          },
        });
        await tx.promoCode.update({
          where: { id: promoRecord.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Record points redemption transaction
      if (pointsRedeemed > 0) {
        await tx.pointsTransaction.create({
          data: {
            userId,
            orderId: newOrder.id,
            type: 'REDEEM',
            points: -pointsRedeemed,
            note: `Redeemed on order #${newOrder.id} — Rs. ${pointsDiscount} discount`,
          },
        });
      }

      return { ...newOrder, pointsRedeemed, pointsDiscount };
    });

    // Emit real-time event to admin room
    try {
      getIO().to('admin').emit('new_order', {
        id:          order.id,
        totalAmount: order.totalAmount,
        status:      order.status,
        paymentType: order.paymentType,
        createdAt:   order.createdAt,
        userId,
      });
    } catch { /* socket not critical */ }

    // Send web push notification to all admin devices
    sendToAdmins({
      title: '🛎️ New Order!',
      body:  `Order #${order.id} — Rs. ${Number(order.totalAmount).toLocaleString()} (${order.paymentType === 'COD' ? 'Cash on Delivery' : 'Online'})`,
      url:   '/admin/orders',
      orderId: order.id,
    }).catch(() => {}); // non-blocking, non-critical

    return success(res, { order }, 'Order placed successfully!', 201);
  } catch (err) {
    console.error('[createOrder] ERROR:', err.message);
    console.error('[createOrder] META:', JSON.stringify(err.meta || {}));
    console.error('[createOrder] STACK:', err.stack);
    if (err.code === 'PROMO_INVALID') return error(res, err.message, 400);
    return error(res, 'Failed to place order. Please try again.', 500);
  }
};
const getMyOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        ...ORDER_ITEMS_INCLUDE,
        payment: true,
      },
    });
    return success(res, { orders });
  } catch (err) {
    return error(res, 'Failed to fetch orders.', 500);
  }
};

// ─── GET /api/orders/:id (customer - own order) ───────────────────────────────
const getMyOrder = async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
      include: {
        ...ORDER_ITEMS_INCLUDE,
        payment: true,
      },
    });
    if (!order) return error(res, 'Order not found.', 404);
    return success(res, { order });
  } catch (err) {
    return error(res, 'Failed to fetch order.', 500);
  }
};

// ─── PATCH /api/orders/:id/cancel (customer — PENDING orders only) ───────────
const cancelMyOrder = async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
    });

    if (!order) return error(res, 'Order not found.', 404);

    if (order.status !== 'PENDING') {
      return error(res, `Cannot cancel an order that is already ${order.status.toLowerCase().replace(/_/g, ' ')}.`, 400);
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'REJECTED' },
      include: {
        ...ORDER_ITEMS_INCLUDE,
        payment: true,
      },
    });

    // Mark payment as failed on cancellation
    await prisma.payment.updateMany({
      where: { orderId: order.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });

    // Notify admin of cancellation
    try {
      getIO().to('admin').emit('order_status_updated', { id: updated.id, status: updated.status });
    } catch { /* socket not critical */ }

    return success(res, { order: updated }, 'Order cancelled successfully.');
  } catch (err) {
    console.error('[cancelMyOrder]', err);
    return error(res, 'Failed to cancel order.', 500);
  }
};

// ─── GET /api/admin/orders (admin) ───────────────────────────────────────────
const getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          ...ORDER_ITEMS_INCLUDE,
          payment: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return success(res, { orders, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    return error(res, 'Failed to fetch orders.', 500);
  }
};

// ─── GET /api/admin/orders/:id (admin) ───────────────────────────────────────
const getOrderById = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, address: true } },
        ...ORDER_ITEMS_INCLUDE,
        payment: true,
      },
    });
    if (!order) return error(res, 'Order not found.', 404);
    return success(res, { order });
  } catch (err) {
    return error(res, 'Failed to fetch order.', 500);
  }
};

// ─── PATCH /api/admin/orders/:id/status (admin) ──────────────────────────────
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['APPROVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return error(res, 'Invalid status.', 400);
    }

    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { status },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, address: true } },
        ...ORDER_ITEMS_INCLUDE,
        payment: true,
      },
    });

    // If delivered and online payment, mark payment as completed
    if (status === 'DELIVERED') {
      await prisma.payment.updateMany({
        where: { orderId: order.id },
        data: { status: 'COMPLETED' },
      });
      // Award loyalty points — net amount (after all discounts)
      await prisma.$transaction(async (tx) => {
        await awardPointsForOrder(tx, order.id, order.user.id, Number(order.totalAmount));
      });
      // Auto-enter user into any active lucky draw if they qualify
      checkAndEnterDraw(order.user.id, Number(order.totalAmount));
      // Update weekly mission progress
      updateMissionProgress(order.user.id, order.id);
    }

    // Revoke loyalty points if order is rejected after delivery
    if (status === 'REJECTED') {
      await prisma.$transaction(async (tx) => {
        await revokePointsForOrder(tx, order.id, order.user.id);
      });
    }

    // Emit real-time status update to admin room + the specific customer
    try {
      const io = getIO();
      // Admin sees live status change in order list
      io.to('admin').emit('order_status_updated', { id: order.id, status: order.status });
      // Customer's personal room gets the update (they join 'user_<id>' on login)
      io.to(`user_${order.user.id}`).emit('order_status_updated', { id: order.id, status: order.status });
    } catch { /* socket not critical */ }

    return success(res, { order }, `Order status updated to ${status}.`);
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Order not found.', 404);
    return error(res, 'Failed to update order status.', 500);
  }
};

// ─── DELETE /api/orders/admin/:id (admin) ────────────────────────────────────
const deleteOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return error(res, 'Order not found.', 404);

    // Delete in correct dependency order inside a transaction
    await prisma.$transaction(async (tx) => {
      await tx.pointsTransaction.deleteMany({ where: { orderId } });
      await tx.promoUsage.deleteMany({        where: { orderId } });
      await tx.payment.deleteMany({           where: { orderId } });
      await tx.orderItem.deleteMany({         where: { orderId } });
      await tx.order.delete({                 where: { id: orderId } });
    });

    // Notify admin room
    try {
      getIO().to('admin').emit('order_deleted', { id: orderId });
    } catch { /* socket not critical */ }

    return success(res, { id: orderId }, 'Order deleted successfully.');
  } catch (err) {
    console.error('[deleteOrder]', err);
    if (err.code === 'P2025') return error(res, 'Order not found.', 404);
    return error(res, 'Failed to delete order.', 500);
  }
};

module.exports = {
  createOrder, getMyOrders, getMyOrder, cancelMyOrder,
  getAllOrders, getOrderById, updateOrderStatus, deleteOrder,
};
