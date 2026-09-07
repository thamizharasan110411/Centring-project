/* Reset all business data (keeps the schema, sequences, and admin login).
 * Used by the scheduled auto-clean endpoint and the manual reset script.
 */
const prisma = require('../prisma');

async function resetAllData() {
  // Child-first order so foreign keys stay happy (relations also cascade from Rental).
  const returnItems = await prisma.returnItem.deleteMany({});
  const returns = await prisma.return.deleteMany({});
  const payments = await prisma.payment.deleteMany({});
  const invoices = await prisma.invoice.deleteMany({});
  const rentalItems = await prisma.rentalItem.deleteMany({});
  const rentals = await prisma.rental.deleteMany({});
  const customers = await prisma.customer.deleteMany({});
  const assets = await prisma.asset.deleteMany({});

  return {
    returnItems: returnItems.count,
    returns: returns.count,
    payments: payments.count,
    invoices: invoices.count,
    rentalItems: rentalItems.count,
    rentals: rentals.count,
    customers: customers.count,
    assets: assets.count,
  };
}

module.exports = { resetAllData };