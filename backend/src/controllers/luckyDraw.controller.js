/**
 * Lucky Draw Controller
 *
 * Admin:
 *   POST   /api/lucky-draw          — create a new draw (multipart: banner image)
 *   GET    /api/lucky-draw          — list all draws
 *   GET    /api/lucky-draw/:id      — single draw detail + entries
 *   PATCH  /api/lucky-draw/:id      — update draw (multipart: banner image optional)
 *   DELETE /api/lucky-draw/:id      — delete draw
 *   POST   /api/lucky-draw/:id/draw — pick random winner from qualified entries
 *
 * Customer:
 *   GET    /api/lucky-draw/active   — active draw info + caller's entry status
 *   GET    /api/lucky-draw/winners  — public winners list (all past draws)
 *
 * Auto-entry hook (called internally from order.controller when order → DELIVERED):
 *   checkAndEnterDraw(userId, orderTotal)
 */

const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── Internal helper: called from order controller ────────────────────────────
/**
 * After an order is marked DELIVERED, we check every active draw.
 * If the user's cumulative spend (in that draw's date range) meets
 * minSpendAmount, they get an entry (upsert — one entry per user per draw).
 */
const checkAndEnterDraw = async (userId, deliveredOrderTotal) => {
  try {
    const now = new Date();

    // Find all active draws that are currently running
    const activeDraws = await prisma.luckyDraw.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt:   { gte: now },
        drawnAt:  null, // winner not yet picked
      },
    });

    for (const draw of activeDraws) {
      // Sum all DELIVERED orders for this user within the draw's date range
      const agg = await prisma.order.aggregate({
        where: {
          userId,
          status:    'DELIVERED',
          createdAt: { gte: draw.startsAt, lte: draw.endsAt },
        },
        _sum: { totalAmount: true },
      });

      const totalSpent = Number(agg._sum.totalAmount || 0);

      if (totalSpent >= Number(draw.minSpendAmount)) {
        // Upsert — won't duplicate if already entered
        await prisma.luckyDrawEntry.upsert({
          where:  { drawId_userId: { drawId: draw.id, userId } },
          update: { totalSpent },      // update running total
          create: { drawId: draw.id, userId, totalSpent },
        });
      }
    }
  } catch (err) {
    // Non-critical — log and continue
    console.error('[checkAndEnterDraw]', err.message);
  }
};

// ─── ADMIN: POST /api/lucky-draw/admin ───────────────────────────────────────
const createDraw = async (req, res) => {
  try {
    const { title, minSpendAmount, startsAt, endsAt, description } = req.body;
    const bannerUrl = req.file?.path || null;

    if (!minSpendAmount || !startsAt || !endsAt) {
      return error(res, 'minSpendAmount, startsAt and endsAt are required.', 400);
    }
    if (Number(minSpendAmount) <= 0) {
      return error(res, 'Minimum spend must be greater than 0.', 400);
    }
    const start = new Date(startsAt);
    const end   = new Date(endsAt);
    if (isNaN(start) || isNaN(end)) return error(res, 'Invalid dates.', 400);
    if (end <= start)               return error(res, 'End date must be after start date.', 400);

    const draw = await prisma.luckyDraw.create({
      data: {
        title:          title?.trim() || 'Lucky Draw',
        description:    description?.trim() || null,
        bannerUrl,
        minSpendAmount: Number(minSpendAmount),
        startsAt:       start,
        endsAt:         end,
        isActive:       true,
      },
    });

    return success(res, { draw }, 'Lucky draw created.', 201);
  } catch (err) {
    console.error('[createDraw]', err);
    return error(res, 'Failed to create draw.', 500);
  }
};

// ─── ADMIN: GET /api/lucky-draw/admin ────────────────────────────────────────
const listDraws = async (req, res) => {
  try {
    const draws = await prisma.luckyDraw.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count:  { select: { entries: true, winners: true } },
        winners: {
          include: { user: { select: { id: true, name: true, phone: true, email: true } } },
        },
      },
    });
    return success(res, { draws });
  } catch (err) {
    return error(res, 'Failed to fetch draws.', 500);
  }
};

