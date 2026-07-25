const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getVapidPublicKey, subscribe, unsubscribe } = require('../controllers/push.controller');

// Public — frontend needs this before login to set up subscription
router.get('/vapid-public-key', getVapidPublicKey);

// Admin only — save / remove subscription
router.post('/subscribe',   protect, adminOnly, subscribe);
router.delete('/unsubscribe', protect, adminOnly, unsubscribe);

module.exports = router;
