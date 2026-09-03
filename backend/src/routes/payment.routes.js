const { Router } = require('express');
const router = Router();
const ctrl = require('../controllers/payment.controller');

router.get('/', ctrl.listPayments);
router.post('/', ctrl.recordPayment);

module.exports = router;