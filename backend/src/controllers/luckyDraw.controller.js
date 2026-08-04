/**
 * Lucky Draw Controller
 *
 * New system:
 *   - No end date — draw runs until maxEntries unique users qualify
 *   - One entry per user per draw (upsert — duplicate orders don't add more entries)
 *   - Admin picks winner manually once entries >= maxEntries (or anytime they want)
 *
 * Admin:
 *   POST   /api/lucky-draw          — create a new draw (multipart: banner image)
 *   GET    /api/lucky-draw          — list all draws
 *   GET    /api/lucky-draw/:id      — single draw detail + entries
 *   PATCH  /api/lucky-draw/:id      — update draw
 *   DELETE /api/lucky-draw/:id      — delete draw
 *   POST   /api/lucky-draw/:id/draw — pick random winner
 *
 * Customer:
 *   GET    /api/lucky-draw/active   — active draw info + caller's entry status
 *   GET    /api/lucky-draw/winners  — public winners list
 *
 * Auto-entry hook (called from order.controller when order → DELIVERED):
 *   checkAndEnterDraw(userId, orderTotal)
 */

const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── Internal: called from order controller on DELIVERED ─────────────────────
/**
 * After a DELIVERED order, check every active draw.
 * Qualification rule: THIS SINGLE ORDER's amount >= minSpendAmount.
 * Cumulative spend does NOT count — user must place one order worth >= minSpendAmount.
 * One entry per user per draw — ordering multiple times won't add more entries.
 */
const checkAndEnterDraw = async (userId, deliveredOrderTotal) => {
  try {
    const activeDraws = await prisma.luckyDraw.findMany({
      where: { isActive: true, drawnAt: null },
    });

    for (const draw of activeDraws) {
      // Only THIS order's amount is checked — not cumulative
      if (deliveredOrderTotal >= Number(draw.minSpendAmount)) {
        // Upsert — one entry per user per draw (duplicate orders ignored)
        await prisma.luckyDrawEntry.upsert({
          where:  { drawId_userId: { drawId: draw.id, userId } },
          update: { totalSpent: deliveredOrderTotal },
          create: { drawId: draw.id, userId, totalSpent: deliveredOrderTotal },
        });
      }
    }
  } catch (err) {
    console.error('[checkAndEnterDraw]', err.message);
  }
};

// ─── ADMIN: POST /api/lucky-draw ─────────────────────────────────────────────
const createDraw = async (req, res) => {
  try {
    const { title, minSpendAmount, maxEntries, description } = req.body;
    const bannerUrl = req.file?.path || null;

    if (!minSpendAmount || Number(minSpendAmount) <= 0) {
      return error(res, 'Minimum spend amount is required and must be > 0.', 400);
    }

    const draw = await prisma.luckyDraw.create({
      data: {
        title:         title?.trim() || 'Lucky Draw',
        description:   description?.trim() || null,
        bannerUrl,
        minSpendAmount: Number(minSpendAmount),
        maxEntries:    maxEntries ? Number(maxEntries) : 100,
        isActive:      true,
      },
    });

    return success(res, { draw }, 'Lucky draw created.', 201);
  } catch (err) {
    console.error('[createDraw]', err);
    return error(res, 'Failed to create draw.', 500);
  }
};

// ─── ADMIN: GET /api/lucky-draw ──────────────────────────────────────────────
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

// ─── ADMIN: GET /api/lucky-draw/:id ─────────────────────────────────────────
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

// ─── ADMIN: PATCH /api/lucky-draw/:id ───────────────────────────────────────
const updateDraw = async (req, res) => {
  try {
    const { title, minSpendAmount, maxEntries, isActive, description } = req.body;
    const newBannerUrl = req.file?.path || undefined;

    const existing = await prisma.luckyDraw.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!existing) return error(res, 'Draw not found.', 404);

    const data = {};
    if (title          !== undefined) data.title          = title.trim();
    if (description    !== undefined) data.description    = description?.trim() || null;
    if (newBannerUrl   !== undefined) data.bannerUrl      = newBannerUrl;
    if (minSpendAmount !== undefined) data.minSpendAmount = Number(minSpendAmount);
    if (maxEntries     !== undefined) data.maxEntries     = Number(maxEntries);
    if (isActive       !== undefined) data.isActive       = isActive === 'true' || isActive === true;

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

// ─── ADMIN: DELETE /api/lucky-draw/:id ──────────────────────────────────────
const deleteDraw = async (req, res) => {
  try {
    await prisma.luckyDraw.delete({ where: { id: Number(req.params.id) } });
    return success(res, {}, 'Draw deleted.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Draw not found.', 404);
    return error(res, 'Failed to delete draw.', 500);
  }
};

// ─── ADMIN: POST /api/lucky-draw/:id/draw ───────────────────────────────────
const pickWinner = async (req, res) => {
  try {
    const drawId = Number(req.params.id);
    const { prize } = req.body;

    if (!prize?.trim()) return error(res, 'Prize description is required.', 400);

    const draw = await prisma.luckyDraw.findUnique({
      where:   { id: drawId },
      include: { entries: true },
    });
    if (!draw)                   return error(res, 'Draw not found.', 404);
    if (draw.entries.length === 0) return error(res, 'No qualified entries yet.', 400);

    // Pick one random entry
    const winnerEntry = draw.entries[Math.floor(Math.random() * draw.entries.length)];

    const [winner] = await prisma.$transaction([
      prisma.luckyDrawWinner.create({
        data: { drawId, userId: winnerEntry.userId, prize: prize.trim() },
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

// ─── CUSTOMER: GET /api/lucky-draw/active ───────────────────────────────────
const getActiveDraw = async (req, res) => {
  try {
    const draw = await prisma.luckyDraw.findFirst({
      where:   { isActive: true, drawnAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count:  { select: { entries: true } },
        winners: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!draw) return success(res, { draw: null });

    let myEntry      = null;
    let myTotalSpent = 0;

    if (req.user) {
      // Check user's best (highest) single delivered order
      const bestOrder = await prisma.order.findFirst({
        where:   { userId: req.user.id, status: 'DELIVERED' },
        orderBy: { totalAmount: 'desc' },
        select:  { totalAmount: true },
      });
      myTotalSpent = Number(bestOrder?.totalAmount || 0);

      myEntry = await prisma.luckyDrawEntry.findUnique({
        where: { drawId_userId: { drawId: draw.id, userId: req.user.id } },
      });
    }

    return success(res, {
      draw,
      myEntry,
      myTotalSpent,
      minSpendAmount: Number(draw.minSpendAmount),
      maxEntries:     draw.maxEntries,
      currentEntries: draw._count.entries,
      qualified:      myEntry !== null,
    });
  } catch (err) {
    console.error('[getActiveDraw]', err);
    return error(res, 'Failed to fetch draw.', 500);
  }
};

// ─── PUBLIC: GET /api/lucky-draw/winners ────────────────────────────────────
const getWinners = async (req, res) => {
  try {
    const winners = await prisma.luckyDrawWinner.findMany({
      orderBy: { wonAt: 'desc' },
      take:    20,
      include: {
        user: { select: { id: true, name: true } },
        draw: { select: { id: true, title: true } },
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
