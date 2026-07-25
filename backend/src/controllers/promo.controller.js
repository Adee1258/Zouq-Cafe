// PromoCode controller — admin management + customer validation
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');
const { getIO } = require('../config/socket');
const { calcDiscount } = require('../utils/promoUtils');

// ─── helpers ──────────────────────────────────────────────────────────────────
// Given a promo with restrictions and the cart items, compute the
// sub-total that the promo actually applies to.
// Returns { applicableTotal, isRestricted }
const getApplicableTotal = (promo, cartItems = []) => {
  const hasProductRestriction  = promo.applicableProductIds?.length > 0;
  const hasCategoryRestriction = promo.applicableCategoryIds?.length > 0;

  if (!hasProductRestriction && !hasCategoryRestriction) {
    // No restriction — applies to whole order
    return { applicableTotal: null, isRestricted: false };
  }

  // Filter cart items that match the restriction
  const matched = cartItems.filter((item) => {
    if (hasProductRestriction && promo.applicableProductIds.includes(item.productId)) return true;
    if (hasCategoryRestriction && promo.applicableCategoryIds.includes(item.categoryId)) return true;
    return false;
  });

  const applicableTotal = matched.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
  return { applicableTotal, isRestricted: true, matchedItems: matched };
};

// ─── POST /api/promo/validate ─────────────────────────────────────────────────
// Customer applies promo code at checkout — validates and returns discount info
const validatePromo = async (req, res) => {
  try {
    const { code, orderTotal, cartItems } = req.body;
    const userId = req.user.id;

    if (!code || !code.trim()) return error(res, 'Promo code is required.', 400);
    if (!orderTotal || Number(orderTotal) <= 0) return error(res, 'Invalid order total.', 400);

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        usages: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!promo || !promo.isActive) {
      return error(res, 'Invalid or expired promo code.', 404);
    }

    // Check expiry
    if (promo.expiresAt && new Date() > new Date(promo.expiresAt)) {
      return error(res, 'This promo code has expired.', 400);
    }

    // Check global usage limit
    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      return error(res, 'This promo code has reached its usage limit.', 400);
    }

    // Check per-user limit
    if (promo.usages.length >= promo.perUserLimit) {
      return error(
        res,
        `You have already used this promo code${promo.perUserLimit > 1 ? ` ${promo.perUserLimit} times` : ''}.`,
        400
      );
    }

    const total = Number(orderTotal);

    // Check minimum order amount
    if (promo.minOrderAmount && total < Number(promo.minOrderAmount)) {
      return error(
        res,
        `Minimum order amount for this code is Rs. ${Number(promo.minOrderAmount).toLocaleString()}.`,
        400
      );
    }

    // ── Item restriction check ─────────────────────────────────────────────
    const { applicableTotal, isRestricted, matchedItems } = getApplicableTotal(promo, cartItems || []);

    if (isRestricted && applicableTotal === 0) {
      // Build a friendly message
      const hasProductRestriction  = promo.applicableProductIds?.length > 0;
      const hasCategoryRestriction = promo.applicableCategoryIds?.length > 0;
      let hint = 'your cart items';
      if (hasProductRestriction || hasCategoryRestriction) {
        hint = 'the specific items this code applies to';
      }
      return error(res, `This promo code is not applicable to ${hint}.`, 400);
    }

    // Use applicableTotal for discount calc if restricted, else full order total
    const baseForDiscount = isRestricted ? applicableTotal : total;
    const discountAmount  = calcDiscount(promo, baseForDiscount);
    const finalTotal      = total - discountAmount;

    return success(res, {
      valid:          true,
      code:           promo.code,
      description:    promo.description,
      discountType:   promo.discountType,
      discountValue:  Number(promo.discountValue),
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalTotal:     Math.round(finalTotal * 100) / 100,
      isRestricted,
      applicableTotal: isRestricted ? Math.round(applicableTotal * 100) / 100 : null,
    }, `Promo code applied! You save Rs. ${Math.round(discountAmount).toLocaleString()}`);
  } catch (err) {
    console.error('[validatePromo]', err);
    return error(res, 'Failed to validate promo code.', 500);
  }
};

// ─── GET /api/admin/promos ────────────────────────────────────────────────────
const getAllPromos = async (req, res) => {
  try {
    const { active } = req.query;
    const where = {};
    if (active === 'true')  where.isActive = true;
    if (active === 'false') where.isActive = false;

    const promos = await prisma.promoCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { usages: true } } },
    });

    return success(res, { promos });
  } catch (err) {
    console.error('[getAllPromos]', err);
    return error(res, 'Failed to fetch promo codes.', 500);
  }
};

