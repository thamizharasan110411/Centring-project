const { Prisma } = require('@prisma/client');
const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');
const { nextCode, withUniqueRetry } = require('../utils/numbers');
const { toNum, round2, formatINR } = require('../utils/money');
const { startOfDay, todayStart, dayDiff, formatDate } = require('../utils/dates');
const {
  assert,
  requiredString,
  optionalString,
  asPositiveInt,
  asPositiveNumber,
  asNonNegativeNumber,
  asDate,
} = require('../utils/validation');
const {
  refreshAllOverdue,
  recomputeRentalTotals,
  enrichRental,
  remainingQty,
} = require('./totals.service');

const RENTAL_INCLUDE = {
  customer: true,
  items: { include: { asset: true } },
  payments: { orderBy: { paymentDate: 'desc' } },
  returns: { include: { items: true }, orderBy: { returnDate: 'desc' } },
  invoice: true,
};

function rateTypeFactor(rateType) {
  if (rateType === 'PER_WEEK') return 7;
  if (rateType === 'PER_MONTH') return 30;
  return 1;
}

function itemAmount(quantity, rate, days, rateType) {
  const factor = rateTypeFactor(rateType);
  const billableDays = Math.max(1, Math.ceil(days / factor));
  return round2(quantity * rate * billableDays);
}

async function listRentals({ page = 1, limit = 10, search, status, customerId } = {}) {
  await refreshAllOverdue(prisma);
  const where = {};
  if (status) {
    const statuses = String(status).split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) where.status = statuses[0];
    else if (statuses.length > 1) where.status = { in: statuses };
  }
  if (customerId) where.customerId = Number(customerId);
  if (search) {
    where.OR = [
      { rentalNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { mobile: { contains: search } } },
    ];
  }
  const take = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, rentals] = await Promise.all([
    prisma.rental.count({ where }),
    prisma.rental.findMany({
      where,
      include: RENTAL_INCLUDE,
      orderBy: { id: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    data: rentals.map(enrichRental),
    meta: { page: Math.max(Number(page) || 1, 1), limit: take, total, totalPages: Math.ceil(total / take) },
  };
}

async function getRental(id) {
  const rentalId = asPositiveInt(id, 'Rental id');
  await refreshAllOverdue(prisma);
  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    include: RENTAL_INCLUDE,
  });
  if (!rental) throw new ApiError(404, 'Rental not found');
  return enrichRental(rental);
}

/** Validate item payloads against locked asset rows and return normalized items. */
function validateAndNormalizeItems(rawItems, lockedAssets) {
  assert(Array.isArray(rawItems) && rawItems.length > 0, 'At least one asset is required.', 400);

  const seen = new Set();
  return rawItems.map((raw) => {
    const assetId = asPositiveInt(raw.assetId, 'Asset id');
    assert(!seen.has(assetId), `Asset #${assetId} is listed more than once.`, 400);
    seen.add(assetId);

    const quantity = asPositiveInt(raw.quantity, 'Rental quantity');
    const days = asPositiveInt(raw.days, 'Rental days');
    const asset = lockedAssets.find((a) => a.id === assetId);
    assert(asset, 'One of the selected assets does not exist.', 400);
    assert(
      quantity <= toNum(asset.availableQuantity),
      `Only ${asset.availableQuantity} ${asset.unit}(s) of "${asset.name}" are available (requested ${quantity}).`,
      400
    );
    const rate = raw.rate === undefined || raw.rate === null || raw.rate === '' ? toNum(asset.rentalRate) : asPositiveNumber(raw.rate, 'Rental rate');
    const amount = itemAmount(quantity, rate, days, asset.rateType);
    return { assetId, quantity, days, rate: round2(rate), amount, rateType: asset.rateType };
  });
}

/**
 * Create a rental inside a single PostgreSQL transaction:
 *  1. validate + lock assets (SELECT ... FOR UPDATE)
 *  2. create Rental + RentalItems
 *  3. decrement Asset.availableQuantity
 *  4. create Invoice
 *  5. record advance payment
 * Any failure rolls the whole thing back — inventory can never drift.
 */
async function createRental(body) {
  const data = sanitizeRentalBody(body);
  return withUniqueRetry(() =>
    prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: data.customerId } });
      assert(customer, 'Selected customer does not exist.', 400);

      // Lock the assets being rented so concurrent rentals can't overbook.
      const lockedAssets = await tx.$queryRaw`
        SELECT id, name, unit, "availableQuantity", "rentalRate", "rateType"
        FROM "Asset"
        WHERE id IN (${Prisma.join(data.items.map((i) => i.assetId))})
        FOR UPDATE
      `;
      assert(
        lockedAssets.length === new Set(data.items.map((i) => i.assetId)).size,
        'One of the selected assets does not exist.',
        400
      );

      const items = validateAndNormalizeItems(data.items, lockedAssets);
      const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
      assert(
        data.advancePaid <= subtotal + data.transportCharge + data.otherCharge - data.discount,
        'Advance payment cannot exceed the grand total.',
        400
      );

      const rentalNumber = await nextCode(tx, 'rental', 'rentalNumber');
      const invoiceNumber = await nextCode(tx, 'invoice', 'invoiceNumber');

      const rental = await tx.rental.create({
        data: {
          rentalNumber,
          customerId: data.customerId,
          rentalDate: data.rentalDate,
          dueDate: data.dueDate,
          status: 'ACTIVE',
          subtotal,
          transportCharge: data.transportCharge,
          otherCharge: data.otherCharge,
          discount: data.discount,
          securityDeposit: data.securityDeposit,
          advancePaid: data.advancePaid,
          notes: data.notes,
          items: {
            create: items.map((it) => ({
              assetId: it.assetId,
              rentedQuantity: it.quantity,
              rentalRate: it.rate,
              rentalDays: it.days,
              amount: it.amount,
            })),
          },
        },
      });

      // Reduce inventory inside the same transaction.
      for (const it of items) {
        await tx.asset.update({
          where: { id: it.assetId },
          data: { availableQuantity: { decrement: it.quantity } },
        });
      }

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          rentalId: rental.id,
          invoiceDate: data.rentalDate,
        },
      });

      if (data.advancePaid > 0) {
        await tx.payment.create({
          data: {
            rentalId: rental.id,
            paymentDate: data.rentalDate,
            amount: data.advancePaid,
            paymentMethod: data.paymentMethod || 'CASH',
            notes: 'Advance payment',
          },
        });
      }

      // Now that rental + invoice + payment exist, recompute totals/status.
      await recomputeRentalTotals(tx, rental.id);
      return tx.rental.findUnique({ where: { id: rental.id }, include: RENTAL_INCLUDE });
    })
  ).then(enrichRental);
}

