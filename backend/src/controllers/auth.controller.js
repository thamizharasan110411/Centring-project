const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { verifyCredentials, signToken } = require('../services/auth.service');

/**
 * POST /api/auth/login
 * Single admin login. Credentials come from ADMIN_USERNAME / ADMIN_PASSWORD.
 */
const login = asyncHandler(async (req, res) => {
  const { username = '', password = '' } = req.body || {};
  if (!username || !password) {
    throw new ApiError(400, 'Username and password are required.');
  }
  if (!verifyCredentials(username, password)) {
    throw new ApiError(401, 'Invalid username or password.');
  }
  const admin = { username };
  const token = signToken(admin);
  res.json({ success: true, data: { token, admin } });
});

/**
 * GET /api/auth/me
 * Returns the current admin for an already-validated token.
 */
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { username: req.admin.username, role: req.admin.role } });
});

module.exports = { login, me };