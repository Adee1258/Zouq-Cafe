// Order controller — customer place order + admin manage
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');
const { getIO } = require('../config/socket');

// ─── POST /api/orders ─────────────────────────────────────────────────────────
const createOrder = async (req, res) => {
  try {
    const { items, address, paymentType, notes, dealOverrides } = req.body;
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
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, isAvailable: true },
        })
      : [];

    if (products.length !== productIds.length) {
      return error(res, 'One or more items are unavailable or no longer exist.', 400);
    }

    const priceMap = {};
    products.forEach((p) => { priceMap[p.id] = Number(p.price); });

    // Build order items and sum full (non-deal) prices for menu items
    let totalAmount = 0;
    const orderItems = menuItems.map((item) => {
      const price = priceMap[item.productId];
      totalAmount += price * item.quantity;
      return { productId: item.productId, quantity: item.quantity, priceAtOrder: price };
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
      // Build a deal summary note to preserve custom items info
      let dealNote = '';
      if (dealOverrides?.length > 0) {
        const dealNotes = [];
        for (const override of dealOverrides) {
          if (!override.dealId) continue;
          const deal = await tx.deal.findUnique({
            where: { id: Number(override.dealId) },
            include: { items: { include: { product: true } } },
          });
          if (deal) {
            const allItemNames = deal.items.map((di) => {
              const name = di.product ? di.product.name : di.customName;
              return `${name} ×${di.quantity}`;
            });
            dealNotes.push(`[Deal: ${deal.title}] ${allItemNames.join(', ')}`);
          }
        }
        if (dealNotes.length > 0) {
          dealNote = dealNotes.join(' | ');
        }
      }

      // Merge user note with deal summary
      const finalNotes = [notes, dealNote].filter(Boolean).join(' | ') || null;

      const newOrder = await tx.order.create({
        data: {
          userId, totalAmount, paymentType, address,
          notes: finalNotes, status: 'PENDING',
          items: { create: orderItems },
        },
        include: {
          items: {
            include: { product: { select: { id: true, name: true, imageUrl: true } } },
          },
        },
      });
      await tx.payment.create({
        data: { orderId: newOrder.id, method: paymentType, status: 'PENDING' },
      });
      return newOrder;
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

    return success(res, { order }, 'Order placed successfully!', 201);
  } catch (err) {
    console.error('[createOrder]', err);
    return error(res, 'Failed to place order. Please try again.', 500);
  }
};
const getMyOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, imageUrl: true } } },
        },
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
        items: {
          include: { product: { select: { id: true, name: true, imageUrl: true, price: true } } },
        },
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
        items: {
          include: { product: { select: { id: true, name: true, imageUrl: true } } },
        },
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
          items: {
            include: { product: { select: { id: true, name: true } } },
          },
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
        items: {
          include: { product: { select: { id: true, name: true, imageUrl: true, price: true } } },
        },
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
        items: {
          include: { product: { select: { id: true, name: true, imageUrl: true, price: true } } },
        },
        payment: true,
      },
    });

    // If delivered and online payment, mark payment as completed
    if (status === 'DELIVERED') {
      await prisma.payment.updateMany({
        where: { orderId: order.id },
        data: { status: 'COMPLETED' },
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

module.exports = {
  createOrder, getMyOrders, getMyOrder, cancelMyOrder,
  getAllOrders, getOrderById, updateOrderStatus,
};
