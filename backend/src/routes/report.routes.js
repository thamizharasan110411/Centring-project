const { Router } = require('express');
const router = Router();
const ctrl = require('../controllers/report.controller');

router.get('/dashboard', ctrl.getDashboard);
router.get('/revenue', ctrl.getRevenueReport);
router.get('/rentals', ctrl.getRentalReport);
router.get('/assets', ctrl.getAssetReport);
router.get('/customers', ctrl.getCustomerReport);
router.get('/monthly', ctrl.getMonthlyReport);

module.exports = router;