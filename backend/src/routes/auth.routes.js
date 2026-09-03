const { Router } = require('express');
const { login, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = Router();

// Public: login. Protected: token validation.
router.post('/login', login);
router.get('/me', requireAuth, me);

module.exports = router;