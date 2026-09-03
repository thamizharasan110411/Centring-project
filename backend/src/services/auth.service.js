const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Single admin account, configured via environment variables.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'centering-erp-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function verifyCredentials(username, password) {
  if (!safeEqual(username, ADMIN_USERNAME)) return false;
  return safeEqual(password, ADMIN_PASSWORD);
}

function signToken(admin) {
  return jwt.sign({ sub: admin.username, role: 'admin' }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { verifyCredentials, signToken, verifyToken };