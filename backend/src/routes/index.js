const { Router } = require('express');
const router = Router();

const authRoutes = require('./auth.routes');
const customerRoutes = require('./customer.routes');
const assetRoutes = require('./asset.routes');
const rentalRoutes = require('./rental.routes');
const paymentRoutes = require('./payment.routes');
const invoiceRoutes = require('./invoice.routes');
const reportRoutes = require('./report.routes');
const { requireAuth } = require('../middleware/auth.middleware');

// Public: health check and admin login.
router.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }));
router.use('/auth', authRoutes);

// Everything below requires a valid admin token.
router.use(requireAuth);

router.use('/customers', customerRoutes);
router.use('/assets', assetRoutes);
router.use('/rentals', rentalRoutes);
router.use('/payments', paymentRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/reports', reportRoutes);

module.exports = router;