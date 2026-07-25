// Loyalty Points controller — earn, redeem, config, history
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── Config keys stored in AppConfig ─────────────────────────────────────────
const CFG_EARN_MODE  = 'loyalty_earn_mode';   // 'PER_RUPEE' | 'FIXED'
const CFG_EARN_VALUE = 'loyalty_earn_value';  // integer
const CFG_REDEEM_VAL = 'loyalty_redeem_value'; // Rs per point (integer)

// Default values if not configured yet
const DEFAULTS = { earnMode: 'PER_RUPEE', earnValue: 1, redeemValue: 1 };

// ── helpers ───────────────────────────────────────────────────────────────────
const getConfig = async () => {
  const rows = await prisma.appConfig.findMany({
    where: { key: { in: [CFG_EARN_MODE, CFG_EARN_VALUE, CFG_REDEEM_VAL] } },
  });
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return {
    earnMode:    map[CFG_EARN_MODE]  || DEFAULTS.earnMode,
    earnValue:   parseInt(map[CFG_EARN_VALUE]  || DEFAULTS.earnValue, 10),
    redeemValue: parseInt(map[CFG_REDEEM_VAL] || DEFAULTS.redeemValue, 10),
  };
};

// Calculate how many points to award for a given order amount
const calcEarnPoints = (cfg, orderAmount) => {
  if (cfg.earnMode === 'FIXED') return cfg.earnValue;
  // PER_RUPEE: award earnValue points for every 100 Rs spent, floored.
  // e.g. earnValue=1 → 1 point per 100 Rs → Rs. 350 = 3 points
  // e.g. earnValue=2 → 2 points per 100 Rs → Rs. 350 = 6 points
  return Math.floor(orderAmount / 100) * cfg.earnValue;
};

// ─── GET /api/loyalty/balance ─────────────────────────────────────────────────
const getBalance = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { pointsBalance: true },
    });
    const cfg = await getConfig();
    return success(res, {
      pointsBalance: user.pointsBalance,
      redeemValue:   cfg.redeemValue,
      monetaryValue: user.pointsBalance * cfg.redeemValue,
    });
  } catch (err) {
    console.error('[getBalance]', err);
    return error(res, 'Failed to fetch loyalty balance.', 500);
  }
};

// ─── GET /api/loyalty/history ─────────────────────────────────────────────────
const getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [txs, total] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        select: { id: true, type: true, points: true, orderId: true, note: true, createdAt: true },
      }),
      prisma.pointsTransaction.count({ where: { userId: req.user.id } }),
    ]);

    return success(res, { transactions: txs, total, page: Number(page) });
  } catch (err) {
    console.error('[getHistory]', err);
    return error(res, 'Failed to fetch loyalty history.', 500);
  }
};

// ─── GET /api/admin/loyalty/config ───────────────────────────────────────────
const getAdminConfig = async (req, res) => {
  try {
    const cfg = await getConfig();
    return success(res, { config: cfg });
  } catch (err) {
    return error(res, 'Failed to fetch loyalty config.', 500);
  }
};

// ─── PATCH /api/admin/loyalty/config ─────────────────────────────────────────
const updateAdminConfig = async (req, res) => {
  try {
    const { earnMode, earnValue, redeemValue } = req.body;

    // Validate
    if (earnMode !== undefined && !['PER_RUPEE', 'FIXED'].includes(earnMode)) {
      return error(res, 'earnMode must be PER_RUPEE or FIXED.', 400);
    }
    if (earnValue !== undefined) {
      const v = Number(earnValue);
      if (!Number.isInteger(v) || v < 1) return error(res, 'earnValue must be a positive integer.', 400);
    }
    if (redeemValue !== undefined) {
      const v = Number(redeemValue);
      if (!Number.isInteger(v) || v < 1) return error(res, 'redeemValue must be a positive integer.', 400);
    }

    // Upsert each provided value
    const ops = [];
    if (earnMode !== undefined) {
      ops.push(prisma.appConfig.upsert({
        where: { key: CFG_EARN_MODE },
        create: { key: CFG_EARN_MODE, value: earnMode },
        update: { value: earnMode },
      }));
    }
    if (earnValue !== undefined) {
      ops.push(prisma.appConfig.upsert({
        where: { key: CFG_EARN_VALUE },
        create: { key: CFG_EARN_VALUE, value: String(earnValue) },
        update: { value: String(earnValue) },
      }));
    }
    if (redeemValue !== undefined) {
      ops.push(prisma.appConfig.upsert({
        where: { key: CFG_REDEEM_VAL },
        create: { key: CFG_REDEEM_VAL, value: String(redeemValue) },
        update: { value: String(redeemValue) },
      }));
    }

    await Promise.all(ops);
    const cfg = await getConfig();
    return success(res, { config: cfg }, 'Loyalty config updated.');
  } catch (err) {
    console.error('[updateAdminConfig]', err);
    return error(res, 'Failed to update loyalty config.', 500);
  }
};

