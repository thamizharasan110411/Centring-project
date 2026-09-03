const customerService = require('../services/customer.service');
const asyncHandler = require('../utils/asyncHandler');

const listCustomers = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomers(req.query);
  res.json({ success: true, ...result });
});

const getCustomer = asyncHandler(async (req, res) => {
  const data = await customerService.getCustomer(req.params.id);
  res.json({ success: true, data });
});

const createCustomer = asyncHandler(async (req, res) => {
  const data = await customerService.createCustomer(req.body);
  res.status(201).json({ success: true, data });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const data = await customerService.updateCustomer(req.params.id, req.body);
  res.json({ success: true, data });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const data = await customerService.deleteCustomer(req.params.id);
  res.json({ success: true, data });
});

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};