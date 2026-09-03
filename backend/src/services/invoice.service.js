const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');
const { asPositiveInt } = require('../utils/validation');
const { refreshAllOverdue, enrichRental } = require('./totals.service');

const INVOICE_INCLUDE = {
  rental: {
    include: {
      customer: true,
      items: { include: { asset: true } },
      payments: { orderBy: { paymentDate: 'asc' } },
      returns: { include: { items: true }, orderBy: { returnDate: 'desc' } },
    },
  },
};

async function listInvoices({ page = 1, limit = 10, status, search } = {}) {
  await refreshAllOverdue(prisma);
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { rental: { rentalNumber: { contains: search, mode: 'insensitive' } } },
      { rental: { customer: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  const take = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { rental: { include: { customer: true } } },
      orderBy: { id: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    data: invoices,
    meta: { page: Math.max(Number(page) || 1, 1), limit: take, total, totalPages: Math.ceil(total / take) },
  };
}

async function getInvoice(id) {
  const invoiceId = asPositiveInt(id, 'Invoice id');
  await refreshAllOverdue(prisma);
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: INVOICE_INCLUDE,
  });
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  return { ...invoice, rental: enrichRental(invoice.rental) };
}

/** Look up the invoice for a rental. */
async function getInvoiceByRental(rentalId) {
  await refreshAllOverdue(prisma);
  const invoice = await prisma.invoice.findFirst({
    where: { rentalId: asPositiveInt(rentalId, 'Rental id') },
    include: INVOICE_INCLUDE,
  });
  if (!invoice) throw new ApiError(404, 'No invoice found for this rental.');
  return { ...invoice, rental: enrichRental(invoice.rental) };
}

module.exports = { listInvoices, getInvoice, getInvoiceByRental };