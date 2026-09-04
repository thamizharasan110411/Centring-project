const ApiError = require('../utils/ApiError');
const { toNum, round2 } = require('../utils/money');
const { todayStart, dayDiff } = require('../utils/dates');

/** Statuses that can still accrue / lose overdue state. */
const OPEN_STATUSES = ['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE'];

/** Quantity still out with the customer (not returned, not damaged, not missing). */
function remainingQty(item) {
  return (
    toNum(item.rentedQuantity) -
    toNum(item.returnedQuantity) -
    toNum(item.damagedQuantity) -
    toNum(item.missingQuantity)
  );
}

/**
 * Overdue charge for a rental as of `today`.
 *
 * Two parts, both idempotent (recomputing never double-charges):
 *  1. Snapshot — every quantity already recorded in a return gets charged its
 *     rate for the days it was actually out (return date − due date). This is
 *     what makes the overdue charge stick to the FINAL bill even after a late
 *     full return.
 *  2. Live — quantity still out with the customer accrues up to `today`.
 */
function computeOverdueForRental(rental, items, today = todayStart()) {
  const extraDays = Math.max(0, dayDiff(rental.dueDate, today));
  let overdueCharge = 0;

  const rateById = new Map(items.map((it) => [it.id, toNum(it.rentalRate)]));
  for (const ret of rental.returns || []) {
    const retExtra = dayDiff(rental.dueDate, ret.returnDate);
    if (retExtra <= 0) continue;
    for (const ri of ret.items || []) {
      const qty = toNum(ri.returnedQuantity) + toNum(ri.damagedQuantity) + toNum(ri.missingQuantity);
      if (qty > 0) {
        overdueCharge += qty * (rateById.get(ri.rentalItemId) || 0) * retExtra;
      }
    }
  }

  if (extraDays > 0) {
    for (const item of items) {
      const rem = remainingQty(item);
      if (rem > 0) {
        overdueCharge += rem * toNum(item.rentalRate) * extraDays;
      }
    }
  }
  return { extraDays, overdueCharge: round2(overdueCharge) };
}

function computeGrandTotal(r) {
  return round2(
    toNum(r.subtotal) +
      toNum(r.transportCharge) +
      toNum(r.otherCharge) +
      toNum(r.overdueCharge) +
      toNum(r.damageCharge) +
      toNum(r.missingCharge) -
      toNum(r.discount)
  );
}

function invoiceStatusFor(balance, paid) {
  if (round2(balance) <= 0) return 'PAID';
  if (toNum(paid) > 0) return 'PARTIALLY_PAID';
  return 'PENDING';
}

/**
 * Single source of truth for a rental's financial + status state.
 * Recomputes overdue charge, grand total, balance and status, then
 * keeps the related Invoice row in sync. Must be called inside a
 * transaction (tx) for write paths; a bare prisma client is fine for
 * read-time refreshes.
 */
async function recomputeRentalTotals(tx, rentalId) {
  const rental = await tx.rental.findUnique({
    where: { id: rentalId },
    include: {
      items: true,
      returns: { include: { items: true } },
      payments: { select: { amount: true } },
      invoice: { select: { id: true } },
    },
  });
  if (!rental) throw new ApiError(404, 'Rental not found');

  const today = todayStart();
  const allReturned = rental.items.every((it) => remainingQty(it) <= 0);
  const anyReturned = rental.items.some(
    (it) => toNum(it.returnedQuantity) + toNum(it.damagedQuantity) + toNum(it.missingQuantity) > 0
  );
  const { extraDays, overdueCharge } = computeOverdueForRental(rental, rental.items, today);
  const paid = rental.payments.reduce((sum, p) => sum + toNum(p.amount), 0);

  let status = rental.status;
  if (status !== 'CLOSED') {
    if (allReturned) {
      status = 'RETURNED';
      if (round2(computeGrandTotal({ ...rental, overdueCharge }) - paid) <= 0) status = 'CLOSED';
    } else if (extraDays > 0) {
      status = 'OVERDUE';
    } else if (anyReturned) {
      status = 'PARTIALLY_RETURNED';
    } else {
      status = 'ACTIVE';
    }
  }

  const grandTotal = computeGrandTotal({ ...rental, overdueCharge });
  const balance = round2(grandTotal - paid);

  const rentalUpdate = {
    overdueCharge: round2(overdueCharge),
    grandTotal,
    balanceAmount: balance,
    status,
  };
  if (allReturned && !rental.returnDate) rentalUpdate.returnDate = today;

  await tx.rental.update({ where: { id: rentalId }, data: rentalUpdate });

  if (rental.invoice) {
    await tx.invoice.update({
      where: { id: rental.invoice.id },
      data: {
        subtotal: rental.subtotal,
        overdueCharge: round2(overdueCharge),
        damageCharge: rental.damageCharge,
        missingCharge: rental.missingCharge,
        transportCharge: rental.transportCharge,
        otherCharge: rental.otherCharge,
        discount: rental.discount,
        grandTotal,
        paidAmount: round2(paid),
        balanceAmount: balance,
        status: invoiceStatusFor(balance, paid),
      },
    });
  }

  return {
    rental: { ...rental, ...rentalUpdate, paid },
    paid,
    balance,
    extraDays,
  };
}

/** Refresh overdue state for every open rental. Used before list/report reads. */
async function refreshAllOverdue(client) {
  const open = await client.rental.findMany({
    where: { status: { in: OPEN_STATUSES } },
    select: { id: true },
  });
  for (const r of open) {
    await recomputeRentalTotals(client, r.id);
  }
  return open.length;
}

/** Attach computed display fields (remaining qty, overdue info) to a rental graph. */
function enrichRental(rental) {
  const today = todayStart();
  const enriched = { ...rental };
  const isOpen = OPEN_STATUSES.includes(rental.status);
  if (isOpen) {
    // Live picture for open rentals (already includes snapshots from past returns).
    const { extraDays, overdueCharge } = computeOverdueForRental(
      rental,
      rental.items || [],
      today
    );
    enriched.overdueDays = extraDays;
    enriched.overdueCharge = overdueCharge;
  } else {
    // Returned/closed rentals keep the snapshot computed at return time.
    const refDate = rental.returnDate || today;
    enriched.overdueDays = Math.max(0, dayDiff(rental.dueDate, refDate));
  }
  enriched.items = (rental.items || []).map((item) => ({
    ...item,
    remainingQuantity: remainingQty(item),
    returnedTotal:
      toNum(item.returnedQuantity) + toNum(item.damagedQuantity) + toNum(item.missingQuantity),
  }));
  return enriched;
}

module.exports = {
  OPEN_STATUSES,
  remainingQty,
  computeOverdueForRental,
  computeGrandTotal,
  invoiceStatusFor,
  recomputeRentalTotals,
  refreshAllOverdue,
  enrichRental,
};