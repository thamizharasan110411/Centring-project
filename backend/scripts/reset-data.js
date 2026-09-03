/* Reset all business data (keeps the schema, sequences, and admin login).
 * Usage: DATABASE_URL="postgresql://..." node scripts/reset-data.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing all business data…');

  // Child-first order so foreign keys stay happy (relations also cascade from Rental).
  const returnItems = await prisma.returnItem.deleteMany({});
  const returns = await prisma.return.deleteMany({});
  const payments = await prisma.payment.deleteMany({});
  const invoices = await prisma.invoice.deleteMany({});
  const rentalItems = await prisma.rentalItem.deleteMany({});
  const rentals = await prisma.rental.deleteMany({});
  const customers = await prisma.customer.deleteMany({});
  const assets = await prisma.asset.deleteMany({});

  console.log('✅ Done. Deleted:');
  console.log(`   - ${returnItems.count} return items`);
  console.log(`   - ${returns.count} returns`);
  console.log(`   - ${payments.count} payments`);
  console.log(`   - ${invoices.count} invoices`);
  console.log(`   - ${rentalItems.count} rental items`);
  console.log(`   - ${rentals.count} rentals`);
  console.log(`   - ${customers.count} customers`);
  console.log(`   - ${assets.count} assets`);
  console.log('\nThe database is now empty and ready for real data.');
}

main()
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());