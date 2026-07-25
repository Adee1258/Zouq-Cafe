const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  initiatePayment,
  easypaisaCallback,
  getPaymentStatus,
  mockComplete,
} = require('../controllers/payment.controller');

// Customer initiates payment after placing order
router.post('/initiate', protect, initiatePayment);

// EasyPaisa server POSTs here after payment (no JWT — verified by hash instead)
router.post('/easypaisa/callback', easypaisaCallback);

// Frontend polls this to check if payment completed
router.get('/status/:orderId', protect, getPaymentStatus);

// Dev only — simulate successful payment without real gateway
router.post('/mock-complete', protect, mockComplete);

module.exports = router;
