const returnService = require('../services/return.service');
const asyncHandler = require('../utils/asyncHandler');

const processReturn = asyncHandler(async (req, res) => {
  const data = await returnService.processReturn(req.params.id, req.body);
  res.status(201).json({ success: true, data });
});

module.exports = { processReturn };