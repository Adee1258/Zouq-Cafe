// JWT utility — sign and verify tokens
const jwt = require('jsonwebtoken');

/**
 * Signs a JWT token for a user.
 * @param {object} payload - { id, role }
 * @returns {string} signed token
 */
const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Verifies a JWT token.
 * @param {string} token
 * @returns {object} decoded payload or throws
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { signToken, verifyToken };