// ─── ADMIN: GET /api/lucky-draw/admin/:id ────────────────────────────────────
const getDraw = async (req, res) => {
  try {
    const draw = await prisma.luckyDraw.findUnique({
      where:   { id: Number(req.params.id) },
      include: {
        entries: {
          orderBy: { qualifiedAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
        winners: {
          include: { user: { select: { id: true, name: true, phone: true, email: true } } },
        },
      },
    });
    if (!draw) return error(res, 'Draw not found.', 404);
    return success(res, { draw });
  } catch (err) {
    return error(res, 'Failed to fetch draw.', 500);
  }
};

// ─── ADMIN: PATCH /api/lucky-draw/admin/:id ──────────────────────────────────
const updateDraw = async (req, res) => {
  try {
    const { title, minSpendAmount, endsAt, isActive, description } = req.body;
    const newBannerUrl = req.file?.path || undefined;

    const existing = await prisma.luckyDraw.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!existing) return error(res, 'Draw not found.', 404);

    const data = {};
    if (title             !== undefined) data.title          = title.trim();
    if (description       !== undefined) data.description    = description?.trim() || null;
    if (newBannerUrl      !== undefined) data.bannerUrl      = newBannerUrl;
    if (minSpendAmount    !== undefined) data.minSpendAmount = Number(minSpendAmount);
    if (isActive          !== undefined) data.isActive       = isActive === 'true' || isActive === true;
    if (endsAt            !== undefined) {
      const end = new Date(endsAt);
      if (isNaN(end)) return error(res, 'Invalid end date.', 400);
      if (end <= existing.startsAt) return error(res, 'End date must be after start date.', 400);
      data.endsAt = end;
    }

    const draw = await prisma.luckyDraw.update({
      where: { id: Number(req.params.id) },
      data,
    });
    return success(res, { draw }, 'Draw updated.');
  } catch (err) {
    console.error('[updateDraw]', err);
    return error(res, 'Failed to update draw.', 500);
  }
};

// ─── ADMIN: DELETE /api/lucky-draw/admin/:id ─────────────────────────────────
const deleteDraw = async (req, res) => {
  try {
    await prisma.luckyDraw.delete({ where: { id: Number(req.params.id) } });
    return success(res, {}, 'Draw deleted.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Draw not found.', 404);
    return error(res, 'Failed to delete draw.', 500);
  }
};

// ─── ADMIN: POST /api/lucky-draw/admin/:id/draw ──────────────────────────────
// Pick one random winner from all qualified entries
const pickWinner = async (req, res) => {
  try {
    const drawId = Number(req.params.id);
    const { prize } = req.body;

    if (!prize?.trim()) return error(res, 'Prize description is required.', 400);

    const draw = await prisma.luckyDraw.findUnique({
      where:   { id: drawId },
      include: { entries: true },
    });
    if (!draw)              return error(res, 'Draw not found.', 404);
    if (draw.entries.length === 0) return error(res, 'No qualified entries yet.', 400);

    // Pick random entry
    const winnerEntry = draw.entries[Math.floor(Math.random() * draw.entries.length)];

    // Save winner + mark draw as drawn — both in one transaction
    const [winner] = await prisma.$transaction([
      prisma.luckyDrawWinner.create({
        data: {
          drawId,
          userId: winnerEntry.userId,
          prize:  prize.trim(),
        },
        include: { user: { select: { id: true, name: true, phone: true, email: true } } },
      }),
      prisma.luckyDraw.update({
        where: { id: drawId },
        data:  { drawnAt: new Date(), isActive: false },
      }),
    ]);

    console.log(`[pickWinner] Draw #${drawId} winner: ${winner.user.name} — ${prize}`);
    return success(res, { winner }, `Winner picked: ${winner.user.name}!`);
  } catch (err) {
    console.error('[pickWinner]', err);
    return error(res, 'Failed to pick winner.', 500);
  }
};

// ─── CUSTOMER: GET /api/lucky-draw/active ────────────────────────────────────
// Returns the currently active draw + caller's entry status + their total spend
const getActiveDraw = async (req, res) => {
  try {
    const now = new Date();
    const draw = await prisma.luckyDraw.findFirst({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt:   { gte: now },
        drawnAt:  null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count:  { select: { entries: true } },
        winners: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!draw) return success(res, { draw: null });

    let myEntry = null;
    let myTotalSpent = 0;

    if (req.user) {
      // User's cumulative spend in draw period
      const agg = await prisma.order.aggregate({
        where: {
          userId:    req.user.id,
          status:    'DELIVERED',
          createdAt: { gte: draw.startsAt, lte: draw.endsAt },
        },
        _sum: { totalAmount: true },
      });
      myTotalSpent = Number(agg._sum.totalAmount || 0);

      myEntry = await prisma.luckyDrawEntry.findUnique({
        where: { drawId_userId: { drawId: draw.id, userId: req.user.id } },
      });
    }

    return success(res, {
      draw,
      myEntry,
      myTotalSpent,
      minSpendAmount: Number(draw.minSpendAmount),
      qualified:      myEntry !== null,
    });
  } catch (err) {
    console.error('[getActiveDraw]', err);
    return error(res, 'Failed to fetch draw.', 500);
  }
};

// ─── PUBLIC: GET /api/lucky-draw/winners ─────────────────────────────────────
const getWinners = async (req, res) => {
  try {
    const winners = await prisma.luckyDrawWinner.findMany({
      orderBy: { wonAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, name: true } },
        draw: { select: { id: true, title: true, endsAt: true } },
      },
    });
    return success(res, { winners });
  } catch (err) {
    return error(res, 'Failed to fetch winners.', 500);
  }
};

module.exports = {
  checkAndEnterDraw,
  createDraw, listDraws, getDraw, updateDraw, deleteDraw, pickWinner,
  getActiveDraw, getWinners,
};
