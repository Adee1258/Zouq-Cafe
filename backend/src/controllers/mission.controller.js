/**
 * Weekly Missions Controller
 *
 * Customer:
 *   GET  /api/missions          — active missions with current user's progress
 *   GET  /api/missions/vouchers — user's earned mission vouchers (pending + used)
 *
 * Admin:
 *   GET    /api/admin/missions         — list all mission definitions
 *   POST   /api/admin/missions         — create a new mission
 *   PATCH  /api/admin/missions/:id     — update a mission
 *   DELETE /api/admin/missions/:id     — delete a mission
 *   POST   /api/admin/missions/reset   — manually trigger weekly reset
 *
 * Internal (called from order.controller on DELIVERED):
 *   updateMissionProgress(userId, orderId)
 *
 * Internal (called from cron every Monday 05:00 PKT):
 *   runWeeklyReset()
 */

const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');
const crypto = require('crypto');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the Monday 00:00:00 UTC of the week containing `date`.
 * PKT is UTC+5, so "Monday 5 AM PKT" = "Monday 00:00 UTC".
 */
const getWeekStart = (date = new Date()) => {
  const d = new Date(date);
  // getDay(): 0=Sun,1=Mon,...,6=Sat
  const day = d.getUTCDay(); // use UTC so the reset is always midnight UTC (= 5 AM PKT)
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/** Returns Monday 00:00 UTC of NEXT week */
const getNextWeekStart = (date = new Date()) => {
  const ws = getWeekStart(date);
  ws.setUTCDate(ws.getUTCDate() + 7);
  return ws;
};

/** Generate a unique voucher code like MV-A3X7Z2 */
const genVoucherCode = () =>
  'MV-' + crypto.randomBytes(3).toString('hex').toUpperCase();

// ─── Internal: update progress after a DELIVERED order ───────────────────────
/**
 * Called from order.controller.js when an order is marked DELIVERED.
 * - Loads all active missions
 * - For each mission, calculates how much this order contributes
 * - Upserts UserMissionProgress for the current week
 * - If a mission just completed → creates a MissionVoucher + a PromoCode
 */
const updateMissionProgress = async (userId, orderId) => {
  try {
    const weekStart = getWeekStart();
    const weekEnd   = getNextWeekStart(); // exclusive upper bound

    // Load the order with its items to count quantities
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });
    if (!order) return;

    // Count how many individual items and how many distinct deal instances in THIS order
    let itemsInOrder = 0;
    const dealInstances = new Set(); // unique dealCartKey values = distinct deal instances

    for (const item of order.items) {
      itemsInOrder += item.quantity;
      if (item.dealId && item.dealCartKey) {
        dealInstances.add(item.dealCartKey);
      }
    }
    const dealsInOrder = dealInstances.size;

    // Load all active missions
    const missions = await prisma.weeklyMission.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    for (const mission of missions) {
      // How much does this order contribute to this mission?
      const contribution =
        mission.type === 'ITEMS_BOUGHT' ? itemsInOrder :
        mission.type === 'DEALS_BOUGHT' ? dealsInOrder : 0;

      if (contribution === 0) continue;

      // Fetch or create progress row for this week
      const existing = await prisma.userMissionProgress.findUnique({
        where: { userId_missionId_weekStart: { userId, missionId: mission.id, weekStart } },
      });

      // If already completed this week, skip
      if (existing?.completed) continue;

      const currentProgress = existing?.progress ?? 0;
      const newProgress = currentProgress + contribution;
      const justCompleted = !existing?.completed && newProgress >= mission.targetCount;

      await prisma.userMissionProgress.upsert({
        where: { userId_missionId_weekStart: { userId, missionId: mission.id, weekStart } },
        update: {
          progress:    Math.min(newProgress, mission.targetCount * 10), // cap sanity
          completed:   justCompleted || existing?.completed || false,
          completedAt: justCompleted ? new Date() : existing?.completedAt ?? null,
        },
        create: {
          userId,
          missionId: mission.id,
          weekStart,
          progress:    Math.min(newProgress, mission.targetCount * 10),
          completed:   justCompleted,
          completedAt: justCompleted ? new Date() : null,
        },
      });

      // Award voucher on first completion
      if (justCompleted) {
        await awardMissionVoucher(userId, mission, weekStart, weekEnd);
      }
    }
  } catch (err) {
    console.error('[updateMissionProgress]', err.message);
  }
};

