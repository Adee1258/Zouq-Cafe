// Analytics controller — best sellers, time-of-day peaks, category breakdown
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    // All non-rejected order items in the period
    const orderItems = await prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: since }, status: { not: 'REJECTED' } } },
      include: {
        product: { include: { category: { select: { id: true, name: true } } } },
        order: { select: { createdAt: true } },
      },
    });

    // ── Best-selling products (by quantity + by revenue) ──
    const productMap = {};
    orderItems.forEach((item) => {
      const id = item.productId;
      if (!productMap[id]) {
        productMap[id] = {
          id,
          name: item.product?.name || 'Unknown',
          category: item.product?.category?.name || '',
          quantity: 0,
          revenue: 0,
        };
      }
      productMap[id].quantity += item.quantity;
      productMap[id].revenue += Number(item.priceAtOrder) * item.quantity;
    });

    const bestSellers = Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // ── Time-of-day breakdown (hourly buckets → morning/afternoon/evening/night) ──
    const timeSlots = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
    const hourlyMap = Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: 0, label: `${i}:00` }));

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: 'REJECTED' } },
      select: { createdAt: true },
    });

    orders.forEach((o) => {
      const hour = new Date(o.createdAt).getHours();
      hourlyMap[hour].orders += 1;

      if (hour >= 6 && hour < 12)       timeSlots.Morning   += 1;
      else if (hour >= 12 && hour < 17) timeSlots.Afternoon += 1;
      else if (hour >= 17 && hour < 21) timeSlots.Evening   += 1;
      else                              timeSlots.Night      += 1;
    });

    const timeOfDay = Object.entries(timeSlots).map(([name, orders]) => ({ name, orders }));

    // Group hourly to peak hours (non-zero only)
    const hourly = hourlyMap.filter((h) => h.orders > 0);

    // ── Category sales breakdown ──
    const categoryMap = {};
    orderItems.forEach((item) => {
      const cat = item.product?.category;
      if (!cat) return;
      if (!categoryMap[cat.id]) {
        categoryMap[cat.id] = { id: cat.id, name: cat.name, quantity: 0, revenue: 0 };
      }
      categoryMap[cat.id].quantity += item.quantity;
      categoryMap[cat.id].revenue += Number(item.priceAtOrder) * item.quantity;
    });

    const categoryBreakdown = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue);

    return success(res, { bestSellers, timeOfDay, hourly, categoryBreakdown, period: { days: Number(days), since } });
  } catch (err) {
    console.error('[getAnalytics]', err);
    return error(res, 'Failed to fetch analytics.', 500);
  }
};

module.exports = { getAnalytics };
