const prisma = require('../prisma');
const { toNum, round2 } = require('../utils/money');
const { parseDateInput, todayStart, startOfWeek, startOfMonth } = require('../utils/dates');
const { refreshAllOverdue, remainingQty } = require('./totals.service');

/** Resolve a from/to date range from a filter key (today/week/month) or explicit dates. */
function resolveRange({ range, from, to }) {
  const today = todayStart();
  let start = null;
  let end = null;
  if (range === 'today') {
    start = today;
    end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  } else if (range === 'week') {
    start = startOfWeek(today);
    end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  } else if (range === 'month') {
    start = startOfMonth(today);
    end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  } else {
    if (from) start = parseDateInput(from);
    if (to) {
      const parsed = parseDateInput(to);
      if (parsed) end = new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
    }
  }
  return { start, end };
}

function betweenWhere(field, { start, end }) {
  const where = {};
  if (start) where[field] = { gte: start };
  if (end) where[field] = { ...(where[field] || {}), lt: end };
  return where;
}

async function getDashboard() {
  await refreshAllOverdue(prisma);

  const [
    assetAgg,
    customerCount,
    activeCount,
    overdueCount,
    rentalBalanceAgg,
    paymentsAgg,
    recentRentals,
    overdueRentals,
    recentPayments,
    topAssets,
  ] = await Promise.all([
    prisma.asset.aggregate({
      _count: { _all: true },
      _sum: { totalQuantity: true, availableQuantity: true },
    }),
    prisma.customer.count(),
    prisma.rental.count({ where: { status: { in: ['ACTIVE', 'PARTIALLY_RETURNED'] } } }),
    prisma.rental.count({ where: { status: 'OVERDUE' } }),
    prisma.rental.aggregate({
      where: { balanceAmount: { gt: 0 }, status: { not: 'CLOSED' } },
      _sum: { balanceAmount: true },
    }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.rental.findMany({
      include: { customer: true },
      orderBy: { id: 'desc' },
      take: 6,
    }),
    prisma.rental.findMany({
      where: { status: 'OVERDUE' },
      include: { customer: true, items: { include: { asset: true } } },
      orderBy: { dueDate: 'asc' },
      take: 6,
    }),
    prisma.payment.findMany({
      include: { rental: { include: { customer: true } } },
      orderBy: { paymentDate: 'desc' },
      take: 6,
    }),
    prisma.rentalItem.groupBy({
      by: ['assetId'],
      _sum: { rentedQuantity: true, damagedQuantity: true, missingQuantity: true },
      orderBy: { _sum: { rentedQuantity: 'desc' } },
      take: 5,
    }),
  ]);

  const totalQuantity = toNum(assetAgg._sum.totalQuantity);
  const availableQuantity = toNum(assetAgg._sum.availableQuantity);

  const assetIds = topAssets.map((t) => t.assetId);
  const assets = assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: assetIds } } })
    : [];
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const topRentedAssets = topAssets.map((t) => ({
    assetId: t.assetId,
    assetCode: assetMap.get(t.assetId)?.assetCode || '',
    name: assetMap.get(t.assetId)?.name || 'Unknown',
    unit: assetMap.get(t.assetId)?.unit || '',
    rentedQuantity: toNum(t._sum.rentedQuantity),
    damagedQuantity: toNum(t._sum.damagedQuantity),
    missingQuantity: toNum(t._sum.missingQuantity),
  }));

  const overdueRows = [];
  for (const r of overdueRentals) {
    const remaining = (r.items || []).reduce((s, it) => s + Math.max(0, remainingQty(it)), 0);
    overdueRows.push({
      id: r.id,
      rentalNumber: r.rentalNumber,
      customerName: r.customer.name,
      mobile: r.customer.mobile,
      remainingQuantity: remaining,
      dueDate: r.dueDate,
      balanceAmount: r.balanceAmount,
      overdueCharge: r.overdueCharge,
    });
  }

  return {
    cards: {
      totalAssets: assetAgg._count._all,
      availableAssets: availableQuantity,
      rentedAssets: Math.max(0, totalQuantity - availableQuantity),
      totalCustomers: customerCount,
      activeRentals: activeCount,
      overdueRentals: overdueCount,
      pendingPayments: round2(toNum(rentalBalanceAgg._sum.balanceAmount)),
      totalRevenue: round2(toNum(paymentsAgg._sum.amount)),
    },
    recentRentals,
    overdueRentals: overdueRows,
    recentPayments,
    topRentedAssets,
  };
}

async function getRevenueReport({ range, from, to }) {
  const { start, end } = resolveRange({ range, from, to });
  const where = betweenWhere('paymentDate', { start, end });

  const [payments, invoiceAgg] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { rental: { include: { customer: true } } },
      orderBy: { paymentDate: 'desc' },
    }),
    prisma.invoice.aggregate({
      _sum: { paidAmount: true, balanceAmount: true, grandTotal: true },
    }),
  ]);

  const totalRevenue = round2(payments.reduce((s, p) => s + toNum(p.amount), 0));
  return {
    range,
    from: start,
    to: end,
    summary: {
      totalRevenue,
      paidAmount: round2(toNum(invoiceAgg._sum.paidAmount)),
      pendingAmount: round2(toNum(invoiceAgg._sum.balanceAmount)),
      totalBilled: round2(toNum(invoiceAgg._sum.grandTotal)),
      paymentCount: payments.length,
    },
    payments,
  };
}

