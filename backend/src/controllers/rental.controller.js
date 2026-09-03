const rentalService = require('../services/rental.service');
const asyncHandler = require('../utils/asyncHandler');

const listRentals = asyncHandler(async (req, res) => {
  const result = await rentalService.listRentals(req.query);
  res.json({ success: true, ...result });
});

const getRental = asyncHandler(async (req, res) => {
  const data = await rentalService.getRental(req.params.id);
  res.json({ success: true, data });
});

const createRental = asyncHandler(async (req, res) => {
  const data = await rentalService.createRental(req.body);
  res.status(201).json({ success: true, data });
});

const updateRental = asyncHandler(async (req, res) => {
  const data = await rentalService.updateRental(req.params.id, req.body);
  res.json({ success: true, data });
});

const closeRental = asyncHandler(async (req, res) => {
  const data = await rentalService.closeRental(req.params.id);
  res.json({ success: true, data });
});

const getReminder = asyncHandler(async (req, res) => {
  const data = await rentalService.getReminder(req.params.id);
  res.json({ success: true, data });
});

const listOverdue = asyncHandler(async (req, res) => {
  const data = await rentalService.listOverdueRentals();
  res.json({ success: true, data });
});

module.exports = {
  listRentals,
  getRental,
  createRental,
  updateRental,
  closeRental,
  getReminder,
  listOverdue,
};