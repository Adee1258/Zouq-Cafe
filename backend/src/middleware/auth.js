// Authentication & authorization middleware
const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');
const prisma = require('../config/prisma');

/**
 * Protects routes — requires a valid Bearer token.
 * Attaches req.user = { id, role } on success.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Not authenticated. Please log in.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token); // throws if expired/invalid

    // Fetch fresh user from DB (catches deleted/suspended accounts)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, name: true, email: true, phone: true },
    });

    if (!user) {
      return error(res, 'User no longer exists.', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Session expired. Please log in again.', 401);
    }
    return error(res, 'Invalid token.', 401);
  }
};

/**
 * Restricts route to ADMIN role only.
 * Must be used after `protect`.
 */
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return error(res, 'Access denied. Admins only.', 403);
  }
  next();
};

module.exports = { protect, adminOnly };
