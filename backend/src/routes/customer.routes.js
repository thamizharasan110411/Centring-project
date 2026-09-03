const { Router } = require('express');
const router = Router();
const ctrl = require('../controllers/customer.controller');

router.get('/', ctrl.listCustomers);
router.post('/', ctrl.createCustomer);
router.get('/:id', ctrl.getCustomer);
router.put('/:id', ctrl.updateCustomer);
router.delete('/:id', ctrl.deleteCustomer);

module.exports = router;