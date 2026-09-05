const reportService = require('../services/report.service');
const asyncHandler = require('../utils/asyncHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await reportService.getDashboard();
  res.json({ success: true, data });
});

const getRevenueReport = asyncHandler(async (req, res) => {
  const data = await reportService.getRevenueReport(req.query);
  res.json({ success: true, data });
});

const getRentalReport = asyncHandler(async (req, res) => {
  const data = await reportService.getRentalReport(req.query);
  res.json({ success: true, data });
});

const getAssetReport = asyncHandler(async (req, res) => {
  const data = await reportService.getAssetReport(req.query);
  res.json({ success: true, data });
});

const getCustomerReport = asyncHandler(async (req, res) => {
  const data = await reportService.getCustomerReport(req.query);
  res.json({ success: true, data });
});

const getMonthlyReport = asyncHandler(async (req, res) => {
  const data = await reportService.getMonthlyReport(req.query);
  res.json({ success: true, data });
});

module.exports = {
  getDashboard,
  getRevenueReport,
  getRentalReport,
  getAssetReport,
  getCustomerReport,
  getMonthlyReport,
};