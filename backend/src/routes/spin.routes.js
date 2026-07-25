// Customer-facing spin routes
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getPrizes, spin, getMyHistory, useMyPrize, getSpinConfig } = require('../controllers/spin.controller');

// Public (but getSpinConfig needs optional auth for spins-left count)
router.get('/prizes', getPrizes);
router.get('/config', (req, res, next) => {
  // Optionally attach user if token present, but don't require it
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return protect(req, res, next);
  }
  next();
}, getSpinConfig);

// Authenticated
router.post('/',                    protect, spin);
router.get('/history',              protect, getMyHistory);
router.post('/history/:id/use',     protect, useMyPrize);

module.exports = router;
