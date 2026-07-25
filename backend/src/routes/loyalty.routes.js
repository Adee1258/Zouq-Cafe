const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getBalance, getHistory } = require('../controllers/loyalty.controller');

// Customer — must be logged in
router.get('/balance', protect, getBalance);
router.get('/history', protect, getHistory);

module.exports = router;
