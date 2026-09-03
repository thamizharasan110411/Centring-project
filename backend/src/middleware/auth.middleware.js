const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../services/auth.service');

/**
 * Protects API routes: requires a valid `Authorization: Bearer <token>` header.
 * On success attaches `req.admin` and continues; otherwise responds 401.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Authentication required. Please log in.'));
  }
  try {
    const payload = verifyToken(token);
    req.admin = { username: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(new ApiError(401, 'Session expired or invalid. Please log in again.'));
  }
}

module.exports = { requireAuth };