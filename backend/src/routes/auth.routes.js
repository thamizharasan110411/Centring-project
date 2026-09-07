const { Router } = require('express');
const { login, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { loginRateLimit } = require('../middleware/rateLimit');

const router = Router();

// Public: login (rate-limited). Protected: token validation.
router.post('/login', loginRateLimit, login);
router.get('/me', requireAuth, me);

module.exports = router;