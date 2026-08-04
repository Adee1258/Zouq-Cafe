const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getMyMissions,
  getMyVouchers,
  adminListMissions,
  adminCreateMission,
  adminUpdateMission,
  adminDeleteMission,
  adminTriggerReset,
  runWeeklyReset,
} = require('../controllers/mission.controller');

// ── Customer routes (auth required) ──────────────────────────────────────────
router.get('/',         protect, getMyMissions);
router.get('/vouchers', protect, getMyVouchers);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get(   '/admin',        protect, adminOnly, adminListMissions);
router.post(  '/admin',        protect, adminOnly, adminCreateMission);
router.patch( '/admin/:id',    protect, adminOnly, adminUpdateMission);
router.delete('/admin/:id',    protect, adminOnly, adminDeleteMission);
router.post(  '/admin/reset',  protect, adminOnly, adminTriggerReset);

// ── Vercel Cron endpoint — called by vercel.json cron config ──────────────────
// Protected by CRON_SECRET env variable (set in Vercel dashboard)
router.post('/cron/weekly-reset', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  // Vercel sends: Authorization: Bearer <CRON_SECRET>
  if (secret && authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    await runWeeklyReset();
    return res.json({ success: true, message: 'Weekly reset completed.' });
  } catch (err) {
    console.error('[cron/weekly-reset]', err);
    return res.status(500).json({ success: false, message: 'Reset failed.' });
  }
});

module.exports = router;