async function getRentalReport({ range, from, to }) {
  const { start, end } = resolveRange({ range, from, to });
  const where = betweenWhere('rentalDate', { start, end });

  const [rentals, agg] = await Promise.all([
    prisma.rental.findMany({
      where,
      include: { customer: true },
      orderBy: { rentalDate: 'desc' },
    }),
    prisma.rental.aggregate({
      where,
      _sum: { grandTotal: true, balanceAmount: true },
    }),
  ]);

  const byStatus = { ACTIVE: 0, PARTIALLY_RETURNED: 0, RETURNED: 0, OVERDUE: 0, CLOSED: 0 };
  for (const r of rentals) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  return {
    range,
    from: start,
    to: end,
    summary: {
      total: rentals.length,
      active: byStatus.ACTIVE + byStatus.PARTIALLY_RETURNED,
      partiallyReturned: byStatus.PARTIALLY_RETURNED,
      returned: byStatus.RETURNED,
      overdue: byStatus.OVERDUE,
      closed: byStatus.CLOSED,
      totalBilled: round2(toNum(agg._sum.grandTotal)),
      totalOutstanding: round2(toNum(agg._sum.balanceAmount)),
    },
    rentals,
  };
}

async function getAssetReport({ range, from, to }) {
  const { start, end } = resolveRange({ range, from, to });
  const itemsWhere = {};
  if (start || end) {
    itemsWhere.rental = betweenWhere('rentalDate', { start, end });
  }

  const [items, assets] = await Promise.all([
    prisma.rentalItem.findMany({
      where: itemsWhere,
      include: { asset: true },
    }),
    prisma.asset.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const byAsset = new Map();
  for (const item of items) {
    const entry = byAsset.get(item.assetId) || { rented: 0, damaged: 0, missing: 0, revenue: 0 };
    entry.rented += toNum(item.rentedQuantity);
    entry.damaged += toNum(item.damagedQuantity);
    entry.missing += toNum(item.missingQuantity);
    entry.revenue += toNum(item.amount);
    byAsset.set(item.assetId, entry);
  }

  const data = assets
    .map((a) => {
      const usage = byAsset.get(a.id) || { rented: 0, damaged: 0, missing: 0, revenue: 0 };
      return {
        id: a.id,
        assetCode: a.assetCode,
        name: a.name,
        category: a.category,
        unit: a.unit,
        totalQuantity: a.totalQuantity,
        availableQuantity: a.availableQuantity,
        rentedQuantity: Math.max(0, a.totalQuantity - a.availableQuantity),
        timesRented: usage.rented,
        damagedQuantity: usage.damaged,
        missingQuantity: usage.missing,
        rentalRevenue: round2(usage.revenue),
      };
    })
    .sort((x, y) => y.timesRented - x.timesRented);

  return { range, from: start, to: end, data };
}

async function getCustomerReport({ range, from, to }) {
  const { start, end } = resolveRange({ range, from, to });
  const rentalWhere = betweenWhere('rentalDate', { start, end });

  const customers = await prisma.customer.findMany({
    include: {
      rentals: {
        where: rentalWhere,
        include: { payments: { select: { amount: true } }, invoice: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const data = customers
    .map((c) => {
      let rentals = 0;
      let billed = 0;
      let paid = 0;
      let outstanding = 0;
      for (const r of c.rentals) {
        rentals += 1;
        billed += toNum(r.grandTotal);
        paid += (r.payments || []).reduce((s, p) => s + toNum(p.amount), 0);
      }
      outstanding = round2(billed - paid);
      return {
        id: c.id,
        customerCode: c.customerCode,
        name: c.name,
        mobile: c.mobile,
        projectName: c.projectName,
        rentals,
        totalBilled: round2(billed),
        totalPaid: round2(paid),
        outstandingAmount: round2(outstanding),
      };
    })
    .filter((r) => r.rentals > 0 || r.outstandingAmount > 0)
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount);

  const summary = data.reduce(
    (acc, r) => {
      acc.rentals += r.rentals;
      acc.totalBilled = round2(acc.totalBilled + r.totalBilled);
      acc.totalPaid = round2(acc.totalPaid + r.totalPaid);
      acc.outstandingAmount = round2(acc.outstandingAmount + r.outstandingAmount);
      return acc;
    },
    { rentals: 0, totalBilled: 0, totalPaid: 0, outstandingAmount: 0 }
  );

  return { range, from: start, to: end, summary, data };
}

module.exports = {
  getDashboard,
  getRevenueReport,
  getRentalReport,
  getAssetReport,
  getCustomerReport,
};