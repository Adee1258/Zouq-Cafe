// Product controller — public browsing + admin management
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── Helper: include variants in every product query ─────────────────────────
const WITH_VARIANTS = {
  category: { select: { id: true, name: true } },
  variants: {
    where:   { isAvailable: true },
    orderBy: { sortOrder: 'asc' },
    select:  { id: true, name: true, price: true, isAvailable: true, sortOrder: true },
  },
};

// Admin version — includes unavailable variants too
const WITH_VARIANTS_ADMIN = {
  category: { select: { id: true, name: true } },
  variants: {
    orderBy: { sortOrder: 'asc' },
    select:  { id: true, name: true, price: true, isAvailable: true, sortOrder: true },
  },
};

// ─── GET /api/products ────────────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const { categoryId, search, available, featured } = req.query;

    const where = {};
    if (categoryId) where.categoryId = Number(categoryId);
    if (available === 'true') where.isAvailable = true;
    if (featured  === 'true') where.isFeatured  = true;

    // Search: match product name OR any variant name
    if (search) {
      where.OR = [
        { name:     { contains: search, mode: 'insensitive' } },
        { variants: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: WITH_VARIANTS,
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
      where:   { id: Number(req.params.id) },
      include: WITH_VARIANTS,
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

    // Parse variants if provided
    let variants = [];
    try { variants = req.body.variants ? JSON.parse(req.body.variants) : []; } catch { variants = []; }

    const product = await prisma.product.create({
      data: {
        categoryId:  Number(categoryId),
        name,
        description: description || null,
        price:       Number(price),
        imageUrl,
        isAvailable: true,
        ...(variants.length > 0 && {
          variants: {
            create: variants
              .filter((v) => v.name?.trim() && Number(v.price) >= 0)
              .map((v, i) => ({
                name:       v.name.trim(),
                price:      Number(v.price),
                isAvailable: true,
                sortOrder:  i,
              })),
          },
        }),
      },
      include: WITH_VARIANTS_ADMIN,
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
    if (categoryId  !== undefined) data.categoryId  = Number(categoryId);
    if (name)                       data.name        = name;
    if (description !== undefined)  data.description = description;
    if (price       !== undefined)  data.price       = Number(price);
    if (isAvailable !== undefined)  data.isAvailable = isAvailable === 'true' || isAvailable === true;
    if (imageUrl)                   data.imageUrl    = imageUrl;

    const product = await prisma.product.update({
      where:   { id: Number(req.params.id) },
      data,
      include: WITH_VARIANTS_ADMIN,
    });
    return success(res, { product }, 'Product updated.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Product not found.', 404);
    return error(res, 'Failed to update product.', 500);
  }
};

// ─── PATCH /api/products/:id/toggle (admin) ───────────────────────────────────
const toggleAvailability = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
    if (!product) return error(res, 'Product not found.', 404);

    const updated = await prisma.product.update({
      where:   { id: Number(req.params.id) },
      data:    { isAvailable: !product.isAvailable },
      include: WITH_VARIANTS_ADMIN,
    });
    return success(res, { product: updated }, `Product marked as ${updated.isAvailable ? 'available' : 'unavailable'}.`);
  } catch (err) {
    return error(res, 'Failed to toggle product.', 500);
  }
};

// ─── PATCH /api/products/:id/feature (admin) ─────────────────────────────────
const toggleFeatured = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
    if (!product) return error(res, 'Product not found.', 404);

    const updated = await prisma.product.update({
      where:   { id: Number(req.params.id) },
      data:    { isFeatured: !product.isFeatured },
      include: WITH_VARIANTS_ADMIN,
    });
    return success(res, { product: updated }, `Product ${updated.isFeatured ? 'featured on home page' : 'removed from home page'}.`);
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
    if (err.code === 'P2003') return error(res, 'Cannot delete — this product has order history. Disable it instead.', 400);
    return error(res, 'Failed to delete product.', 500);
  }
};

// ─── POST /api/products/:id/variants (admin) ─────────────────────────────────
const addVariant = async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { name, price } = req.body;
    if (!name?.trim()) return error(res, 'Variant name is required.', 400);
    if (price === undefined || isNaN(Number(price))) return error(res, 'Valid price is required.', 400);

    // sortOrder = current max + 1
    const agg = await prisma.productVariant.aggregate({
      where: { productId },
      _max:  { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;

    const variant = await prisma.productVariant.create({
      data: { productId, name: name.trim(), price: Number(price), sortOrder },
    });
    return success(res, { variant }, 'Variant added.', 201);
  } catch (err) {
    console.error('[addVariant]', err);
    return error(res, 'Failed to add variant.', 500);
  }
};

// ─── PATCH /api/products/:id/variants/:vid (admin) ───────────────────────────
const updateVariant = async (req, res) => {
  try {
    const { name, price, isAvailable } = req.body;
    const data = {};
    if (name        !== undefined) data.name        = name.trim();
    if (price       !== undefined) data.price       = Number(price);
    if (isAvailable !== undefined) data.isAvailable = isAvailable === true || isAvailable === 'true';

    const variant = await prisma.productVariant.update({
      where: { id: Number(req.params.vid) },
      data,
    });
    return success(res, { variant }, 'Variant updated.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Variant not found.', 404);
    return error(res, 'Failed to update variant.', 500);
  }
};

// ─── DELETE /api/products/:id/variants/:vid (admin) ──────────────────────────
const deleteVariant = async (req, res) => {
  try {
    await prisma.productVariant.delete({ where: { id: Number(req.params.vid) } });
    return success(res, {}, 'Variant deleted.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Variant not found.', 404);
    return error(res, 'Failed to delete variant.', 500);
  }
};

// ─── PUT /api/products/:id/variants (admin) — replace all variants ───────────
const setVariants = async (req, res) => {
  try {
    const productId = Number(req.params.id);
    let variants = [];
    try { variants = Array.isArray(req.body.variants) ? req.body.variants : JSON.parse(req.body.variants || '[]'); }
    catch { variants = []; }

    // Delete all existing, then recreate
    await prisma.productVariant.deleteMany({ where: { productId } });

    if (variants.length > 0) {
      await prisma.productVariant.createMany({
        data: variants
          .filter((v) => v.name?.trim() && Number(v.price) >= 0)
          .map((v, i) => ({
            productId,
            name:        v.name.trim(),
            price:       Number(v.price),
            isAvailable: v.isAvailable !== false,
            sortOrder:   i,
          })),
      });
    }

    const product = await prisma.product.findUnique({
      where:   { id: productId },
      include: WITH_VARIANTS_ADMIN,
    });
    return success(res, { product }, 'Variants updated.');
  } catch (err) {
    console.error('[setVariants]', err);
    return error(res, 'Failed to update variants.', 500);
  }
};

module.exports = {
  getProducts, getProduct,
  createProduct, updateProduct, deleteProduct,
  toggleAvailability, toggleFeatured,
  addVariant, updateVariant, deleteVariant, setVariants,
};
