const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');
const { toNum } = require('../utils/money');
const { parseDateInput, todayStart } = require('../utils/dates');
const {
  assert,
  asPositiveInt,
  asPositiveNumber,
  asEnum,
  optionalString,
} = require('../utils/validation');
const { recomputeRentalTotals, enrichRental } = require('./totals.service');

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD'];

const PAYMENT_INCLUDE = {
  rental: {
    include: {
      customer: true,
      invoice: { select: { invoiceNumber: true, grandTotal: true, balanceAmount: true, status: true } },
    },
  },
};

async function listPayments({ page = 1, limit = 10, method, rentalId, search } = {}) {
  const where = {};
  if (method) where.paymentMethod = method;
  if (rentalId) where.rentalId = Number(rentalId);
  if (search) {
    where.OR = [
      { referenceNumber: { contains: search, mode: 'insensitive' } },
      { rental: { rentalNumber: { contains: search, mode: 'insensitive' } } },
      { rental: { customer: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  const take = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: PAYMENT_INCLUDE,
      orderBy: { paymentDate: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    data: payments,
    meta: { page: Math.max(Number(page) || 1, 1), limit: take, total, totalPages: Math.ceil(total / take) },
  };
}

/** Record a payment against a rental and update invoice/balance in one transaction. */
async function recordPayment(body) {
  const rentalId = asPositiveInt(body.rentalId, 'Rental id');
  const amount = asPositiveNumber(body.amount, 'Payment amount');
  const paymentMethod = asEnum(body.paymentMethod || 'CASH', PAYMENT_METHODS, 'Payment method');

  const paymentDate = body.paymentDate
    ? parseDateInput(body.paymentDate) || todayStart()
    : todayStart();

  const rental = await prisma.rental.findUnique({ where: { id: rentalId } });
  if (!rental) throw new ApiError(404, 'Rental not found');
  assert(
    !['CLOSED'].includes(rental.status),
    'This rental is closed. Cannot record further payments.',
    400
  );

  const created = await prisma.$transaction(async (tx) => {
    // Refresh overdue/totals first so the balance is current, then never
    // allow a payment that exceeds the outstanding balance.
    await recomputeRentalTotals(tx, rentalId);
    const fresh = await tx.rental.findUnique({ where: { id: rentalId }, select: { balanceAmount: true } });
    assert(
      toNum(fresh.balanceAmount) > 0 && amount <= toNum(fresh.balanceAmount) + 0.001,
      `Payment amount (${amount}) cannot exceed the outstanding balance (${toNum(fresh.balanceAmount)}).`,
      400
    );

    const payment = await tx.payment.create({
      data: {
        rentalId,
        paymentDate,
        amount,
        paymentMethod,
        referenceNumber: optionalString(body.referenceNumber),
        notes: optionalString(body.notes),
      },
    });
    await recomputeRentalTotals(tx, rentalId);
    return payment;
  });

  const updatedRental = await prisma.rental.findUnique({
    where: { id: rentalId },
    include: {
      customer: true,
      items: { include: { asset: true } },
      payments: { orderBy: { paymentDate: 'desc' } },
      returns: { include: { items: true } },
      invoice: true,
    },
  });

  return {
    payment: created,
    rental: enrichRental(updatedRental),
    totalPaid: toNum(updatedRental.invoice?.paidAmount || 0),
    balance: toNum(updatedRental.invoice?.balanceAmount || 0),
  };
}

module.exports = { listPayments, recordPayment, PAYMENT_METHODS };