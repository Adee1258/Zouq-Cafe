// Product controller — public browsing + admin management
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── GET /api/products ────────────────────────────────────────────────────────
// Public: filter by category, search, available only
const getProducts = async (req, res) => {
  try {
    const { categoryId, search, available, featured } = req.query;

    const where = {};
    if (categoryId) where.categoryId = Number(categoryId);
    if (available === 'true') where.isAvailable = true;
    if (featured === 'true') where.isFeatured = true;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });

    return success(res, { products });
  } catch (err) {
    console.error('[getProducts]', err);
    return error(res, 'Failed to fetch products.', 500);
  }
};

// ─── GET /api/products/:id ────────────────────────────────────────────────────
const getProduct = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!product) return error(res, 'Product not found.', 404);
    return success(res, { product });
  } catch (err) {
    return error(res, 'Failed to fetch product.', 500);
  }
};

// ─── POST /api/products (admin) ───────────────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    const { categoryId, name, description, price } = req.body;
    const imageUrl = req.file?.path || null;

    const product = await prisma.product.create({
      data: {
        categoryId: Number(categoryId),
        name,
        description: description || null,
        price: Number(price),
        imageUrl,
        isAvailable: true,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    return success(res, { product }, 'Product created.', 201);
  } catch (err) {
    console.error('[createProduct]', err);
    return error(res, 'Failed to create product.', 500);
  }
};

// ─── PATCH /api/products/:id (admin) ─────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    const { categoryId, name, description, price, isAvailable } = req.body;
    const imageUrl = req.file?.path || undefined;

    const data = {};
    if (categoryId !== undefined) data.categoryId = Number(categoryId);
    if (name) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = Number(price);
    if (isAvailable !== undefined) data.isAvailable = isAvailable === 'true' || isAvailable === true;
    if (imageUrl) data.imageUrl = imageUrl;

    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data,
      include: { category: { select: { id: true, name: true } } },
    });
    return success(res, { product }, 'Product updated.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Product not found.', 404);
    return error(res, 'Failed to update product.', 500);
  }
};

// ─── PATCH /api/products/:id/toggle (admin) ───────────────────────────────────
// Quick toggle availability without full update
const toggleAvailability = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!product) return error(res, 'Product not found.', 404);

    const updated = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: { isAvailable: !product.isAvailable },
    });
    return success(res, { product: updated }, `Product marked as ${updated.isAvailable ? 'available' : 'unavailable'}.`);
  } catch (err) {
    return error(res, 'Failed to toggle product.', 500);
  }
};

// ─── PATCH /api/products/:id/feature (admin) ─────────────────────────────────
// Toggle isFeatured — featured products appear on the home page
const toggleFeatured = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!product) return error(res, 'Product not found.', 404);

    const updated = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: { isFeatured: !product.isFeatured },
      include: { category: { select: { id: true, name: true } } },
    });
    return success(
      res,
      { product: updated },
      `Product ${updated.isFeatured ? 'featured on home page' : 'removed from home page'}.`
    );
  } catch (err) {
    console.error('[toggleFeatured]', err);
    return error(res, 'Failed to toggle featured.', 500);
  }
};

// ─── DELETE /api/products/:id (admin) ────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    return success(res, {}, 'Product deleted.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Product not found.', 404);
    // P2003 = foreign key constraint (product is in an order)
    if (err.code === 'P2003') return error(res, 'Cannot delete — this product has order history. Disable it instead.', 400);
    return error(res, 'Failed to delete product.', 500);
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, toggleAvailability, toggleFeatured, deleteProduct };
