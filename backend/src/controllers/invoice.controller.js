const invoiceService = require('../services/invoice.service');
const asyncHandler = require('../utils/asyncHandler');

const listInvoices = asyncHandler(async (req, res) => {
  const result = await invoiceService.listInvoices(req.query);
  res.json({ success: true, ...result });
});

const getInvoice = asyncHandler(async (req, res) => {
  const data = await invoiceService.getInvoice(req.params.id);
  res.json({ success: true, data });
});

const getInvoiceByRental = asyncHandler(async (req, res) => {
  const data = await invoiceService.getInvoiceByRental(req.params.rentalId);
  res.json({ success: true, data });
});

module.exports = { listInvoices, getInvoice, getInvoiceByRental };