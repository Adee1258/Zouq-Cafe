// Reports controller — date-range stats with COD vs Online breakdown + CSV export
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── GET /api/admin/reports ───────────────────────────────────────────────────
// Query params: startDate, endDate (ISO strings)
// Default: last 7 days
const getReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: 'REJECTED' },
      },
      include: {
        items: { include: { product: true } },
        payment: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // ── Totals ──
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);

    const codOrders = orders.filter((o) => o.paymentType === 'COD');
    const onlineOrders = orders.filter((o) => o.paymentType === 'ONLINE');

    const codRevenue = codOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const onlineRevenue = onlineOrders.reduce((s, o) => s + Number(o.totalAmount), 0);

    // ── Daily breakdown (for chart) ──
    const dailyMap = {};
    orders.forEach((o) => {
      const day = o.createdAt.toISOString().split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, orders: 0, revenue: 0, cod: 0, online: 0 };
      dailyMap[day].orders += 1;
      dailyMap[day].revenue += Number(o.totalAmount);
      if (o.paymentType === 'COD') dailyMap[day].cod += Number(o.totalAmount);
      else dailyMap[day].online += Number(o.totalAmount);
    });

    // Fill gaps between start and end
    const daily = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().split('T')[0];
      daily.push(dailyMap[key] || { date: key, orders: 0, revenue: 0, cod: 0, online: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return success(res, {
      period: { start: start.toISOString(), end: end.toISOString() },
      summary: {
        totalOrders,
        totalRevenue,
        cod: { count: codOrders.length, revenue: codRevenue },
        online: { count: onlineOrders.length, revenue: onlineRevenue },
      },
      daily,
    });
  } catch (err) {
    console.error('[getReport]', err);
    return error(res, 'Failed to generate report.', 500);
  }
};

// ─── GET /api/admin/reports/export ───────────────────────────────────────────
// Returns a CSV file of orders in the date range
const exportCSV = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const rows = [
      // Header row
      ['Order ID', 'Date', 'Customer', 'Phone', 'Email', 'Items', 'Total (Rs.)', 'Payment', 'Status', 'Address'],
      ...orders.map((o) => [
        o.id,
        o.createdAt.toISOString().replace('T', ' ').slice(0, 16),
        o.user?.name,
        o.user?.phone || '',
        o.user?.email || '',
        o.items.map((i) => `${i.product?.name} x${i.quantity}`).join(' | '),
        Number(o.totalAmount).toFixed(2),
        o.paymentType,
        o.status,
        o.address,
      ]),
    ];

    const csv = rows.map((row) => row.map(escape).join(',')).join('\n');

    const filename = `zouqcafe-orders-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error('[exportCSV]', err);
    return error(res, 'Failed to export report.', 500);
  }
};

module.exports = { getReport, exportCSV };
