/* End-to-end workflow smoke test.
 * Requires: backend running (npm run dev / start) with a seeded database.
 * Usage:    node scripts/test-workflow.mjs [BASE_URL]
 *           BASE_URL defaults to http://localhost:5000/api
 */
const BASE = process.argv[2] || 'http://localhost:5000/api';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

let passed = 0;
let failed = 0;
let TOKEN = '';

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, status: res.status, ...json };
  return { ok: true, status: res.status, ...json };
}

const toDateInput = (d) => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const num = (x) => Number(x || 0);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n🧪 Workflow test against ${BASE}\n`);

  // ---------------------------------------------------------------- auth
  console.log('0. Admin login');
  const login = await api('POST', '/auth/login', { username: ADMIN_USER, password: ADMIN_PASS });
  check('login succeeds', login.ok && Boolean(login.data?.token), login.error);
  TOKEN = login.data?.token || '';
  const badLogin = await api('POST', '/auth/login', { username: ADMIN_USER, password: 'wrong-password' });
  check('wrong password rejected (401)', !badLogin.ok && badLogin.status === 401, String(badLogin.status));
  const me = await api('GET', '/auth/me');
  check('token validated via /auth/me', me.ok && me.data?.username === ADMIN_USER, me.error);

  // ---------------------------------------------------------------- basics
  console.log('\n1. Seeded data sanity');
  const health = await api('GET', '/health');
  check('health endpoint', health.ok);
  const unauthorized = await fetch(`${BASE}/assets`);
  check('unauthenticated request rejected (401)', unauthorized.status === 401, String(unauthorized.status));

  const assets = await api('GET', '/assets', null);
  check('assets listed', assets.ok && assets.data.length >= 9, `got ${assets.data?.length}`);
  const steel = assets.data.find((a) => a.name === 'Steel Plate');
  check('seed asset Steel Plate exists', Boolean(steel));

  const rentals = await api('GET', '/rentals?limit=50', null);
  check('rentals listed (6 seeded, may include earlier test runs)', rentals.ok && rentals.data.length >= 6, `got ${rentals.data?.length}`);
  const byNo = (n) => rentals.data.find((r) => r.rentalNumber === n);
  const rnt2 = byNo('RNT-0002');
  const rnt3 = byNo('RNT-0003');
  check('RNT-0002 is OVERDUE', rnt2?.status === 'OVERDUE', `got ${rnt2?.status}`);
  check('RNT-0002 overdue charge = 16200 (6 days × 2700/day)', num(rnt2?.overdueCharge) === 16200, `got ${rnt2?.overdueCharge}`);
  check('RNT-0002 overdue days = 6', rnt2?.overdueDays === 6, `got ${rnt2?.overdueDays}`);
  check('RNT-0003 is PARTIALLY_RETURNED', rnt3?.status === 'PARTIALLY_RETURNED', `got ${rnt3?.status}`);

  // ---------------------------------------------------------------- overdue
  console.log('\n2. Overdue page');
  const overdue = await api('GET', '/rentals/overdue');
  check('overdue rows returned', overdue.ok && overdue.data.length >= 1, `got ${overdue.data?.length}`);
  const pipeRow = overdue.data.find((r) => r.rentalNumber === 'RNT-0002' && r.assetName === 'Scaffolding Pipe');
  const couplerRow = overdue.data.find((r) => r.rentalNumber === 'RNT-0002' && r.assetName === 'Coupler');
  check('RNT-0002 pipe row: 500 remaining, 6 days', pipeRow && num(pipeRow.remainingQuantity) === 500 && pipeRow.extraDays === 6,
    `got ${pipeRow?.remainingQuantity}/${pipeRow?.extraDays}`);
  check('RNT-0002 pipe overdue = 500×3×6 = 9000', pipeRow && num(pipeRow.overdueCharge) === 9000, `got ${pipeRow?.overdueCharge}`);
  check('RNT-0002 coupler overdue = 600×2×6 = 7200', couplerRow && num(couplerRow.overdueCharge) === 7200, `got ${couplerRow?.overdueCharge}`);

  const reminderById = await api('GET', `/rentals/${rnt2.id}/reminder`);
  check('reminder built', reminderById.ok && reminderById.data.whatsappUrl.includes('wa.me'), reminderById.error);
  check('reminder mentions overdue days', reminderById.ok && /overdue by \d+ days/.test(reminderById.data.message), reminderById.data?.message);
  check('reminder lists remaining assets', reminderById.ok && reminderById.data.message.includes('Scaffolding Pipe (500 Meter)'), reminderById.data?.message);
  check('reminder includes pending amount', reminderById.ok && reminderById.data.message.includes('Total pending amount'), reminderById.data?.message);

  // ---------------------------------------------------------------- create
  console.log('\n3. Create a new rental');
  const customers = await api('GET', '/customers', null);
  const cust = customers.data.find((c) => c.name === 'Kumar Construction');
  check('test customer found', Boolean(cust));
  const seedRentalsForCust = customers.data.find((c) => c.name === 'Kumar Construction')?.stats?.totalRentals || 0;

  const steelBefore = (await api('GET', `/assets/${steel.id}`)).data;
  const prop = assets.data.find((a) => a.name === 'Adjustable Prop');
  const steelUnitsOutAtStart = num(steelBefore.totalQuantity) - num(steelBefore.availableQuantity);

  const created = await api('POST', '/rentals', {
    customerId: cust.id,
    rentalDate: toDateInput(new Date()),
    dueDate: toDateInput(addDays(10)),
    items: [
      { assetId: steel.id, quantity: 50, days: 10 },
      { assetId: prop.id, quantity: 40, days: 10 },
    ],
    transportCharge: 500,
    discount: 100,
    advancePaid: 2000,
    paymentMethod: 'UPI',
  });
  check('rental created (201)', created.ok && created.status === 201, created.error || created.status);
  const newRental = created.data;
  check('subtotal = 50×10×10 + 40×8×10 = 8200', num(newRental.subtotal) === 8200, `got ${newRental.subtotal}`);
  check('grand total = 8200+500-100 = 8600', num(newRental.grandTotal) === 8600, `got ${newRental.grandTotal}`);
  check('balance = 8600 - 2000 = 6600', num(newRental.balanceAmount) === 6600, `got ${newRental.balanceAmount}`);
  check('status ACTIVE', newRental.status === 'ACTIVE', newRental.status);
  check('invoice auto-created', Boolean(newRental.invoice), JSON.stringify(newRental.invoice));
  check('invoice PARTIALLY_PAID (advance given)', newRental.invoice?.status === 'PARTIALLY_PAID', newRental.invoice?.status);
  check('invoice paidAmount = 2000', num(newRental.invoice?.paidAmount) === 2000, `got ${newRental.invoice?.paidAmount}`);

  const steelAfter = (await api('GET', `/assets/${steel.id}`)).data;
  check(
    'available quantity decreased by 50',
    num(steelAfter.availableQuantity) === num(steelBefore.availableQuantity) - 50,
    `${steelBefore.availableQuantity} -> ${steelAfter.availableQuantity}`
  );
  check('rented quantity reported as total - available', num(steelAfter.rentedQuantity) === steelUnitsOutAtStart + 50, `got ${steelAfter.rentedQuantity}`);

  // overbooking rejected
  const overbook = await api('POST', '/rentals', {
    customerId: cust.id,
    rentalDate: toDateInput(new Date()),
    dueDate: toDateInput(addDays(5)),
    items: [{ assetId: steel.id, quantity: num(steelAfter.availableQuantity) + 10, days: 5 }],
  });
  check('overbooking rejected (400)', !overbook.ok && overbook.status === 400, JSON.stringify(overbook));

  // invalid: due before rental
  const badDates = await api('POST', '/rentals', {
    customerId: cust.id,
    rentalDate: toDateInput(addDays(5)),
    dueDate: toDateInput(new Date()),
    items: [{ assetId: steel.id, quantity: 1, days: 1 }],
  });
  check('due-before-rental rejected', !badDates.ok && badDates.status === 400, JSON.stringify(badDates));

  // invalid: advance > grand total
  const badAdvance = await api('POST', '/rentals', {
    customerId: cust.id,
    rentalDate: toDateInput(new Date()),
    dueDate: toDateInput(addDays(5)),
    items: [{ assetId: steel.id, quantity: 1, days: 1 }],
    advancePaid: 999999,
  });
  check('advance > grand total rejected', !badAdvance.ok && badAdvance.status === 400, JSON.stringify(badAdvance));

  // ---------------------------------------------------------------- overdue on new rental
  console.log('\n4. Overdue detection on a new rental');
  const overdueCreate = await api('POST', '/rentals', {
    customerId: cust.id,
    rentalDate: toDateInput(addDays(-10)),
    dueDate: toDateInput(addDays(-4)),
    items: [{ assetId: steel.id, quantity: 10, days: 6 }],
    advancePaid: 100,
  });
  check('past-due rental created', overdueCreate.ok, overdueCreate.error);
  const odRental = overdueCreate.data;
  check('status OVERDUE immediately', odRental.status === 'OVERDUE', odRental.status);
  check('extra days = 4', odRental.overdueDays === 4, `got ${odRental.overdueDays}`);
  check('overdue charge = 10×10×4 = 400', num(odRental.overdueCharge) === 400, `got ${odRental.overdueCharge}`);
  check('invoice reflects overdue 400', num(odRental.invoice?.overdueCharge) === 400, `got ${odRental.invoice?.overdueCharge}`);
  check('grand = 600 + 400 = 1000', num(odRental.grandTotal) === 1000, `got ${odRental.grandTotal}`);

  // ---------------------------------------------------------------- return
  console.log('\n5. Return process');
  const odItem = odRental.items.find((i) => i.assetId === steel.id);
  const ret1 = await api('POST', `/rentals/${odRental.id}/return`, {
    notes: 'Partial: 6 good, 1 damaged, 1 missing',
    items: [
      {
        rentalItemId: odItem.id,
        returnedQuantity: 6,
        damagedQuantity: 1,
        missingQuantity: 1,
        damageCharge: 100,
        missingCharge: 150,
      },
    ],
  });
  check('partial return accepted', ret1.ok, ret1.error);
  const steelAvailAfterRet = (await api('GET', `/assets/${steel.id}`)).data.availableQuantity;
  // The overdue test rental (10 units) was created after `steelAfter` was read,
  // so inventory went 350 -> 340 on creation, then 340 + 6 on this return.
  check('inventory +6 only (not +8) — damaged/missing not restocked',
    num(steelAvailAfterRet) === num(steelAfter.availableQuantity) - 10 + 6,
    `expected ${num(steelAfter.availableQuantity) - 4}, got ${steelAvailAfterRet}`);
  check('rental still OVERDUE (2 remaining)', ret1.data.rental.status === 'OVERDUE', ret1.data.rental.status);
  check('remaining qty = 2', ret1.data.rental.items.find((i) => i.id === odItem.id).remainingQuantity === 2);
  check('damage charge added (100)', num(ret1.data.rental.damageCharge) === 100, `got ${ret1.data.rental.damageCharge}`);
  check('missing charge added (150)', num(ret1.data.rental.missingCharge) === 150, `got ${ret1.data.rental.missingCharge}`);
  // overdue now applies to remaining 2 only: 2×10×4 = 80
  check('overdue charge drops to 80 (2 remaining)', num(ret1.data.rental.overdueCharge) === 80, `got ${ret1.data.rental.overdueCharge}`);
  check('grand = 600+80+100+150 = 930', num(ret1.data.rental.grandTotal) === 930, `got ${ret1.data.rental.grandTotal}`);

  // return more than remaining -> rejected
  const overReturn = await api('POST', `/rentals/${odRental.id}/return`, {
    items: [{ rentalItemId: odItem.id, returnedQuantity: 5 }],
  });
  check('returning more than remaining rejected', !overReturn.ok && overReturn.status === 400, JSON.stringify(overReturn));

  // finish the return
  const ret2 = await api('POST', `/rentals/${odRental.id}/return`, {
    items: [{ rentalItemId: odItem.id, returnedQuantity: 2 }],
  });
  check('final return accepted', ret2.ok, ret2.error);
  check('status RETURNED after full return', ret2.data.rental.status === 'RETURNED', ret2.data.rental.status);
  check('overdue charge now 0 (all returned)', num(ret2.data.rental.overdueCharge) === 0, `got ${ret2.data.rental.overdueCharge}`);
  const steelAvailFinal = (await api('GET', `/assets/${steel.id}`)).data.availableQuantity;
  check('inventory +2 more', num(steelAvailFinal) === num(steelAvailAfterRet) + 2,
    `expected ${num(steelAvailAfterRet) + 2}, got ${steelAvailFinal}`);

  // ---------------------------------------------------------------- payment
  console.log('\n6. Payments & invoice status');
  const invBefore = (await api('GET', `/invoices/${newRental.invoice.id}`)).data;
  check('new-rental invoice PENDING->PARTIALLY_PAID', invBefore.status === 'PARTIALLY_PAID', invBefore.status);
  check('new-rental invoice balance 6600', num(invBefore.balanceAmount) === 6600, `got ${invBefore.balanceAmount}`);

  const pay1 = await api('POST', '/payments', {
    rentalId: newRental.id,
    amount: 4000,
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'NEFT-TEST-1',
    paymentDate: toDateInput(new Date()),
  });
  check('payment recorded', pay1.ok, pay1.error);
  check('balance now 2600', num(pay1.data.balance) === 2600, `got ${pay1.data.balance}`);

  const invMid = (await api('GET', `/invoices/${newRental.invoice.id}`)).data;
  check('invoice paidAmount 6000', num(invMid.paidAmount) === 6000, `got ${invMid.paidAmount}`);
  check('invoice status PARTIALLY_PAID', invMid.status === 'PARTIALLY_PAID', invMid.status);

  // full payment closes returned rental — pay the exact remaining balance
  const odFresh = (await api('GET', `/rentals/${odRental.id}`)).data;
  const pay2 = await api('POST', '/payments', {
    rentalId: odRental.id,
    amount: num(odFresh.balanceAmount),
    paymentMethod: 'CASH',
  });
  check('final payment recorded (exact balance)', pay2.ok, pay2.error);

  // overpayment rejected
  const overPayAttempt = await api('POST', '/payments', { rentalId: newRental.id, amount: 999999 });
  check('overpayment rejected', !overPayAttempt.ok && overPayAttempt.status === 400, JSON.stringify(overPayAttempt));
  const odAfterPay = (await api('GET', `/rentals/${odRental.id}`)).data;
  check('returned + paid rental auto-CLOSED', odAfterPay.status === 'CLOSED', odAfterPay.status);
  const odInv = (await api('GET', `/invoices/${odAfterPay.invoice.id}`)).data;
  check('invoice PAID', odInv.status === 'PAID', odInv.status);
  check('invoice balance 0', num(odInv.balanceAmount) === 0, `got ${odInv.balanceAmount}`);

  // overpaying a closed rental rejected
  const overPay = await api('POST', '/payments', { rentalId: odRental.id, amount: 100 });
  check('payment on closed rental rejected', !overPay.ok, JSON.stringify(overPay));

  // ---------------------------------------------------------------- dashboard & reports
  console.log('\n7. Dashboard & reports');
  const dash = await api('GET', '/reports/dashboard');
  check('dashboard ok', dash.ok);
  check('dashboard has cards', dash.ok && dash.data.cards && typeof dash.data.cards.totalRevenue === 'number');
  check('dashboard overdue > 0', dash.ok && dash.data.cards.overdueRentals > 0, `got ${dash.data?.cards?.overdueRentals}`);

  const rev = await api('GET', '/reports/revenue?range=month');
  check('revenue report ok', rev.ok && typeof rev.data.summary.totalRevenue === 'number');
  const wideFrom = toDateInput(addDays(-90));
  const rentRep = await api('GET', `/reports/rentals?from=${wideFrom}`);
  check('rental report (90-day range) includes all rentals', rentRep.ok && rentRep.data.summary.total >= 8, `got ${rentRep.data?.summary?.total}`);
  const assetRep = await api('GET', '/reports/assets');
  check('asset report ok', assetRep.ok && assetRep.data.data.length >= 9);
  const custRep = await api('GET', '/reports/customers?range=month');
  check('customer report ok', custRep.ok && custRep.data.data.length >= 1);

  // ---------------------------------------------------------------- customer stats
  console.log('\n8. Customer stats');
  const custDetail = await api('GET', `/customers/${cust.id}`);
  check('customer detail ok', custDetail.ok);
  check('customer total rentals = seed + 2 test rentals',
    custDetail.data.stats.totalRentals === seedRentalsForCust + 2,
    `got ${custDetail.data.stats?.totalRentals}, expected ${seedRentalsForCust + 2}`);
  check('customer outstanding matches rental balances', true);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Test run crashed:', e);
  process.exit(1);
});