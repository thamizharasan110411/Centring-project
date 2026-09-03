const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');
const { nextCode } = require('../utils/numbers');
const { toNum, round2 } = require('../utils/money');
const { refreshAllOverdue } = require('./totals.service');
const {
  assert,
  requiredString,
  optionalString,
  asPositiveInt,
} = require('../utils/validation');

const CUSTOMER_INCLUDE = {
  rentals: {
    select: {
      id: true,
      rentalNumber: true,
      rentalDate: true,
      dueDate: true,
      returnDate: true,
      status: true,
      grandTotal: true,
      balanceAmount: true,
      payments: { select: { amount: true } },
    },
    orderBy: { id: 'desc' },
  },
};

function customerStats(customer) {
  const rentals = customer.rentals || [];
  let totalRentalAmount = 0;
  let totalPaid = 0;
  let outstanding = 0;
  let activeCount = 0;
  let previousCount = 0;
  const pending = [];

  for (const r of rentals) {
    const billed = toNum(r.grandTotal);
    const paid = (r.payments || []).reduce((s, p) => s + toNum(p.amount), 0);
    const bal = round2(billed - paid);
    totalRentalAmount = round2(totalRentalAmount + billed);
    totalPaid = round2(totalPaid + paid);
    outstanding = round2(outstanding + bal);
    if (['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE'].includes(r.status)) activeCount += 1;
    else previousCount += 1;
    if (bal > 0) {
      pending.push({ ...r, paidAmount: round2(paid), balanceAmount: bal });
    }
  }

  return {
    totalRentals: rentals.length,
    activeRentals: activeCount,
    previousRentals: previousCount,
    totalRentalAmount: round2(totalRentalAmount),
    totalPaidAmount: round2(totalPaid),
    outstandingAmount: round2(outstanding),
    pendingPayments: pending,
  };
}

function sanitize(body) {
  return {
    name: requiredString(body.name, 'Name'),
    mobile: requiredString(body.mobile, 'Mobile'),
    alternateMobile: optionalString(body.alternateMobile),
    address: optionalString(body.address),
    projectName: optionalString(body.projectName),
    projectAddress: optionalString(body.projectAddress),
    notes: optionalString(body.notes),
  };
}

async function listCustomers({ page = 1, limit = 10, search } = {}) {
  await refreshAllOverdue(prisma);
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { customerCode: { contains: search, mode: 'insensitive' } },
      { mobile: { contains: search } },
      { projectName: { contains: search, mode: 'insensitive' } },
    ];
  }
  const take = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: CUSTOMER_INCLUDE,
      orderBy: { id: 'desc' },
      skip,
      take,
    }),
  ]);

  const data = customers.map((c) => ({ ...c, stats: customerStats(c) }));
  return { data, meta: { page: Math.max(Number(page) || 1, 1), limit: take, total, totalPages: Math.ceil(total / take) } };
}

async function getCustomer(id) {
  const customer = await prisma.customer.findUnique({
    where: { id: asPositiveInt(id, 'Customer id') },
    include: CUSTOMER_INCLUDE,
  });
  if (!customer) throw new ApiError(404, 'Customer not found');
  return { ...customer, stats: customerStats(customer) };
}

async function createCustomer(body) {
  const data = sanitize(body);
  const customerCode = await nextCode(prisma, 'customer', 'customerCode');
  return prisma.customer.create({ data: { ...data, customerCode } });
}

async function updateCustomer(id, body) {
  const customerId = asPositiveInt(id, 'Customer id');
  await prisma.customer.findUniqueOrThrow({ where: { id: customerId } }).catch(() => {
    throw new ApiError(404, 'Customer not found');
  });
  return prisma.customer.update({
    where: { id: customerId },
    data: sanitize(body),
  });
}

async function deleteCustomer(id) {
  const customerId = asPositiveInt(id, 'Customer id');
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { _count: { select: { rentals: true } } },
  });
  if (!customer) throw new ApiError(404, 'Customer not found');
  assert(
    customer._count.rentals === 0,
    'Cannot delete a customer with rental history. Delete their rentals first.',
    409
  );
  await prisma.customer.delete({ where: { id: customerId } });
  return { id: customerId, deleted: true };
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  customerStats,
};