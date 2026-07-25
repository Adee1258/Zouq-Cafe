// Deal controller — public read + admin CRUD (supports menu + custom items)
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');
const { getIO } = require('../config/socket');

// Helper — fetch full deal with items (both menu and custom)
const findDealWithItems = async (id) => {
  const deal = await prisma.deal.findUnique({
    where: { id: Number(id) },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, imageUrl: true, price: true, description: true },
          },
        },
      },
    },
  });
  if (!deal) return null;
  return shapeDeal(deal);
};

// Reshape deal for frontend — unify menu and custom items format
const shapeDeal = (deal) => ({
  ...deal,
  dealPrice:  Number(deal.dealPrice),
  isFeatured: deal.isFeatured ?? false,
  items: deal.items.map((di) => {
    if (di.product) {
      // Menu item
      return {
        id:               di.id,
        quantity:         di.quantity,
        type:             'menu',
        productId:        di.product.id,
        productName:      di.product.name,
        productImageUrl:  di.product.imageUrl,
        productPrice:     Number(di.product.price),
        productDescription: di.product.description,
        customName:       null,
        customPrice:      null,
      };
    } else {
      // Custom item
      return {
        id:               di.id,
        quantity:         di.quantity,
        type:             'custom',
        productId:        null,
        productName:      di.customName,
        productImageUrl:  null,
        productPrice:     Number(di.customPrice || 0),
        productDescription: null,
        customName:       di.customName,
        customPrice:      Number(di.customPrice || 0),
      };
    }
  }),
});

// ─── GET /api/deals  (public) ─────────────────────────────────────────────────
const getDeals = async (req, res) => {
  try {
    const activeOnly  = req.query.active !== 'false';
    const featuredOnly = req.query.featured === 'true';

    const where = {};
    if (activeOnly)   where.isActive   = true;
    if (featuredOnly) where.isFeatured = true;

    const deals = await prisma.deal.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, imageUrl: true, price: true },
            },
          },
        },
      },
    });
    return success(res, { deals: deals.map(shapeDeal) });
  } catch (err) {
    console.error('[getDeals]', err);
    return error(res, 'Failed to fetch deals.', 500);
  }
};

// ─── GET /api/deals/:id  (public) ─────────────────────────────────────────────
const getDeal = async (req, res) => {
  try {
    const deal = await findDealWithItems(req.params.id);
    if (!deal) return error(res, 'Deal not found.', 404);
    return success(res, { deal });
  } catch (err) {
    console.error('[getDeal]', err);
    return error(res, 'Failed to fetch deal.', 500);
  }
};

// ─── POST /api/deals  (admin) ─────────────────────────────────────────────────
const createDeal = async (req, res) => {
  try {
    const { title, description, dealPrice } = req.body;
    let items = [];
    try { items = req.body.items ? JSON.parse(req.body.items) : []; } catch { items = []; }

    if (!title?.trim()) return error(res, 'Title is required.', 400);
    if (!dealPrice || isNaN(Number(dealPrice)) || Number(dealPrice) < 0)
      return error(res, 'Valid deal price is required.', 400);

    const imageUrl = req.file?.path || null;

    // Build items array supporting both menu and custom
    const itemsToCreate = items
      .filter((it) => it.productId || it.customName?.trim())
      .map((it) => {
        if (it.productId) {
          return { productId: Number(it.productId), quantity: Number(it.quantity) || 1 };
        } else {
          return {
            productId:   null,
            quantity:    Number(it.quantity) || 1,
            customName:  it.customName.trim(),
            customPrice: Number(it.customPrice) || 0,
          };
        }
      });

    const deal = await prisma.deal.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        imageUrl,
        dealPrice: Number(dealPrice),
        isActive: true,
        isFeatured: false,
        items: { create: itemsToCreate },
      },
    });

    const full = await findDealWithItems(deal.id);
    return success(res, { deal: full }, 'Deal created successfully.', 201);
  } catch (err) {
    console.error('[createDeal]', err);
    return error(res, 'Failed to create deal.', 500);
  }
};

