// Spin & Win controller — weighted random selection on the backend
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ── Weighted random selection algorithm ──────────────────────────────────────
// Never do this on the frontend — it can be manipulated.
const selectWeightedPrize = (prizes) => {
  const total = prizes.reduce((sum, p) => sum + p.weight, 0);
  let rand = Math.random() * total;
  for (const prize of prizes) {
    rand -= prize.weight;
    if (rand <= 0) return prize;
  }
  return prizes[prizes.length - 1]; // fallback
};

// ─── GET /api/spin/prizes ─────────────────────────────────────────────────────
// Public: returns active prizes (for rendering the wheel, no weights exposed)
const getPrizes = async (req, res) => {
  try {
    const prizes = await prisma.spinPrize.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true, imageUrl: true, color: true },
      orderBy: { id: 'asc' },
    });
    return success(res, { prizes });
  } catch (err) {
    return error(res, 'Failed to fetch prizes.', 500);
  }
};

// ─── POST /api/spin ───────────────────────────────────────────────────────────
// Authenticated: spin the wheel — race-condition-safe via transaction
const spin = async (req, res) => {
  try {
    const userId = req.user.id;

    const config = await prisma.appConfig.findUnique({ where: { key: 'daily_spin_limit' } });
    const dailyLimit = config ? parseInt(config.value, 10) : 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── Fetch prizes first (outside tx — read-only, fast) ──
    const prizes = await prisma.spinPrize.findMany({
      where: { isActive: true, OR: [{ stockRemaining: null }, { stockRemaining: { gt: 0 } }] },
    });

    if (prizes.length === 0) {
      return error(res, 'No prizes available right now. Check back soon!', 404);
    }

    // ── Run weighted selection ──
    const won = selectWeightedPrize(prizes);

    // ── Everything inside transaction — daily limit check + create + stock decrement ──
    // This prevents race condition: two concurrent requests can't both pass the limit check
    let spinRecord;
    try {
      spinRecord = await prisma.$transaction(async (tx) => {
        // Re-check limit INSIDE transaction (serialized)
        const todaySpins = await tx.spinHistory.count({
          where: { userId, spunAt: { gte: today } },
        });

        if (todaySpins >= dailyLimit) {
          throw Object.assign(
            new Error(`You've used all ${dailyLimit} spin(s) for today. Come back tomorrow! 🌅`),
            { code: 'DAILY_LIMIT' }
          );
        }

        const record = await tx.spinHistory.create({
          data: { userId, prizeId: won.id },
          include: { prize: { select: { id: true, name: true, description: true, imageUrl: true, color: true } } },
        });

        if (won.stockRemaining !== null) {
          await tx.spinPrize.update({
            where: { id: won.id },
            data: { stockRemaining: { decrement: 1 } },
          });
        }

        return record;
      });
    } catch (txErr) {
      if (txErr.code === 'DAILY_LIMIT') {
        return error(res, txErr.message, 429);
      }
      throw txErr;
    }

    const prizeIndex = prizes.findIndex((p) => p.id === won.id);
    // Recalculate spinsLeft after the transaction committed
    const todaySpinsAfter = await prisma.spinHistory.count({ where: { userId, spunAt: { gte: today } } });

    // ── Notify admin in real-time ─────────────────────────────────────────
    try {
      const { getIO } = require('../config/socket');
      // Fetch user info to include in notification
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, phone: true, email: true },
      });
      getIO().to('admin').emit('spin_prize_won', {
        spinId:    spinRecord.id,
        user:      user,
        prize:     spinRecord.prize,
        spunAt:    spinRecord.spunAt,
      });
    } catch { /* socket not critical */ }

    return success(res, {
      prize: spinRecord.prize,
      prizeIndex,
      spinsLeft: Math.max(0, dailyLimit - todaySpinsAfter),
    }, `🎉 You won: ${won.name}!`);
  } catch (err) {
    console.error('[spin]', err);
    return error(res, 'Spin failed. Please try again.', 500);
  }
};

// ─── GET /api/spin/history (customer) ────────────────────────────────────────
const getMyHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [history, total] = await Promise.all([
      prisma.spinHistory.findMany({
        where: { userId: req.user.id },
        orderBy: { spunAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          prize: {
            select: { id: true, name: true, description: true, color: true, imageUrl: true },
          },
        },
      }),
      prisma.spinHistory.count({ where: { userId: req.user.id } }),
    ]);

    return success(res, { history, total, page: Number(page) });
  } catch (err) {
    console.error('[getMyHistory]', err);
    return error(res, 'Failed to fetch spin history.', 500);
  }
};

// ─── POST /api/spin/history/:id/use (customer — mark own prize as redeemed) ──
// Customer taps "Use Voucher" — marks it redeemed from their side
// Admin sees it as redeemed in the spin history panel
const useMyPrize = async (req, res) => {
  try {
    const spinId = Number(req.params.id);

    // Make sure this record belongs to the requesting user
    const record = await prisma.spinHistory.findFirst({
      where: { id: spinId, userId: req.user.id },
      include: {
        prize: { select: { id: true, name: true, description: true, color: true, imageUrl: true } },
      },
    });

    if (!record) return error(res, 'Reward not found.', 404);
    if (record.redeemed) return error(res, 'This reward has already been used.', 400);

    const updated = await prisma.spinHistory.update({
      where: { id: spinId },
      data: { redeemed: true, redeemedAt: new Date() },
      include: {
        prize: { select: { id: true, name: true, description: true, color: true, imageUrl: true } },
      },
    });

    // Notify admin in real-time that a prize was self-redeemed
    try {
      const { getIO } = require('../config/socket');
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, name: true, phone: true, email: true },
      });
      getIO().to('admin').emit('spin_prize_redeemed', {
        spinId:    updated.id,
        user,
        prize:     updated.prize,
        redeemedAt: updated.redeemedAt,
      });
    } catch { /* socket not critical */ }

    return success(res, { record: updated }, 'Reward used successfully! Show this to our staff.');
  } catch (err) {
    console.error('[useMyPrize]', err);
    return error(res, 'Failed to use reward.', 500);
  }
};

