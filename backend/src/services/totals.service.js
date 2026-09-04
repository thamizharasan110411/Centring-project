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
 * Overdue charge is MANUAL: it is set by the user on the return form (or the
 * rental edit page) and stored on the rental — it is never auto-calculated.
 * `extraDays` is still derived from the dates for status/display purposes only.
 */
function extraDaysFor(rental, today = todayStart()) {
  return Math.max(0, dayDiff(rental.dueDate, today));
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
  const extraDays = extraDaysFor(rental, today);
  // Manual: keep whatever charge the user set (return form / rental edit).
  const overdueCharge = toNum(rental.overdueCharge);
  const paid = rental.payments.reduce((sum, p) => sum + toNum(p.amount), 0);

  let status = rental.status;
  if (status !== 'CLOSED') {
    if (allReturned) {
      status = 'RETURNED';
      if (round2(computeGrandTotal(rental) - paid) <= 0) status = 'CLOSED';
    } else if (extraDays > 0) {
      status = 'OVERDUE';
    } else if (anyReturned) {
      status = 'PARTIALLY_RETURNED';
    } else {
      status = 'ACTIVE';
    }
  }

  const grandTotal = computeGrandTotal(rental);
  const balance = round2(grandTotal - paid);

  const rentalUpdate = {
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
        overdueCharge: overdueCharge,
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
  // Overdue days is display-only (drives the OVERDUE banner/status). The
  // overdue CHARGE is manual and stays exactly as stored on the rental.
  const refDate = rental.returnDate || today;
  enriched.overdueDays = Math.max(0, dayDiff(rental.dueDate, refDate));
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
  computeGrandTotal,
  invoiceStatusFor,
  recomputeRentalTotals,
  refreshAllOverdue,
  enrichRental,
};