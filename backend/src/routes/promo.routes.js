const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { validatePromo } = require('../controllers/promo.controller');

// Customer — validate a promo code (requires auth so we can check per-user usage)
router.post('/validate', protect, validatePromo);

module.exports = router;
