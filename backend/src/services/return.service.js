const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');
const { toNum, round2 } = require('../utils/money');
const { asPositiveInt, asNonNegativeInt, asNonNegativeNumber, optionalString } = require('../utils/validation');
const { recomputeRentalTotals, enrichRental, remainingQty } = require('./totals.service');
const { todayStart } = require('../utils/dates');

const RENTAL_INCLUDE = {
  customer: true,
  items: { include: { asset: true } },
  payments: { orderBy: { paymentDate: 'desc' } },
  returns: { include: { items: true }, orderBy: { returnDate: 'desc' } },
  invoice: true,
};

/**
 * Process a (partial) return inside one PostgreSQL transaction:
 *  1. validate return quantities against the rental items
 *  2. create Return + ReturnItems
 *  3. bump RentalItem returned/damaged/missing counters
 *  4. add ONLY the good returned quantity back to Asset.availableQuantity
 *  5. apply damage/missing charges and recompute totals + invoice
 */
async function processReturn(rentalId, body) {
  const id = asPositiveInt(rentalId, 'Rental id');

  return prisma.$transaction(async (tx) => {
    // Lock the rental so two returns can't race each other.
    const rental = await tx.rental.findUnique({
      where: { id },
      include: { items: { include: { asset: true } } },
    });
    if (!rental) throw new ApiError(404, 'Rental not found');
    if (['RETURNED', 'CLOSED'].includes(rental.status)) {
      throw new ApiError(400, `This rental is already ${rental.status.toLowerCase()} and cannot accept returns.`);
    }

    await tx.$queryRaw`SELECT id FROM "Rental" WHERE id = ${id} FOR UPDATE`;

    const rawItems = body.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new ApiError(400, 'At least one return line is required.');
    }

    const returnDate = todayStart();
    const createdReturn = await tx.return.create({
      data: { rentalId: id, returnDate, notes: optionalString(body.notes) },
    });

    let damageChargeTotal = 0;
    let missingChargeTotal = 0;

    for (const raw of rawItems) {
      const rentalItemId = asPositiveInt(raw.rentalItemId, 'Rental item id');
      const rentalItem = rental.items.find((it) => it.id === rentalItemId);
      if (!rentalItem) throw new ApiError(400, 'Return line references an item that is not part of this rental.');

      const returnedQuantity = asNonNegativeInt(raw.returnedQuantity ?? 0, 'Returned quantity');
      const damagedQuantity = asNonNegativeInt(raw.damagedQuantity ?? 0, 'Damaged quantity');
      const missingQuantity = asNonNegativeInt(raw.missingQuantity ?? 0, 'Missing quantity');
      const totalQty = returnedQuantity + damagedQuantity + missingQuantity;

      const remaining = remainingQty(rentalItem);
      if (totalQty === 0) {
        throw new ApiError(400, `Enter a quantity for "${rentalItem.asset.name}".`);
      }
      if (totalQty > remaining) {
        throw new ApiError(
          400,
          `Cannot return more than ${remaining} ${rentalItem.asset.unit}(s) of "${rentalItem.asset.name}" (remaining out: ${remaining}).`
        );
      }

      // Suggested charges = quantity × rate, but the user can supply their own.
      const rate = toNum(rentalItem.rentalRate);
      const damageCharge = raw.damageCharge === undefined || raw.damageCharge === null || raw.damageCharge === ''
        ? round2(damagedQuantity * rate)
        : asNonNegativeNumber(raw.damageCharge, 'Damage charge');
      const missingCharge = raw.missingCharge === undefined || raw.missingCharge === null || raw.missingCharge === ''
        ? round2(missingQuantity * rate)
        : asNonNegativeNumber(raw.missingCharge, 'Missing charge');

      await tx.returnItem.create({
        data: {
          returnId: createdReturn.id,
          rentalItemId,
          returnedQuantity,
          damagedQuantity,
          missingQuantity,
          damageCharge,
          missingCharge,
        },
      });

      await tx.rentalItem.update({
        where: { id: rentalItemId },
        data: {
          returnedQuantity: { increment: returnedQuantity },
          damagedQuantity: { increment: damagedQuantity },
          missingQuantity: { increment: missingQuantity },
        },
      });

      // Only the good returned quantity goes back into available inventory.
      if (returnedQuantity > 0) {
        await tx.asset.update({
          where: { id: rentalItem.assetId },
          data: { availableQuantity: { increment: returnedQuantity } },
        });
      }

      damageChargeTotal += damageCharge;
      missingChargeTotal += missingCharge;
    }

    await tx.rental.update({
      where: { id },
      data: {
        damageCharge: { increment: round2(damageChargeTotal) },
        missingCharge: { increment: round2(missingChargeTotal) },
        returnDate: rental.items.every((it) => remainingQty(it) <= 0) ? returnDate : null,
      },
    });

    await recomputeRentalTotals(tx, id);

    const updated = await tx.rental.findUnique({ where: { id }, include: RENTAL_INCLUDE });
    return { return: createdReturn, rental: enrichRental(updated) };
  });
}

module.exports = { processReturn };