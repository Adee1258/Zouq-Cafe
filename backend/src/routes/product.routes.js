const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadProduct } = require('../config/cloudinary');
const {
  getProducts, getProduct, createProduct, updateProduct, toggleAvailability, deleteProduct,
} = require('../controllers/product.controller');

// Public
router.get('/', getProducts);
router.get('/:id', getProduct);

// Admin only
const createRules = [
  body('name').trim().notEmpty().withMessage('Product name is required.'),
  body('categoryId').isInt({ min: 1 }).withMessage('Valid category is required.'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number.'),
];

router.post('/', protect, adminOnly, uploadProduct.single('image'), createRules, validate, createProduct);
router.patch('/:id', protect, adminOnly, uploadProduct.single('image'), updateProduct);
router.patch('/:id/toggle', protect, adminOnly, toggleAvailability);
router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;
