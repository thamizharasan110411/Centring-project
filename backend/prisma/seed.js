/* eslint-disable no-console */
require('dotenv').config();
const prisma = require('../src/prisma');
const { addDays, todayStart } = require('../src/utils/dates');
const rentalService = require('../src/services/rental.service');
const returnService = require('../src/services/return.service');
const paymentService = require('../src/services/payment.service');

const today = todayStart();

/** yyyy-MM-dd in LOCAL time (toISOString would shift a day for UTC+ timezones). */
function toLocalDateInput(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const ASSETS = [
  { name: 'Steel Plate', category: 'Centering Plates', unit: 'Piece', totalQuantity: 500, rentalRate: 10, rateType: 'PER_DAY', condition: 'GOOD', notes: '12mm shuttering plates, 600×600mm' },
  { name: 'Adjustable Prop', category: 'Props', unit: 'Piece', totalQuantity: 300, rentalRate: 8, rateType: 'PER_DAY', condition: 'GOOD', notes: 'Heavy-duty adjustable props, 3m' },
  { name: 'Scaffolding Pipe', category: 'Scaffolding', unit: 'Meter', totalQuantity: 2000, rentalRate: 3, rateType: 'PER_DAY', condition: 'USED', notes: '48mm GI scaffolding pipes' },
  { name: 'Coupler', category: 'Scaffolding', unit: 'Piece', totalQuantity: 1500, rentalRate: 2, rateType: 'PER_DAY', condition: 'USED', notes: 'Swivel and right-angle couplers' },
  { name: 'Base Jack', category: 'Accessories', unit: 'Piece', totalQuantity: 400, rentalRate: 5, rateType: 'PER_DAY', condition: 'GOOD', notes: 'Screw base jacks for props' },
  { name: 'U-Jack Head', category: 'Accessories', unit: 'Piece', totalQuantity: 400, rentalRate: 5, rateType: 'PER_DAY', condition: 'GOOD', notes: 'U-head jack with fixing pin' },
  { name: 'Wooden Batten', category: 'Timber', unit: 'Piece', totalQuantity: 800, rentalRate: 4, rateType: 'PER_DAY', condition: 'USED', notes: '100×50mm wooden battens' },
  { name: 'GI Pipe', category: 'Scaffolding', unit: 'Meter', totalQuantity: 1000, rentalRate: 3.5, rateType: 'PER_DAY', condition: 'GOOD', notes: '40mm GI pipe for centering' },
  { name: 'Tripod Stand', category: 'Scaffolding', unit: 'Set', totalQuantity: 25, rentalRate: 15, rateType: 'PER_DAY', condition: 'NEW', notes: 'Tripod base stands' },
];

const CUSTOMERS = [
  { name: 'Kumar Construction', mobile: '9876543210', alternateMobile: '9988776655', address: 'No. 24, 1st Main, Koramangala, Bengaluru - 560034', projectName: 'Skyline Heights - Whitefield', projectAddress: 'Whitefield Main Road, Bengaluru', notes: 'Long-standing customer, prefers advance payments.' },
  { name: 'Sri Venkateswara Builders', mobile: '9845012345', alternateMobile: null, address: 'Plot 45, BTM Layout 2nd Stage, Bengaluru - 560076', projectName: 'Green Valley Residency - Electronic City', projectAddress: 'Hosur Road, Electronic City Phase 2', notes: null },
  { name: 'Green Valley Developers', mobile: '9008007006', alternateMobile: '8123456789', address: 'No. 8, 3rd Cross, HSR Layout, Bengaluru - 560102', projectName: 'Lake View Apartments - HSR Layout', projectAddress: '27th Main, HSR Layout Sector 2', notes: 'Prefers UPI payments.' },
  { name: 'Apex Infra Projects', mobile: '9845098450', alternateMobile: null, address: 'Wing B, Prestige Towers, MG Road, Bengaluru - 560001', projectName: 'Metro Mall - MG Road', projectAddress: 'MG Road, Bengaluru', notes: 'Large orders, monthly billing.' },
];

async function resetDatabase() {
  console.log('Resetting database...');
  await prisma.returnItem.deleteMany();
  await prisma.return.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.rentalItem.deleteMany();
  await prisma.rental.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.asset.deleteMany();
}

async function main() {
  const existing = await prisma.rental.count();
  if (existing > 0 && process.env.RESET !== '1') {
    console.log('Database already has rental data. Re-run with RESET=1 to wipe and reseed.');
    console.log('  e.g.  RESET=1 npm run seed');
    return;
  }
  if (existing > 0) await resetDatabase();

  console.log('Seeding centering rental ERP...\n');

  // 1) Assets
  const assetMap = {};
  for (let i = 0; i < ASSETS.length; i += 1) {
    const a = ASSETS[i];
    const created = await prisma.asset.create({
      data: { ...a, assetCode: `AST-${String(i + 1).padStart(4, '0')}`, availableQuantity: a.totalQuantity },
    });
    assetMap[a.name] = created;
    console.log(`  Asset  ${created.assetCode}  ${created.name}  (${created.totalQuantity} ${created.unit})`);
  }

  // 2) Customers
  const customerMap = {};
  for (let i = 0; i < CUSTOMERS.length; i += 1) {
    const c = CUSTOMERS[i];
    const created = await prisma.customer.create({
      data: { ...c, customerCode: `CST-${String(i + 1).padStart(4, '0')}` },
    });
    customerMap[c.name] = created;
    console.log(`  Customer ${created.customerCode}  ${created.name}`);
  }

  // 3) Rentals (created through the real service so all business logic applies)
  const rentalDefs = [
    {
      customer: 'Kumar Construction',
      rentalDate: addDays(today, -5),
      dueDate: addDays(today, 10),
      transportCharge: 1000,
      advancePaid: 5000,
      items: [
        { asset: 'Steel Plate', quantity: 50, days: 15 },
        { asset: 'Adjustable Prop', quantity: 40, days: 15 },
      ],
      label: 'ACTIVE (not due)',
    },
    {
      customer: 'Sri Venkateswara Builders',
      rentalDate: addDays(today, -20),
      dueDate: addDays(today, -6),
      otherCharge: 500,
      advancePaid: 10000,
      items: [
        { asset: 'Scaffolding Pipe', quantity: 500, days: 14 },
        { asset: 'Coupler', quantity: 600, days: 14 },
      ],
      label: 'OVERDUE by 6 days',
    },
    {
      customer: 'Green Valley Developers',
      rentalDate: addDays(today, -12),
      dueDate: addDays(today, 3),
      advancePaid: 5000,
      items: [
        { asset: 'Steel Plate', quantity: 80, days: 15 },
        { asset: 'Base Jack', quantity: 100, days: 15 },
      ],
      label: 'PARTIALLY RETURNED',
    },
    {
      customer: 'Apex Infra Projects',
      rentalDate: addDays(today, -30),
      dueDate: addDays(today, -15),
      advancePaid: 10000,
      items: [
        { asset: 'Wooden Batten', quantity: 100, days: 15 },
        { asset: 'GI Pipe', quantity: 300, days: 15 },
      ],
      label: 'RETURNED (balance pending)',
    },
    {
      customer: 'Kumar Construction',
      rentalDate: addDays(today, -60),
      dueDate: addDays(today, -45),
      advancePaid: 5000,
      items: [
        { asset: 'Steel Plate', quantity: 30, days: 15 },
        { asset: 'Coupler', quantity: 200, days: 15 },
      ],
      label: 'CLOSED (fully paid)',
    },
    {
      customer: 'Sri Venkateswara Builders',
      rentalDate: addDays(today, -2),
      dueDate: addDays(today, 20),
      discount: 500,
      advancePaid: 7000,
      items: [
        { asset: 'Adjustable Prop', quantity: 60, days: 22 },
        { asset: 'U-Jack Head', quantity: 60, days: 22 },
        { asset: 'Tripod Stand', quantity: 20, days: 22 },
      ],
      label: 'ACTIVE (not due)',
    },
  ];

  const rentals = [];
  for (const def of rentalDefs) {
    const rental = await rentalService.createRental({
      customerId: customerMap[def.customer].id,
      rentalDate: toLocalDateInput(def.rentalDate),
      dueDate: toLocalDateInput(def.dueDate),
      items: def.items.map((i) => ({ assetId: assetMap[i.asset].id, quantity: i.quantity, days: i.days })),
      transportCharge: def.transportCharge || 0,
      otherCharge: def.otherCharge || 0,
      discount: def.discount || 0,
      advancePaid: def.advancePaid || 0,
      paymentMethod: 'UPI',
    });
    rentals.push(rental);
    console.log(`  Rental ${rental.rentalNumber}  ${def.customer}  -> ${rental.status}  (${def.label})`);
  }

  // 4) Returns
  // R3 (Green Valley): partial return with damage + missing
  const r3 = rentals[2];
  const r3Steel = r3.items.find((i) => i.asset.name === 'Steel Plate');
  await returnService.processReturn(r3.id, {
    notes: 'Partial return - first batch',
    items: [
      { rentalItemId: r3Steel.id, returnedQuantity: 30, damagedQuantity: 3, missingQuantity: 2, damageCharge: 30, missingCharge: 20 },
    ],
  });
  console.log(`  Return  on ${r3.rentalNumber}: 30 good, 3 damaged, 2 missing (Steel Plate)`);

  // R4 (Apex): full return with damage + missing
  const r4 = rentals[3];
  const r4Batten = r4.items.find((i) => i.asset.name === 'Wooden Batten');
  const r4Gi = r4.items.find((i) => i.asset.name === 'GI Pipe');
  await returnService.processReturn(r4.id, {
    notes: 'Project completed - full return',
    items: [
      { rentalItemId: r4Batten.id, returnedQuantity: 90, damagedQuantity: 5, missingQuantity: 5, damageCharge: 20, missingCharge: 20 },
      { rentalItemId: r4Gi.id, returnedQuantity: 300, damagedQuantity: 0, missingQuantity: 0 },
    ],
  });
  console.log(`  Return  on ${r4.rentalNumber}: full return, 5 damaged + 5 missing battens`);

  // R5 (Kumar): full clean return
  const r5 = rentals[4];
  await returnService.processReturn(r5.id, {
    notes: 'Full return - no damage',
    items: r5.items.map((i) => ({ rentalItemId: i.id, returnedQuantity: i.rentedQuantity })),
  });
  console.log(`  Return  on ${r5.rentalNumber}: full clean return`);

  // 5) Additional payments
  const paymentDefs = [
    { rental: rentals[3], amount: 5000, paymentDate: addDays(today, -10), method: 'BANK_TRANSFER', ref: 'NEFT-884512' }, // R4 partial payment
    { rental: rentals[4], amount: 5500, paymentDate: addDays(today, -40), method: 'CASH', ref: null }, // R5 final payment
  ];
  for (const p of paymentDefs) {
    await paymentService.recordPayment({
      rentalId: p.rental.id,
      amount: p.amount,
      paymentDate: toLocalDateInput(p.paymentDate),
      paymentMethod: p.method,
      referenceNumber: p.ref,
      notes: p.ref ? `Payment ref ${p.ref}` : null,
    });
    console.log(`  Payment ${p.amount} on ${p.rental.rentalNumber} (${p.method})`);
  }

  // 6) Summary
  const [rentalCount, overdueCount, invoiceCount, paymentCount, availableSum, customersCount] = await Promise.all([
    prisma.rental.count(),
    prisma.rental.count({ where: { status: 'OVERDUE' } }),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.asset.aggregate({ _sum: { availableQuantity: true } }),
    prisma.customer.count(),
  ]);

  console.log('\n✓ Seed complete!');
  console.log(`  Customers : ${customersCount}`);
  console.log(`  Assets    : ${ASSETS.length} (${availableSum._sum.availableQuantity} units available)`);
  console.log(`  Rentals   : ${rentalCount} (${overdueCount} overdue)`);
  console.log(`  Invoices  : ${invoiceCount}`);
  console.log(`  Payments  : ${paymentCount}`);
  console.log('\nStatuses:');
  const byStatus = await prisma.rental.groupBy({ by: ['status'], _count: { _all: true } });
  for (const s of byStatus) console.log(`    ${s.status}: ${s._count._all}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });