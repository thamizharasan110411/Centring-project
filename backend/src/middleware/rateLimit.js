/* Simple in-memory sliding-window rate limiter.
 * No external dependencies; used to harden the admin login endpoint against
 * brute-force attempts. On serverless (Vercel) the counter is per-instance,
 * which still raises the bar meaningfully; for strict global limits add a
 * Redis-backed limiter.
 */
const ApiError = require('../utils/ApiError');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

const attempts = new Map(); // ip -> [{ at }]

function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/** Throw 429 when the client has exceeded the allowed attempts in the window. */
function loginRateLimit(req, res, next) {
  const ip = clientIp(req);
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((e) => now - e.at < WINDOW_MS);

  if (list.length >= MAX_ATTEMPTS) {
    return next(new ApiError(429, 'Too many login attempts. Try again in 15 minutes.'));
  }

  // Only count FAILED attempts (response >= 400), so successful logins never
  // consume quota.
  const onFinish = () => {
    res.removeListener('finish', onFinish);
    if (res.statusCode >= 400) {
      list.push({ at: Date.now() });
      attempts.set(ip, list);

      // Best-effort cleanup so the map never grows unbounded.
      if (attempts.size > 10000) {
        for (const [key, entries] of attempts) {
          if (entries.every((e) => Date.now() - e.at >= WINDOW_MS)) attempts.delete(key);
        }
      }
    }
  };
  res.on('finish', onFinish);

  return next();
}

module.exports = { loginRateLimit };