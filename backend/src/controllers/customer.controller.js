// Customer controller — admin only
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── GET /api/admin/customers ─────────────────────────────────────────────────
const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { role: 'CUSTOMER' };
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true,
          address: true, createdAt: true,
          _count: { select: { orders: true } },
          orders: {
            select: { totalAmount: true, status: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Attach computed stats per customer
    const shaped = customers.map((c) => {
      const totalSpent = c.orders
        .filter((o) => o.status !== 'REJECTED')
        .reduce((sum, o) => sum + Number(o.totalAmount), 0);

      return {
        id:         c.id,
        name:       c.name,
        email:      c.email,
        phone:      c.phone,
        address:    c.address,
        createdAt:  c.createdAt,
        orderCount: c._count.orders,
        totalSpent,
      };
    });

    return success(res, { customers: shaped, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('[getCustomers]', err);
    return error(res, 'Failed to fetch customers.', 500);
  }
};

// ─── GET /api/admin/customers/:id ────────────────────────────────────────────
const getCustomer = async (req, res) => {
  try {
    const customer = await prisma.user.findFirst({
      where: { id: Number(req.params.id), role: 'CUSTOMER' },
      select: {
        id: true, name: true, email: true, phone: true,
        address: true, createdAt: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: { product: { select: { id: true, name: true, imageUrl: true } } },
            },
            payment: true,
          },
        },
      },
    });

    if (!customer) return error(res, 'Customer not found.', 404);

    const totalSpent = customer.orders
      .filter((o) => o.status !== 'REJECTED')
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    return success(res, { customer: { ...customer, totalSpent } });
  } catch (err) {
    console.error('[getCustomer]', err);
    return error(res, 'Failed to fetch customer.', 500);
  }
};

module.exports = { getCustomers, getCustomer };