// ─── GET /api/admin/loyalty/customers ────────────────────────────────────────
const getCustomersWithPoints = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { role: 'CUSTOMER' };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { pointsBalance: 'desc' },
        skip,
        take: Number(limit),
        select: { id: true, name: true, phone: true, email: true, pointsBalance: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    return success(res, { customers, total, page: Number(page) });
  } catch (err) {
    return error(res, 'Failed to fetch customers.', 500);
  }
};

// ─── GET /api/admin/loyalty/customers/:id/history ────────────────────────────
const getCustomerHistory = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const [txs, user] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, type: true, points: true, orderId: true, note: true, createdAt: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, pointsBalance: true },
      }),
    ]);
    if (!user) return error(res, 'Customer not found.', 404);
    return success(res, { user, transactions: txs });
  } catch (err) {
    return error(res, 'Failed to fetch customer history.', 500);
  }
};

// ─── POST /api/admin/loyalty/customers/:id/adjust ────────────────────────────
const adjustPoints = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { points, note } = req.body;
    const pts = Number(points);

    if (!Number.isInteger(pts) || pts === 0) {
      return error(res, 'points must be a non-zero integer.', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } });
    if (!user) return error(res, 'Customer not found.', 404);

    if (user.pointsBalance + pts < 0) {
      return error(res, `Cannot deduct ${Math.abs(pts)} points — customer only has ${user.pointsBalance}.`, 400);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { pointsBalance: { increment: pts } },
      }),
      prisma.pointsTransaction.create({
        data: { userId, type: 'MANUAL', points: pts, note: note || (pts > 0 ? 'Admin credit' : 'Admin deduction') },
      }),
    ]);

    const updated = await prisma.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } });
    return success(res, { pointsBalance: updated.pointsBalance }, `Points ${pts > 0 ? 'added' : 'deducted'} successfully.`);
  } catch (err) {
    console.error('[adjustPoints]', err);
    return error(res, 'Failed to adjust points.', 500);
  }
};

// ─── Exported utility: award points on DELIVERED order ───────────────────────
// Called from order.controller.js — not an HTTP handler
const awardPointsForOrder = async (tx, orderId, userId, netAmount) => {
  // Idempotency: don't award twice for same order
  const existing = await tx.pointsTransaction.findFirst({
    where: { orderId, type: 'EARN' },
  });
  if (existing) return;

  const cfg = await getConfig();
  const pts = calcEarnPoints(cfg, netAmount);

  await tx.pointsTransaction.create({
    data: { userId, orderId, type: 'EARN', points: pts, note: `Earned on order #${orderId}` },
  });
  await tx.user.update({
    where: { id: userId },
    data: { pointsBalance: { increment: pts } },
  });
};

// ─── Exported utility: revoke points if order is rejected after delivery ─────
const revokePointsForOrder = async (tx, orderId, userId) => {
  const earnTx = await tx.pointsTransaction.findFirst({
    where: { orderId, type: 'EARN' },
  });
  if (!earnTx) return;

  // Already revoked?
  const alreadyRevoked = await tx.pointsTransaction.findFirst({
    where: { orderId, type: 'REVOKE' },
  });
  if (alreadyRevoked) return;

  await tx.pointsTransaction.create({
    data: { userId, orderId, type: 'REVOKE', points: -earnTx.points, note: `Revoked — order #${orderId} rejected` },
  });
  await tx.user.update({
    where: { id: userId },
    data: { pointsBalance: { increment: -earnTx.points } },
  });
};

module.exports = {
  getBalance, getHistory,
  getAdminConfig, updateAdminConfig,
  getCustomersWithPoints, getCustomerHistory, adjustPoints,
  awardPointsForOrder, revokePointsForOrder, getConfig,
};