// ─── PATCH /api/deals/:id  (admin) ────────────────────────────────────────────
const updateDeal = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, dealPrice, isActive } = req.body;
    let items = null;
    if (req.body.items !== undefined) {
      try { items = JSON.parse(req.body.items); } catch { items = null; }
    }

    const data = {};
    if (title !== undefined)       data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (dealPrice !== undefined)   data.dealPrice = Number(dealPrice);
    if (isActive !== undefined)    data.isActive = isActive === true || isActive === 'true';
    if (req.body.isFeatured !== undefined) data.isFeatured = req.body.isFeatured === true || req.body.isFeatured === 'true';
    if (req.file?.path)            data.imageUrl = req.file.path;

    await prisma.deal.update({ where: { id }, data });

    // Replace all items if provided
    if (items !== null && Array.isArray(items)) {
      await prisma.dealItem.deleteMany({ where: { dealId: id } });

      const itemsToCreate = items
        .filter((it) => it.productId || it.customName?.trim())
        .map((it) => {
          if (it.productId) {
            return { dealId: id, productId: Number(it.productId), quantity: Number(it.quantity) || 1 };
          } else {
            return {
              dealId:      id,
              productId:   null,
              quantity:    Number(it.quantity) || 1,
              customName:  it.customName.trim(),
              customPrice: Number(it.customPrice) || 0,
            };
          }
        });

      if (itemsToCreate.length > 0) {
        await prisma.dealItem.createMany({ data: itemsToCreate });
      }
    }

    const full = await findDealWithItems(id);
    if (!full) return error(res, 'Deal not found.', 404);
    return success(res, { deal: full }, 'Deal updated.');
  } catch (err) {
    console.error('[updateDeal]', err);
    return error(res, 'Failed to update deal.', 500);
  }
};

// ─── DELETE /api/deals/:id  (admin) ───────────────────────────────────────────
const deleteDeal = async (req, res) => {
  try {
    await prisma.deal.delete({ where: { id: Number(req.params.id) } });
    return success(res, null, 'Deal deleted.');
  } catch (err) {
    console.error('[deleteDeal]', err);
    return error(res, 'Failed to delete deal.', 500);
  }
};

// ─── PATCH /api/deals/:id/toggle  (admin) ─────────────────────────────────────
const toggleDeal = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.deal.findUnique({ where: { id } });
    if (!current) return error(res, 'Deal not found.', 404);
    await prisma.deal.update({ where: { id }, data: { isActive: !current.isActive } });
    const deal = await findDealWithItems(id);
    return success(res, { deal }, `Deal ${deal.isActive ? 'activated' : 'deactivated'}.`);
  } catch (err) {
    console.error('[toggleDeal]', err);
    return error(res, 'Failed to toggle deal.', 500);
  }
};

// ─── PATCH /api/deals/:id/feature  (admin) ────────────────────────────────────
const toggleFeatured = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.deal.findUnique({ where: { id } });
    if (!current) return error(res, 'Deal not found.', 404);
    await prisma.deal.update({ where: { id }, data: { isFeatured: !current.isFeatured } });
    const deal = await findDealWithItems(id);

    // Notify customers in real-time when a deal is featured
    if (deal.isFeatured) {
      try {
        getIO().to('customer').emit('new_featured_deal', {
          id:        deal.id,
          title:     deal.title,
          dealPrice: deal.dealPrice,
          imageUrl:  deal.imageUrl,
        });
      } catch { /* socket not critical */ }
    }

    return success(res, { deal }, `Deal ${deal.isFeatured ? 'featured' : 'unfeatured'}.`);
  } catch (err) {
    console.error('[toggleFeatured]', err);
    return error(res, 'Failed to toggle featured.', 500);
  }
};

module.exports = { getDeals, getDeal, createDeal, updateDeal, deleteDeal, toggleDeal, toggleFeatured };
