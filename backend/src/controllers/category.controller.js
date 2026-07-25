// Category controller — public read + admin write
const prisma = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── GET /api/categories ──────────────────────────────────────────────────────
// Public: list all categories (with product count)
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { isAvailable: true } } } },
      },
    });
    return success(res, { categories });
  } catch (err) {
    console.error('[getCategories]', err);
    return error(res, 'Failed to fetch categories.', 500);
  }
};

// ─── GET /api/categories/:id ──────────────────────────────────────────────────
const getCategory = async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!category) return error(res, 'Category not found.', 404);
    return success(res, { category });
  } catch (err) {
    return error(res, 'Failed to fetch category.', 500);
  }
};

// ─── POST /api/categories (admin) ────────────────────────────────────────────
const createCategory = async (req, res) => {
  try {
    const { name, sortOrder } = req.body;
    const imageUrl = req.file?.path || null; // Cloudinary URL from multer

    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) return error(res, 'Category name already exists.', 409);

    const category = await prisma.category.create({
      data: { name, imageUrl, sortOrder: sortOrder ? Number(sortOrder) : 0 },
    });
    return success(res, { category }, 'Category created.', 201);
  } catch (err) {
    console.error('[createCategory]', err);
    return error(res, 'Failed to create category.', 500);
  }
};

// ─── PATCH /api/categories/:id (admin) ───────────────────────────────────────
const updateCategory = async (req, res) => {
  try {
    const { name, sortOrder } = req.body;
    const imageUrl = req.file?.path || undefined;

    const data = {};
    if (name) data.name = name;
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);
    if (imageUrl) data.imageUrl = imageUrl;

    const category = await prisma.category.update({
      where: { id: Number(req.params.id) },
      data,
    });
    return success(res, { category }, 'Category updated.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Category not found.', 404);
    return error(res, 'Failed to update category.', 500);
  }
};

// ─── DELETE /api/categories/:id (admin) ──────────────────────────────────────
const deleteCategory = async (req, res) => {
  try {
    // Check if products exist under this category
    const count = await prisma.product.count({
      where: { categoryId: Number(req.params.id) },
    });
    if (count > 0) {
      return error(res, `Cannot delete — ${count} product(s) are in this category. Move or delete them first.`, 400);
    }

    await prisma.category.delete({ where: { id: Number(req.params.id) } });
    return success(res, {}, 'Category deleted.');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Category not found.', 404);
    return error(res, 'Failed to delete category.', 500);
  }
};

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