function sanitizeRentalBody(body) {
  const customerId = asPositiveInt(body.customerId, 'Customer');
  const rentalDate = asDate(body.rentalDate, 'Rental date');
  const dueDate = asDate(body.dueDate, 'Due date');
  assert(dueDate >= rentalDate, 'Due date cannot be before the rental date.', 400);

  const items = body.items;
  assert(Array.isArray(items) && items.length > 0, 'At least one asset must be selected.', 400);

  return {
    customerId,
    rentalDate,
    dueDate,
    items,
    transportCharge: asNonNegativeNumber(body.transportCharge ?? 0, 'Transport charge'),
    otherCharge: asNonNegativeNumber(body.otherCharge ?? 0, 'Other charge'),
    discount: asNonNegativeNumber(body.discount ?? 0, 'Discount'),
    securityDeposit: asNonNegativeNumber(body.securityDeposit ?? 0, 'Security deposit'),
    advancePaid: asNonNegativeNumber(body.advancePaid ?? 0, 'Advance payment'),
    paymentMethod: body.paymentMethod || 'CASH',
    notes: optionalString(body.notes),
  };
}

/** Edit rental-level fields (dates / charges / notes). Item edits are not
 *  allowed once created because they would require inventory reconciliation. */
async function updateRental(id, body) {
  const rentalId = asPositiveInt(id, 'Rental id');
  const rental = await prisma.rental.findUnique({ where: { id: rentalId }, include: { items: true } });
  if (!rental) throw new ApiError(404, 'Rental not found');
  assert(
    !['CLOSED', 'RETURNED'].includes(rental.status),
    `Cannot edit a ${rental.status.toLowerCase()} rental.`,
    400
  );

  return prisma.$transaction(async (tx) => {
    const rentalDate = body.rentalDate !== undefined ? asDate(body.rentalDate, 'Rental date') : rental.rentalDate;
    const dueDate = body.dueDate !== undefined ? asDate(body.dueDate, 'Due date') : rental.dueDate;
    assert(dueDate >= rentalDate, 'Due date cannot be before the rental date.', 400);

    await tx.rental.update({
      where: { id: rentalId },
      data: {
        rentalDate,
        dueDate,
        transportCharge: body.transportCharge !== undefined ? asNonNegativeNumber(body.transportCharge, 'Transport charge') : rental.transportCharge,
        otherCharge: body.otherCharge !== undefined ? asNonNegativeNumber(body.otherCharge, 'Other charge') : rental.otherCharge,
        discount: body.discount !== undefined ? asNonNegativeNumber(body.discount, 'Discount') : rental.discount,
        securityDeposit: body.securityDeposit !== undefined ? asNonNegativeNumber(body.securityDeposit, 'Security deposit') : rental.securityDeposit,
        notes: body.notes !== undefined ? optionalString(body.notes) : rental.notes,
      },
    });
    await recomputeRentalTotals(tx, rentalId);
    return tx.rental.findUnique({ where: { id: rentalId }, include: RENTAL_INCLUDE });
  }).then(enrichRental);
}

