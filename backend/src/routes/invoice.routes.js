const { Router } = require('express');
const router = Router();
const ctrl = require('../controllers/invoice.controller');

router.get('/', ctrl.listInvoices);
router.get('/rental/:rentalId', ctrl.getInvoiceByRental);
router.get('/:id', ctrl.getInvoice);

module.exports = router;