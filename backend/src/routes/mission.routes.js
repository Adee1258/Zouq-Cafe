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

module.exports = router;
