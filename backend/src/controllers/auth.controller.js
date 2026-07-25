const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { signToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');

// ── Normalize phone — strip spaces, dashes, brackets ─────────────────────────
const normalizePhone = (phone) => {
  if (!phone) return null;
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned || null;
};

// ── Normalize email — lowercase and trim ─────────────────────────────────────
const normalizeEmail = (email) => {
  if (!email) return null;
  return email.toLowerCase().trim() || null;
};

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
const signup = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    if (!name || !name.trim()) {
      return error(res, 'Name is required.', 400);
    }

    if (!email && !phone) {
      return error(res, 'Email or phone number is required.', 400);
    }

    if (!password || password.length < 6) {
      return error(res, 'Password must be at least 6 characters.', 400);
    }

    // Check duplicate email
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return error(res, 'This email is already registered. Please login.', 409);
    }

    // Check duplicate phone (normalized)
    if (phone) {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) return error(res, 'This phone number is already registered. Please login.', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const address = req.body.address ? req.body.address.trim() : null;

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email,
        phone,
        passwordHash,
        address,
        role: 'CUSTOMER',
      },
      select: { id: true, name: true, email: true, phone: true, role: true, address: true },
    });

    const token = signToken({ id: user.id, role: user.role });
    return success(res, { user, token }, 'Account created successfully.', 201);
  } catch (err) {
    console.error('[signup]', err);
    // Prisma unique constraint violation
    if (err.code === 'P2002') {
      const field = err.meta?.target?.includes('email') ? 'Email' : 'Phone number';
      return error(res, `${field} is already registered. Please login.`, 409);
    }
    return error(res, 'Failed to create account. Please try again.', 500);
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const { password } = req.body;

    if (!email && !phone) {
      return error(res, 'Email or phone number is required.', 400);
    }

    if (!password) {
      return error(res, 'Password is required.', 400);
    }

    const user = await prisma.user.findFirst({
      where: email ? { email } : { phone },
    });

    if (!user) {
      return error(res, 'No account found with these credentials.', 401);
    }

    // Block admin accounts from logging in via customer portal
    if (user.role === 'ADMIN') {
      return error(res, 'Admin accounts must login via the admin portal.', 403);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return error(res, 'Incorrect password.', 401);
    }

    const token = signToken({ id: user.id, role: user.role });
    return success(res, {
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, address: user.address },
      token,
    }, 'Logged in successfully.');
  } catch (err) {
    console.error('[login]', err);
    return error(res, 'Login failed. Please try again.', 500);
  }
};

// ─── POST /api/auth/admin/login ───────────────────────────────────────────────
const adminLogin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email) return error(res, 'Email is required.', 400);
    if (!password) return error(res, 'Password is required.', 400);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'ADMIN') {
      return error(res, 'Invalid admin credentials.', 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return error(res, 'Invalid admin credentials.', 401);
    }

    const token = signToken({ id: user.id, role: user.role });
    return success(res, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    }, 'Admin logged in successfully.');
  } catch (err) {
    console.error('[adminLogin]', err);
    return error(res, 'Login failed.', 500);
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, phone: true, address: true, role: true, createdAt: true },
    });
    if (!user) return error(res, 'User not found.', 404);
    return success(res, { user });
  } catch (err) {
    console.error('[getMe]', err);
    return error(res, 'Failed to fetch profile.', 500);
  }
};

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────
const updateMe = async (req, res) => {
  try {
    const { name, address } = req.body;

    // Only normalize phone if it was actually sent
    const rawPhone = req.body.phone;
    const phone = rawPhone !== undefined ? normalizePhone(rawPhone) : undefined;

    // Check phone conflict only if a NEW phone is being set
    if (phone) {
      const existing = await prisma.user.findFirst({
        where: { phone, NOT: { id: req.user.id } },
      });
      if (existing) return error(res, 'This phone number is already used by another account.', 409);
    }

    const updateData = {};
    if (name && name.trim()) updateData.name = name.trim();
    if (address !== undefined) updateData.address = address?.trim() || null;
    // Only update phone if it was explicitly provided in request
    if (phone !== undefined) updateData.phone = phone || null;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, address: true, role: true },
    });

    return success(res, { user }, 'Profile updated.');
  } catch (err) {
    console.error('[updateMe]', err);
    if (err.code === 'P2002') return error(res, 'Phone number already in use by another account.', 409);
    return error(res, 'Failed to update profile.', 500);
  }
};

// ─── PATCH /api/auth/me/password ─────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return error(res, 'Current and new password are required.', 400);
    }
    if (newPassword.length < 6) {
      return error(res, 'New password must be at least 6 characters.', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return error(res, 'User not found.', 404);

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return error(res, 'Current password is incorrect.', 401);

    if (currentPassword === newPassword) {
      return error(res, 'New password must be different from current password.', 400);
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newHash },
    });

    return success(res, null, 'Password changed successfully.');
  } catch (err) {
    console.error('[changePassword]', err);
    return error(res, 'Failed to change password.', 500);
  }
};

module.exports = { signup, login, adminLogin, getMe, updateMe, changePassword };