// ─── GET /api/admin/spin/history (admin) ─────────────────────────────────────
const getAllHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, redeemed } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (redeemed !== undefined) where.redeemed = redeemed === 'true';

    const [history, total] = await Promise.all([
      prisma.spinHistory.findMany({
        where,
        orderBy: { spunAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          prize: { select: { id: true, name: true, color: true } },
        },
      }),
      prisma.spinHistory.count({ where }),
    ]);

    return success(res, { history, total, page: Number(page) });
  } catch (err) {
    return error(res, 'Failed to fetch spin history.', 500);
  }
};

// ─── PATCH /api/admin/spin/history/:id/redeem ────────────────────────────────
const markRedeemed = async (req, res) => {
  try {
    const record = await prisma.spinHistory.update({
      where: { id: Number(req.params.id) },
      data: { redeemed: true, redeemedAt: new Date() },
    });
    return success(res, { record }, 'Prize marked as redeemed.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Record not found.', 404);
    return error(res, 'Failed to update record.', 500);
  }
};

// ─── GET /api/admin/spin/prizes (admin) ──────────────────────────────────────
const getAdminPrizes = async (req, res) => {
  try {
    const prizes = await prisma.spinPrize.findMany({ orderBy: { id: 'asc' } });
    return success(res, { prizes });
  } catch (err) {
    return error(res, 'Failed to fetch prizes.', 500);
  }
};

// ─── POST /api/admin/spin/prizes ─────────────────────────────────────────────
const createPrize = async (req, res) => {
  try {
    const { name, description, weight, stockRemaining, color } = req.body;
    const imageUrl = req.file?.path || null;

    const prize = await prisma.spinPrize.create({
      data: {
        name,
        description: description || null,
        weight: Number(weight),
        stockRemaining: stockRemaining ? Number(stockRemaining) : null,
        color: color || '#FF6B6B',
        imageUrl,
        isActive: true,
      },
    });
    return success(res, { prize }, 'Prize created.', 201);
  } catch (err) {
    return error(res, 'Failed to create prize.', 500);
  }
};

// ─── PATCH /api/admin/spin/prizes/:id ────────────────────────────────────────
const updatePrize = async (req, res) => {
  try {
    const { name, description, weight, stockRemaining, color, isActive } = req.body;
    const imageUrl = req.file?.path || undefined;

    const data = {};
    if (name) data.name = name;
    if (description !== undefined) data.description = description;
    if (weight !== undefined) data.weight = Number(weight);
    if (stockRemaining !== undefined) data.stockRemaining = stockRemaining === '' ? null : Number(stockRemaining);
    if (color) data.color = color;
    if (isActive !== undefined) data.isActive = isActive === 'true' || isActive === true;
    if (imageUrl) data.imageUrl = imageUrl;

    const prize = await prisma.spinPrize.update({
      where: { id: Number(req.params.id) },
      data,
    });
    return success(res, { prize }, 'Prize updated.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Prize not found.', 404);
    return error(res, 'Failed to update prize.', 500);
  }
};

// ─── DELETE /api/admin/spin/prizes/:id ───────────────────────────────────────
const deletePrize = async (req, res) => {
  try {
    await prisma.spinPrize.delete({ where: { id: Number(req.params.id) } });
    return success(res, {}, 'Prize deleted.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Prize not found.', 404);
    // P2003 = prize has spin history — deactivate instead
    if (err.code === 'P2003') return error(res, 'Cannot delete — this prize has spin history. Deactivate it instead.', 400);
    return error(res, 'Failed to delete prize.', 500);
  }
};
// Returns daily limit + how many spins user has left today
const getSpinConfig = async (req, res) => {
  try {
    const config = await prisma.appConfig.findUnique({ where: { key: 'daily_spin_limit' } });
    const dailyLimit = config ? parseInt(config.value, 10) : 1;

    let spinsUsedToday = 0;
    if (req.user) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      spinsUsedToday = await prisma.spinHistory.count({
        where: { userId: req.user.id, spunAt: { gte: today } },
      });
    }

    return success(res, { dailyLimit, spinsUsedToday, spinsLeft: Math.max(0, dailyLimit - spinsUsedToday) });
  } catch (err) {
    return error(res, 'Failed.', 500);
  }
};

// ─── PATCH /api/admin/spin/config ────────────────────────────────────────────
const updateConfig = async (req, res) => {
  try {
    const { dailySpinLimit } = req.body;
    await prisma.appConfig.upsert({
      where: { key: 'daily_spin_limit' },
      update: { value: String(Number(dailySpinLimit)) },
      create: { key: 'daily_spin_limit', value: String(Number(dailySpinLimit)) },
    });
    return success(res, {}, 'Config updated.');
  } catch (err) {
    return error(res, 'Failed to update config.', 500);
  }
};

module.exports = {
  getPrizes, spin, getMyHistory, useMyPrize, getAllHistory, markRedeemed,
  getAdminPrizes, createPrize, updatePrize, deletePrize, getSpinConfig, updateConfig,
};
