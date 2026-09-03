const { Router } = require('express');
const router = Router();
const ctrl = require('../controllers/rental.controller');
const returnCtrl = require('../controllers/return.controller');

router.get('/', ctrl.listRentals);
router.post('/', ctrl.createRental);
router.get('/overdue', ctrl.listOverdue);
router.get('/:id', ctrl.getRental);
router.put('/:id', ctrl.updateRental);
router.post('/:id/return', returnCtrl.processReturn);
router.post('/:id/close', ctrl.closeRental);
router.get('/:id/reminder', ctrl.getReminder);

module.exports = router;