// ─── Internal: award a mission voucher ───────────────────────────────────────
const awardMissionVoucher = async (userId, mission, weekStart, weekEnd) => {
  try {
    // Idempotency check — don't double-award
    const already = await prisma.missionVoucher.findUnique({
      where: { userId_missionId_weekStart: { userId, missionId: mission.id, weekStart } },
    });
    if (already) return;

    // Voucher expires 7 days after the week ends
    const expiresAt = new Date(weekEnd);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);

    // Generate unique code (retry on collision)
    let code;
    let attempts = 0;
    while (attempts < 5) {
      code = genVoucherCode();
      const clash = await prisma.promoCode.findUnique({ where: { code } });
      if (!clash) break;
      attempts++;
    }
    if (!code) {
      console.error('[awardMissionVoucher] Could not generate unique code');
      return;
    }

    // Create the PromoCode record (per-user, 1-use)
    await prisma.promoCode.create({
      data: {
        code,
        description:   `Mission reward: ${mission.title} — Rs. ${mission.voucherAmount} off on orders above Rs. ${mission.minOrderForVoucher}`,
        discountType:  'FLAT',
        discountValue: mission.voucherAmount,
        minOrderAmount: mission.minOrderForVoucher,
        usageLimit:    1,
        perUserLimit:  1,
        isActive:      true,
        expiresAt,
      },
    });

    // Create the MissionVoucher record
    await prisma.missionVoucher.create({
      data: {
        userId,
        missionId: mission.id,
        weekStart,
        promoCode:  code,
        amount:     mission.voucherAmount,
        minOrder:   mission.minOrderForVoucher,
        expiresAt,
      },
    });

    console.log(`[Missions] Voucher ${code} awarded to user #${userId} for mission "${mission.title}"`);
  } catch (err) {
    console.error('[awardMissionVoucher]', err.message);
  }
};

// ─── Internal / cron: weekly reset ───────────────────────────────────────────
/**
 * Called every Monday at 05:00 PKT (= 00:00 UTC).
 * Deletes all UserMissionProgress rows that are NOT completed for the
 * week that just ended. Completed rows stay for history; incomplete ones
 * are discarded so they don't carry over.
 *
 * This function figures out "the week that just ended" = the weekStart
 * that is exactly 7 days ago.
 */
const runWeeklyReset = async () => {
  try {
    const now = new Date();
    // The week that JUST ended is the week whose Monday was 7 days ago
    const lastWeekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));

    // Delete incomplete progress for last week — completed ones stay
    const deleted = await prisma.userMissionProgress.deleteMany({
      where: {
        weekStart:  lastWeekStart,
        completed:  false,
      },
    });

    console.log(`[Missions] Weekly reset: deleted ${deleted.count} incomplete progress rows for week starting ${lastWeekStart.toISOString()}`);
  } catch (err) {
    console.error('[runWeeklyReset]', err.message);
  }
};

// ─── GET /api/missions ────────────────────────────────────────────────────────
const getMyMissions = async (req, res) => {
  try {
    const userId    = req.user.id;
    const weekStart = getWeekStart();
    const weekEnd   = getNextWeekStart();

    const missions = await prisma.weeklyMission.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Fetch this user's progress for all missions this week in one query
    const progresses = await prisma.userMissionProgress.findMany({
      where: { userId, weekStart },
    });
    const progressMap = {};
    progresses.forEach((p) => { progressMap[p.missionId] = p; });

    // Fetch any vouchers earned this week
    const vouchers = await prisma.missionVoucher.findMany({
      where: { userId, weekStart },
    });
    const voucherMap = {};
    vouchers.forEach((v) => { voucherMap[v.missionId] = v; });

    const result = missions.map((m) => {
      const prog    = progressMap[m.id];
      const voucher = voucherMap[m.id];
      return {
        id:             m.id,
        title:          m.title,
        description:    m.description,
        type:           m.type,
        targetCount:    m.targetCount,
        voucherAmount:  m.voucherAmount,
        minOrderForVoucher: m.minOrderForVoucher,
        sortOrder:      m.sortOrder,
        progress:       prog?.progress ?? 0,
        completed:      prog?.completed ?? false,
        completedAt:    prog?.completedAt ?? null,
        voucher:        voucher ? {
          code:       voucher.promoCode,
          amount:     voucher.amount,
          minOrder:   voucher.minOrder,
          redeemed:   voucher.redeemed,
          redeemedAt: voucher.redeemedAt,
          expiresAt:  voucher.expiresAt,
        } : null,
      };
    });

    return success(res, {
      missions: result,
      weekStart: weekStart.toISOString(),
      weekEnd:   weekEnd.toISOString(),
    });
  } catch (err) {
    console.error('[getMyMissions]', err);
    return error(res, 'Failed to fetch missions.', 500);
  }
};

