const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadCategory } = require('../config/cloudinary');
const {
  getCategories, getCategory, createCategory, updateCategory, deleteCategory,
} = require('../controllers/category.controller');

// Public
router.get('/', getCategories);
router.get('/:id', getCategory);

// Admin only
router.post(
  '/',
  protect, adminOnly,
  uploadCategory.single('image'),
  [body('name').trim().notEmpty().withMessage('Category name is required.')],
  validate,
  createCategory
);

router.patch('/:id', protect, adminOnly, uploadCategory.single('image'), updateCategory);
router.delete('/:id', protect, adminOnly, deleteCategory);

module.exports = router;
