const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { uploadProduct } = require('../config/cloudinary');
const {
  getDeals, getDeal, createDeal, updateDeal, deleteDeal, toggleDeal, toggleFeatured,
} = require('../controllers/deal.controller');

// Public
router.get('/',    getDeals);
router.get('/:id', getDeal);

// Admin only
router.post('/',              protect, adminOnly, uploadProduct.single('image'), createDeal);
router.patch('/:id',          protect, adminOnly, uploadProduct.single('image'), updateDeal);
router.delete('/:id',         protect, adminOnly, deleteDeal);
router.patch('/:id/toggle',   protect, adminOnly, toggleDeal);
router.patch('/:id/feature',  protect, adminOnly, toggleFeatured);

module.exports = router;