// ─── GET /api/missions/vouchers ───────────────────────────────────────────────
const getMyVouchers = async (req, res) => {
  try {
    const userId = req.user.id;

    const vouchers = await prisma.missionVoucher.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        mission: { select: { id: true, title: true } },
      },
    });

    return success(res, { vouchers });
  } catch (err) {
    console.error('[getMyVouchers]', err);
    return error(res, 'Failed to fetch vouchers.', 500);
  }
};

// ─── ADMIN: GET /api/admin/missions ──────────────────────────────────────────
const adminListMissions = async (req, res) => {
  try {
    const missions = await prisma.weeklyMission.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { progresses: true, vouchers: true } },
      },
    });
    return success(res, { missions });
  } catch (err) {
    console.error('[adminListMissions]', err);
    return error(res, 'Failed to fetch missions.', 500);
  }
};

// ─── ADMIN: POST /api/admin/missions ─────────────────────────────────────────
const adminCreateMission = async (req, res) => {
  try {
    const { title, description, type, targetCount, voucherAmount, minOrderForVoucher, sortOrder } = req.body;

    if (!title?.trim())                            return error(res, 'Title is required.', 400);
    if (!['ITEMS_BOUGHT', 'DEALS_BOUGHT'].includes(type)) return error(res, 'Invalid mission type.', 400);
    if (!Number.isInteger(Number(targetCount))     || Number(targetCount)     < 1) return error(res, 'targetCount must be a positive integer.', 400);
    if (!Number.isInteger(Number(voucherAmount))   || Number(voucherAmount)   < 1) return error(res, 'voucherAmount must be a positive integer.', 400);
    if (!Number.isInteger(Number(minOrderForVoucher)) || Number(minOrderForVoucher) < 1) return error(res, 'minOrderForVoucher must be a positive integer.', 400);

    const mission = await prisma.weeklyMission.create({
      data: {
        title:             title.trim(),
        description:       description?.trim() || null,
        type,
        targetCount:       Number(targetCount),
        voucherAmount:     Number(voucherAmount),
        minOrderForVoucher: Number(minOrderForVoucher),
        sortOrder:         sortOrder !== undefined ? Number(sortOrder) : 0,
        isActive:          true,
      },
    });

    return success(res, { mission }, 'Mission created.', 201);
  } catch (err) {
    console.error('[adminCreateMission]', err);
    return error(res, 'Failed to create mission.', 500);
  }
};

// ─── ADMIN: PATCH /api/admin/missions/:id ────────────────────────────────────
const adminUpdateMission = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, type, targetCount, voucherAmount, minOrderForVoucher, sortOrder, isActive } = req.body;

    const data = {};
    if (title             !== undefined) data.title             = title.trim();
    if (description       !== undefined) data.description       = description?.trim() || null;
    if (type              !== undefined) data.type              = type;
    if (targetCount       !== undefined) data.targetCount       = Number(targetCount);
    if (voucherAmount     !== undefined) data.voucherAmount     = Number(voucherAmount);
    if (minOrderForVoucher !== undefined) data.minOrderForVoucher = Number(minOrderForVoucher);
    if (sortOrder         !== undefined) data.sortOrder         = Number(sortOrder);
    if (isActive          !== undefined) data.isActive          = Boolean(isActive);

    const mission = await prisma.weeklyMission.update({ where: { id }, data });
    return success(res, { mission }, 'Mission updated.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Mission not found.', 404);
    console.error('[adminUpdateMission]', err);
    return error(res, 'Failed to update mission.', 500);
  }
};

// ─── ADMIN: DELETE /api/admin/missions/:id ───────────────────────────────────
const adminDeleteMission = async (req, res) => {
  try {
    await prisma.weeklyMission.delete({ where: { id: Number(req.params.id) } });
    return success(res, {}, 'Mission deleted.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Mission not found.', 404);
    return error(res, 'Failed to delete mission.', 500);
  }
};

// ─── ADMIN: POST /api/admin/missions/reset ───────────────────────────────────
const adminTriggerReset = async (req, res) => {
  try {
    await runWeeklyReset();
    return success(res, {}, 'Weekly reset executed.');
  } catch (err) {
    console.error('[adminTriggerReset]', err);
    return error(res, 'Failed to run reset.', 500);
  }
};

module.exports = {
  // customer
  getMyMissions,
  getMyVouchers,
  // admin
  adminListMissions,
  adminCreateMission,
  adminUpdateMission,
  adminDeleteMission,
  adminTriggerReset,
  // internal
  updateMissionProgress,
  runWeeklyReset,
};
