const assetService = require('../services/asset.service');
const asyncHandler = require('../utils/asyncHandler');

const listAssets = asyncHandler(async (req, res) => {
  const result = await assetService.listAssets(req.query);
  res.json({ success: true, ...result });
});

const getAsset = asyncHandler(async (req, res) => {
  const data = await assetService.getAsset(req.params.id);
  res.json({ success: true, data });
});

const createAsset = asyncHandler(async (req, res) => {
  const data = await assetService.createAsset(req.body);
  res.status(201).json({ success: true, data });
});

const updateAsset = asyncHandler(async (req, res) => {
  const data = await assetService.updateAsset(req.params.id, req.body);
  res.json({ success: true, data });
});

const deleteAsset = asyncHandler(async (req, res) => {
  const data = await assetService.deleteAsset(req.params.id);
  res.json({ success: true, data });
});

const listCategories = asyncHandler(async (req, res) => {
  const data = await assetService.listCategories();
  res.json({ success: true, data });
});

module.exports = {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  listCategories,
};