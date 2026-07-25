require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const path    = require('path');

const app = express();

// ─── Security Headers (helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary images
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_2,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://zouq-cafe-adts.vercel.app',
  'https://zouq-cafe.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app')
    ) return callback(null, true);
    return callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight OPTIONS requests
app.options('*', cors());

// ─── Rate Limiters ────────────────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';

// Auth endpoints — strict limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: isProd ? 20 : 100,   // 20 in prod, relaxed in dev
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Spin
const spinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 10 : 30,
  message: { success: false, message: 'Too many spin requests.' },
});

// General API limiter
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 200 : 1000,
  message: { success: false, message: 'Too many requests. Slow down.' },
  skip: (req) => req.path.startsWith('/api/health'),
});

app.use('/api/', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/spin', spinLimiter);

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Serve uploaded images (local dev fallback) ───────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/products',   require('./routes/product.routes'));
app.use('/api/deals',      require('./routes/deal.routes'));
app.use('/api/orders',     require('./routes/order.routes'));
app.use('/api/payments',   require('./routes/payment.routes'));
app.use('/api/spin',       require('./routes/spin.routes'));
app.use('/api/promo',      require('./routes/promo.routes'));
app.use('/api/loyalty',    require('./routes/loyalty.routes'));
app.use('/api/admin',      require('./routes/admin.routes'));
app.use('/api/push',       require('./routes/push.routes'));
app.use('/api/lucky-draw', require('./routes/luckyDraw.routes'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : (err.message || 'Internal server error.'),
  });
});

module.exports = app;
