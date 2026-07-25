// Admin-only routes: reports, analytics, spin management, customers
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getReport, exportCSV } = require('../controllers/report.controller');
const { getAnalytics } = require('../controllers/analytics.controller');
const { uploadPrize } = require('../config/cloudinary');
const {
  getAllHistory, markRedeemed, getAdminPrizes,
  createPrize, updatePrize, deletePrize, updateConfig,
} = require('../controllers/spin.controller');
const { getCustomers, getCustomer } = require('../controllers/customer.controller');
const {
  getAllPromos, createPromo, updatePromo, deletePromo, getPromoUsages,
} = require('../controllers/promo.controller');
const {
  getAdminConfig, updateAdminConfig,
  getCustomersWithPoints, getCustomerHistory, adjustPoints,
} = require('../controllers/loyalty.controller');

// All routes here require admin
router.use(protect, adminOnly);

// Reports
router.get('/reports', getReport);
router.get('/reports/export', exportCSV);

// Analytics
router.get('/analytics', getAnalytics);

// Spin management
router.get('/spin/prizes', getAdminPrizes);
router.post('/spin/prizes', uploadPrize.single('image'), createPrize);
router.patch('/spin/prizes/:id', uploadPrize.single('image'), updatePrize);
router.delete('/spin/prizes/:id', deletePrize);
router.get('/spin/history', getAllHistory);
router.patch('/spin/history/:id/redeem', markRedeemed);
router.patch('/spin/config', updateConfig);

// Customers
router.get('/customers', getCustomers);
router.get('/customers/:id', getCustomer);

// Promo codes
router.get('/promos',              getAllPromos);
router.post('/promos',             createPromo);
router.patch('/promos/:id',        updatePromo);
router.delete('/promos/:id',       deletePromo);
router.get('/promos/:id/usages',   getPromoUsages);

// Loyalty points — admin management
router.get('/loyalty/config',                     getAdminConfig);
router.patch('/loyalty/config',                   updateAdminConfig);
router.get('/loyalty/customers',                  getCustomersWithPoints);
router.get('/loyalty/customers/:id/history',      getCustomerHistory);
router.post('/loyalty/customers/:id/adjust',      adjustPoints);

// Dashboard stats — server-side computation
router.get('/dashboard-stats', async (req, res) => {
  const prisma = require('../config/prisma');
  const { success, error } = require('../utils/response');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayOrders, pendingCount, totalOrders,
      todayRevenue, totalRevenue, totalCustomers,
    ] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count(),
      prisma.order.aggregate({
        where: { createdAt: { gte: today }, status: { not: 'REJECTED' } },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { status: { not: 'REJECTED' } },
        _sum: { totalAmount: true },
      }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
    ]);

    return success(res, {
      todayOrders,
      pendingOrders: pendingCount,
      totalOrders,
      todayRevenue: Number(todayRevenue._sum.totalAmount || 0),
      totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
      totalCustomers,
    });
  } catch (err) {
    console.error('[dashboard-stats]', err);
    return error(res, 'Failed to fetch stats.', 500);
  }
});

module.exports = router;