// ─── POST /api/admin/promos ───────────────────────────────────────────────────
const createPromo = async (req, res) => {
  try {
    const {
      code, description, discountType, discountValue,
      minOrderAmount, maxDiscount, usageLimit, perUserLimit, expiresAt,
      applicableProductIds, applicableCategoryIds,
    } = req.body;

    if (!code || !code.trim()) return error(res, 'Code is required.', 400);
    if (!['PERCENTAGE', 'FLAT'].includes(discountType)) return error(res, 'Invalid discount type.', 400);
    if (!discountValue || Number(discountValue) <= 0) return error(res, 'Discount value must be positive.', 400);
    if (discountType === 'PERCENTAGE' && Number(discountValue) > 100) {
      return error(res, 'Percentage discount cannot exceed 100%.', 400);
    }

    const upperCode = code.trim().toUpperCase();
    const existing = await prisma.promoCode.findUnique({ where: { code: upperCode } });
    if (existing) return error(res, 'A promo code with this name already exists.', 409);

    const promo = await prisma.promoCode.create({
      data: {
        code:                  upperCode,
        description:           description?.trim() || null,
        discountType,
        discountValue:         Number(discountValue),
        minOrderAmount:        minOrderAmount ? Number(minOrderAmount) : null,
        maxDiscount:           maxDiscount    ? Number(maxDiscount)    : null,
        usageLimit:            usageLimit     ? Number(usageLimit)     : null,
        perUserLimit:          perUserLimit   ? Number(perUserLimit)   : 1,
        expiresAt:             expiresAt      ? new Date(expiresAt)    : null,
        isActive:              true,
        applicableProductIds:  Array.isArray(applicableProductIds)  ? applicableProductIds.map(Number)  : [],
        applicableCategoryIds: Array.isArray(applicableCategoryIds) ? applicableCategoryIds.map(Number) : [],
      },
    });

    try {
      getIO().to('admin').emit('promo_created', { id: promo.id, code: promo.code });
    } catch { /* not critical */ }

    return success(res, { promo }, 'Promo code created.', 201);
  } catch (err) {
    console.error('[createPromo]', err);
    if (err.code === 'P2002') return error(res, 'Promo code already exists.', 409);
    return error(res, 'Failed to create promo code.', 500);
  }
};

// ─── PATCH /api/admin/promos/:id ──────────────────────────────────────────────
const updatePromo = async (req, res) => {
  try {
    const {
      description, discountType, discountValue,
      minOrderAmount, maxDiscount, usageLimit, perUserLimit,
      expiresAt, isActive, applicableProductIds, applicableCategoryIds,
    } = req.body;

    const data = {};
    if (description    !== undefined) data.description    = description?.trim() || null;
    if (discountType   !== undefined) data.discountType   = discountType;
    if (discountValue  !== undefined) data.discountValue  = Number(discountValue);
    if (minOrderAmount !== undefined) data.minOrderAmount = minOrderAmount ? Number(minOrderAmount) : null;
    if (maxDiscount    !== undefined) data.maxDiscount    = maxDiscount    ? Number(maxDiscount)    : null;
    if (usageLimit     !== undefined) data.usageLimit     = usageLimit     ? Number(usageLimit)     : null;
    if (perUserLimit   !== undefined) data.perUserLimit   = Number(perUserLimit);
    if (expiresAt      !== undefined) data.expiresAt      = expiresAt ? new Date(expiresAt) : null;
    if (isActive       !== undefined) data.isActive       = Boolean(isActive);
    if (applicableProductIds  !== undefined) data.applicableProductIds  = Array.isArray(applicableProductIds)  ? applicableProductIds.map(Number)  : [];
    if (applicableCategoryIds !== undefined) data.applicableCategoryIds = Array.isArray(applicableCategoryIds) ? applicableCategoryIds.map(Number) : [];

    const promo = await prisma.promoCode.update({
      where: { id: Number(req.params.id) },
      data,
    });

    return success(res, { promo }, 'Promo code updated.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Promo code not found.', 404);
    return error(res, 'Failed to update promo code.', 500);
  }
};

// ─── DELETE /api/admin/promos/:id ─────────────────────────────────────────────
const deletePromo = async (req, res) => {
  try {
    await prisma.promoCode.delete({ where: { id: Number(req.params.id) } });
    return success(res, {}, 'Promo code deleted.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Promo code not found.', 404);
    if (err.code === 'P2003') return error(res, 'Cannot delete — this code has usage history. Deactivate it instead.', 400);
    return error(res, 'Failed to delete promo code.', 500);
  }
};

// ─── GET /api/admin/promos/:id/usages ────────────────────────────────────────
const getPromoUsages = async (req, res) => {
  try {
    const usages = await prisma.promoUsage.findMany({
      where: { promoId: Number(req.params.id) },
      orderBy: { usedAt: 'desc' },
      take: 50,
      include: {
        user:  { select: { id: true, name: true, phone: true, email: true } },
        order: { select: { id: true, totalAmount: true, status: true, createdAt: true } },
      },
    });
    return success(res, { usages });
  } catch (err) {
    return error(res, 'Failed to fetch usages.', 500);
  }
};

module.exports = { validatePromo, getAllPromos, createPromo, updatePromo, deletePromo, getPromoUsages };
