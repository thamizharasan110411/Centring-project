const { Router } = require('express');
const router = Router();
const ctrl = require('../controllers/asset.controller');

router.get('/', ctrl.listAssets);
router.post('/', ctrl.createAsset);
router.get('/categories', ctrl.listCategories);
router.get('/:id', ctrl.getAsset);
router.put('/:id', ctrl.updateAsset);
router.delete('/:id', ctrl.deleteAsset);

module.exports = router;