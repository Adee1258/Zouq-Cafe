const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { signup, login, adminLogin, getMe, updateMe, changePassword } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// ── Signup validation ─────────────────────────────────────────────────────────
const signupRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters.'),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),

  // Email optional — only validate format if provided
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail().withMessage('Invalid email address.'),

  // Phone optional — just check it's a string if provided, no strict format
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Invalid phone number.')
    .isLength({ min: 7, max: 20 }).withMessage('Phone number must be 7-20 characters.'),
];

// ── Login validation ──────────────────────────────────────────────────────────
const loginRules = [
  body('password')
    .notEmpty().withMessage('Password is required.'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail().normalizeEmail(),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];

// ── Admin login validation ────────────────────────────────────────────────────
const adminLoginRules = [
  body('email')
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Invalid email address.'),
  body('password')
    .notEmpty().withMessage('Password is required.'),
];

// ── Routes ────────────────────────────────────────────────────────────────────
router.post('/signup', signupRules, validate, signup);
router.post('/login', loginRules, validate, login);
router.post('/admin/login', adminLoginRules, validate, adminLogin);

router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.patch('/me/password', protect, changePassword);

module.exports = router;
