const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createOrder, getMyOrders, getMyOrder, cancelMyOrder,
  getAllOrders, getOrderById, updateOrderStatus, deleteOrder,
} = require('../controllers/order.controller');

// ── Admin routes FIRST (before /my to avoid route conflicts) ─────────────────
router.get('/admin', protect, adminOnly, getAllOrders);
router.get('/admin/:id', protect, adminOnly, getOrderById);
router.patch(
  '/admin/:id/status',
  protect, adminOnly,
  [body('status').notEmpty().withMessage('Status is required.')],
  validate,
  updateOrderStatus
);
router.delete('/admin/:id', protect, adminOnly, deleteOrder);

// ── Customer routes ───────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  [
    body('items').isArray({ min: 1 }).withMessage('Cart cannot be empty.'),
    // productId is optional for custom deal items (no DB product).
    // When present it must be a positive integer; null/undefined is allowed.
    body('items.*.productId')
      .optional({ nullable: true, checkFalsy: false })
      .if((value) => value !== null && value !== undefined)
      .isInt({ min: 1 }).withMessage('Invalid product ID.'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1.'),
    body('address').trim().notEmpty().withMessage('Delivery address is required.'),
    body('paymentType').isIn(['COD', 'ONLINE']).withMessage('Payment type must be COD or ONLINE.'),
  ],
  validate,
  createOrder
);

router.get('/my', protect, getMyOrders);
router.get('/my/:id', protect, getMyOrder);
router.patch('/my/:id/cancel', protect, cancelMyOrder);

module.exports = router;
