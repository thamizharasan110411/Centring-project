/* System/maintenance routes.
 * POST /api/system/clean-db — wipes all business data (schema + login stay).
 * Protected by CRON_SECRET (Vercel cron jobs send it as `Authorization: Bearer <CRON_SECRET>`).
 * Can be disabled entirely with AUTO_CLEAN_ENABLED=false.
 */
const { Router } = require('express');
const { resetAllData } = require('../services/reset.service');

const router = Router();

router.post('/clean-db', async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (!secret || token !== secret) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (process.env.AUTO_CLEAN_ENABLED === 'false') {
      return res.status(403).json({ success: false, error: 'Auto clean is disabled' });
    }

    const deleted = await resetAllData();
    return res.json({ success: true, data: { message: 'Database cleaned', deleted } });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;