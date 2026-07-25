// Analytics controller — best sellers, time-of-day peaks, category breakdown,
// order status breakdown, and daily revenue trend
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
      if (!id) return; // skip custom items
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

    // ── All orders in period (for time/status/revenue analysis) ──
    const allOrders = await prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true, totalAmount: true },
    });

    // ── Time-of-day breakdown ──
    const timeSlots = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
    const hourlyMap = Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: 0, label: `${i}:00` }));

    allOrders
      .filter((o) => o.status !== 'REJECTED')
      .forEach((o) => {
        const hour = new Date(o.createdAt).getHours();
        hourlyMap[hour].orders += 1;
        if (hour >= 6 && hour < 12)       timeSlots.Morning   += 1;
        else if (hour >= 12 && hour < 17) timeSlots.Afternoon += 1;
        else if (hour >= 17 && hour < 21) timeSlots.Evening   += 1;
        else                              timeSlots.Night      += 1;
      });

    const timeOfDay = Object.entries(timeSlots).map(([name, orders]) => ({ name, orders }));
    const hourly    = hourlyMap.filter((h) => h.orders > 0);

    // ── Order status breakdown (all orders including REJECTED) ──
    const statusMap = {};
    allOrders.forEach((o) => {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;
    });
    const STATUS_LABELS = {
      PENDING:          'Pending',
      APPROVED:         'Approved',
      PREPARING:        'Preparing',
      OUT_FOR_DELIVERY: 'Out for Delivery',
      DELIVERED:        'Delivered',
      REJECTED:         'Rejected',
    };
    const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({
      status,
      name:  STATUS_LABELS[status] || status,
      count,
    })).sort((a, b) => b.count - a.count);

    // ── Daily revenue trend (last N days, delivered + non-rejected) ──
    const dailyMap = {};
    // Pre-fill all days in range with 0
    for (let i = Number(days) - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { date: key, revenue: 0, orders: 0 };
    }
    allOrders
      .filter((o) => o.status !== 'REJECTED')
      .forEach((o) => {
        const key = new Date(o.createdAt).toISOString().split('T')[0];
        if (dailyMap[key]) {
          dailyMap[key].revenue += Number(o.totalAmount);
          dailyMap[key].orders  += 1;
        }
      });
    // Format date label: "Jul 24"
    const dailyRevenue = Object.values(dailyMap).map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }),
    }));

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

    return success(res, {
      bestSellers, timeOfDay, hourly,
      categoryBreakdown, statusBreakdown, dailyRevenue,
      period: { days: Number(days), since },
    });
  } catch (err) {
    console.error('[getAnalytics]', err);
    return error(res, 'Failed to fetch analytics.', 500);
  }
};

module.exports = { getAnalytics };
