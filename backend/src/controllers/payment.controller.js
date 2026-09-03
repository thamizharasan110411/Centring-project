const paymentService = require('../services/payment.service');
const asyncHandler = require('../utils/asyncHandler');

const listPayments = asyncHandler(async (req, res) => {
  const result = await paymentService.listPayments(req.query);
  res.json({ success: true, ...result });
});

const recordPayment = asyncHandler(async (req, res) => {
  const data = await paymentService.recordPayment(req.body);
  res.status(201).json({ success: true, data });
});

module.exports = { listPayments, recordPayment };