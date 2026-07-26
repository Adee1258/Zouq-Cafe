const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadProduct } = require('../config/cloudinary');
const {
  getProducts, getProduct,
  createProduct, updateProduct, deleteProduct,
  toggleAvailability, toggleFeatured,
  addVariant, updateVariant, deleteVariant, setVariants,
} = require('../controllers/product.controller');

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/',    getProducts);
router.get('/:id', getProduct);

// ── Admin — product CRUD ──────────────────────────────────────────────────────
const createRules = [
  body('name').trim().notEmpty().withMessage('Product name is required.'),
  body('categoryId').isInt({ min: 1 }).withMessage('Valid category is required.'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number.'),
];

router.post(  '/',              protect, adminOnly, uploadProduct.single('image'), createRules, validate, createProduct);
router.patch( '/:id',           protect, adminOnly, uploadProduct.single('image'), updateProduct);
router.patch( '/:id/toggle',    protect, adminOnly, toggleAvailability);
router.patch( '/:id/feature',   protect, adminOnly, toggleFeatured);
router.delete('/:id',           protect, adminOnly, deleteProduct);

// ── Admin — variant CRUD ──────────────────────────────────────────────────────
router.put(   '/:id/variants',       protect, adminOnly, setVariants);        // replace all
router.post(  '/:id/variants',       protect, adminOnly, addVariant);         // add one
router.patch( '/:id/variants/:vid',  protect, adminOnly, updateVariant);      // update one
router.delete('/:id/variants/:vid',  protect, adminOnly, deleteVariant);      // delete one

module.exports = router;
