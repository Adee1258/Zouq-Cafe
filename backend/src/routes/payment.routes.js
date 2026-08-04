const express  = require('express');
const router   = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { uploadPayment } = require('../config/cloudinary');
const {
  getEasypaisaNumber,
  updateEasypaisaNumber,
  uploadScreenshot,
  getPaymentStatus,
  adminVerify,
  adminReject,
  adminGetPending,
} = require('../controllers/payment.controller');

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/easypaisa-number', getEasypaisaNumber);

// ── Customer ──────────────────────────────────────────────────────────────────
router.post('/screenshot/:orderId', protect, uploadPayment.single('screenshot'), uploadScreenshot);
router.get('/status/:orderId',      protect, getPaymentStatus);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get  ('/admin/pending',              protect, adminOnly, adminGetPending);
router.post ('/admin/verify/:orderId',      protect, adminOnly, adminVerify);
router.post ('/admin/reject/:orderId',      protect, adminOnly, adminReject);
router.patch('/admin/easypaisa-number',     protect, adminOnly, updateEasypaisaNumber);

module.exports = router;
