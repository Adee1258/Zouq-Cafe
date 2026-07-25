const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { uploadBanner } = require('../config/cloudinary');
const {
  createDraw, listDraws, getDraw, updateDraw, deleteDraw, pickWinner,
  getActiveDraw, getWinners,
} = require('../controllers/luckyDraw.controller');

// ── Public / Customer ─────────────────────────────────────────────────────────

// Active draw + caller's entry status (optional auth)
router.get('/active', (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return protect(req, res, next);
  next();
}, getActiveDraw);

// Past winners — fully public
router.get('/winners', getWinners);

// ── Admin only ────────────────────────────────────────────────────────────────
router.post  ('/',           protect, adminOnly, uploadBanner.single('banner'), createDraw);
router.get   ('/',           protect, adminOnly, listDraws);
router.get   ('/:id',        protect, adminOnly, getDraw);
router.patch ('/:id',        protect, adminOnly, uploadBanner.single('banner'), updateDraw);
router.delete('/:id',        protect, adminOnly, deleteDraw);
router.post  ('/:id/draw',   protect, adminOnly, pickWinner);

module.exports = router;