/** Mark a fully-returned, fully-paid rental as CLOSED. */
async function closeRental(id) {
  const rentalId = asPositiveInt(id, 'Rental id');
  const rental = await prisma.rental.findUnique({ where: { id: rentalId }, include: { items: true } });
  if (!rental) throw new ApiError(404, 'Rental not found');
  const allReturned = rental.items.every((it) => remainingQty(it) <= 0);
  assert(allReturned, 'All quantities must be returned before closing.', 400);
  assert(toNum(rental.balanceAmount) <= 0, 'The outstanding balance must be cleared before closing.', 400);

  const updated = await prisma.rental.update({
    where: { id: rentalId },
    data: { status: 'CLOSED', returnDate: rental.returnDate || todayStart() },
    include: RENTAL_INCLUDE,
  });
  return enrichRental(updated);
}

/** Build a WhatsApp reminder payload for an overdue rental. */
async function getReminder(rentalId) {
  const rental = await getRental(rentalId);
  assert(rental.status === 'OVERDUE', 'This rental is not overdue.', 400);
  const extraDays = dayDiff(rental.dueDate, todayStart());
  assert(extraDays > 0, 'This rental is not overdue.', 400);

  const lines = [
    `Dear ${rental.customer.name},`,
    `your centering materials under rental #${rental.rentalNumber} were due for return on ${formatDate(rental.dueDate)}.`,
    `The materials are overdue by ${extraDays} days.`,
  ];
  const remainingItems = (rental.items || [])
    .filter((it) => it.remainingQuantity > 0)
    .map((it) => `${it.asset.name} (${it.remainingQuantity} ${it.asset.unit})`);
  if (remainingItems.length) {
    lines.push(`Outstanding items: ${remainingItems.join(', ')}.`);
  }
  if (toNum(rental.overdueCharge) > 0) {
    lines.push(`Additional rental charges of ${formatINR(rental.overdueCharge)} have been added.`);
  }
  lines.push(`Total pending amount: ${formatINR(rental.balanceAmount)}.`);
  lines.push('Please arrange the return as soon as possible.');

  const message = lines.join(' ');
  const digits = String(rental.customer.mobile || '').replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  return {
    rentalId: rental.id,
    rentalNumber: rental.rentalNumber,
    customerName: rental.customer.name,
    mobile: rental.customer.mobile,
    phone,
    message,
    whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
  };
}

/** Overdue rows: one row per outstanding rental item. */
async function listOverdueRentals() {
  await refreshAllOverdue(prisma);
  const rentals = await prisma.rental.findMany({
    where: { status: 'OVERDUE' },
    include: { customer: true, items: { include: { asset: true } }, invoice: true },
    orderBy: { dueDate: 'asc' },
  });

  const rows = [];
  const today = todayStart();
  for (const rental of rentals) {
    const extraDays = dayDiff(rental.dueDate, today);
    for (const item of rental.items) {
      const rem = remainingQty(item);
      if (rem > 0) {
        rows.push({
          rentalId: rental.id,
          rentalNumber: rental.rentalNumber,
          customerId: rental.customerId,
          customerName: rental.customer.name,
          customerMobile: rental.customer.mobile,
          customerProject: rental.customer.projectName,
          assetId: item.assetId,
          assetName: item.asset.name,
          unit: item.asset.unit,
          remainingQuantity: rem,
          dueDate: rental.dueDate,
          extraDays,
          dailyRate: item.rentalRate,
          overdueCharge: round2(rem * toNum(item.rentalRate) * extraDays),
          rentalBalance: rental.balanceAmount,
          status: rental.status,
        });
      }
    }
  }
  return rows;
}

/** Rental statuses available for filtering. */
const RENTAL_STATUSES = ['ACTIVE', 'PARTIALLY_RETURNED', 'RETURNED', 'OVERDUE', 'CLOSED'];

module.exports = {
  listRentals,
  getRental,
  createRental,
  updateRental,
  closeRental,
  getReminder,
  listOverdueRentals,
  RENTAL_STATUSES,
  itemAmount,
};