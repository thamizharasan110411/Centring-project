import { BUSINESS, INVOICE_STATUSES } from '../utils/constants';
import { fmtDate, fmtDateLong, inr, num } from '../utils/format';
import StatusBadge from './StatusBadge';

function Row({ label, value, bold = false }) {
  return (
    <div className="flex justify-between py-1">
      <span className={bold ? 'font-semibold text-slate-900' : 'text-slate-600'}>{label}</span>
      <span className={`${bold ? 'text-base font-bold text-slate-900' : ''} tabular-nums`}>{value}</span>
    </div>
  );
}

/**
 * Full invoice layout. Rendered with id="invoice-print" so @media print
 * only shows this block (see index.css).
 */
export default function InvoiceDocument({ invoice }) {
  const rental = invoice?.rental || {};
  const customer = rental.customer || {};
  const items = rental.items || [];
  const payments = rental.payments || [];
  const paid = Number(invoice.paidAmount || 0);

  return (
    <div id="invoice-print" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      {/* Header */}
      <div className="flex flex-col gap-6 border-b-2 border-slate-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{BUSINESS.name}</h1>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-600">{BUSINESS.address}</p>
          <p className="mt-1 text-sm text-slate-600">
            Phone: {BUSINESS.phone}
            {BUSINESS.email ? <> · {BUSINESS.email}</> : null}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Invoice</p>
          <p className="text-xl font-bold text-slate-900">{invoice.invoiceNumber}</p>
          <p className="mt-1 text-sm text-slate-500">Date: {fmtDateLong(invoice.invoiceDate)}</p>
          <div className="mt-2">
            <StatusBadge map={INVOICE_STATUSES} status={invoice.status} />
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Billed To</p>
          <p className="mt-1 text-base font-bold text-slate-900">{customer.name}</p>
          {customer.address && <p className="text-sm text-slate-600">{customer.address}</p>}
          <p className="mt-1 text-sm text-slate-600">Mobile: {customer.mobile}</p>
          {customer.projectName && (
            <p className="mt-1 text-sm text-slate-600">Project: {customer.projectName}</p>
          )}
          {customer.projectAddress && <p className="text-sm text-slate-600">{customer.projectAddress}</p>}
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rental Details</p>
          <p className="mt-1 text-sm text-slate-600">Rental No: <span className="font-semibold text-slate-800">{rental.rentalNumber}</span></p>
          <p className="text-sm text-slate-600">Rental Date: {fmtDate(rental.rentalDate)}</p>
          <p className="text-sm text-slate-600">Due Date: {fmtDate(rental.dueDate)}</p>
          <p className="text-sm text-slate-600">Return Date: {rental.returnDate ? fmtDate(rental.returnDate) : '—'}</p>
          <p className="text-sm text-slate-600">Status: <span className="font-medium capitalize">{String(rental.status || '').toLowerCase().replace('_', ' ')}</span></p>
        </div>
      </div>

      {/* Items */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Asset</th>
              <th className="py-2 pr-3 text-right">Qty</th>
              <th className="py-2 pr-3 text-right">Rate (₹)</th>
              <th className="py-2 pr-3 text-right">Days</th>
              <th className="py-2 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-b border-slate-200">
                <td className="py-2.5 pr-3 text-slate-500">{i + 1}</td>
                <td className="py-2.5 pr-3 font-medium text-slate-800">
                  {it.asset?.name}
                  <span className="block text-xs text-slate-400">
                    {it.asset?.assetCode} · {it.asset?.unit}
                    {it.returnedQuantity > 0 && ` · returned ${it.returnedQuantity}`}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{num(it.rentedQuantity)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{num(it.rentalRate)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{it.rentalDays}</td>
                <td className="py-2.5 text-right font-medium tabular-nums">{inr(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charges + totals */}
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div>
          {rental.damageQuantity > 0 || (rental.returns?.length > 0) ? (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Returns & charges</p>
              {(rental.returns || []).map((ret) => (
                <p key={ret.id} className="mt-1">
                  {fmtDate(ret.returnDate)}: {(ret.items || []).map((i) =>
                    [i.returnedQuantity > 0 ? `${i.returnedQuantity} returned` : null,
                     i.damagedQuantity > 0 ? `${i.damagedQuantity} damaged (+${inr(i.damageCharge)})` : null,
                     i.missingQuantity > 0 ? `${i.missingQuantity} missing (+${inr(i.missingCharge)})` : null]
                      .filter(Boolean).join(', ')
                  ).join(' · ') || '—'}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No returns recorded yet.</p>
          )}
        </div>
        <div className="space-y-1 text-sm">
          <Row label="Subtotal" value={inr(invoice.subtotal)} />
          <Row label="Transport Charge" value={inr(invoice.transportCharge)} />
          <Row label="Other Charge" value={inr(invoice.otherCharge)} />
          {Number(invoice.overdueCharge) > 0 && (
            <Row label="Overdue Charge" value={inr(invoice.overdueCharge)} />
          )}
          {Number(invoice.damageCharge) > 0 && (
            <Row label="Damage Charge" value={inr(invoice.damageCharge)} />
          )}
          {Number(invoice.missingCharge) > 0 && (
            <Row label="Missing Charge" value={inr(invoice.missingCharge)} />
          )}
          {Number(invoice.discount) > 0 && <Row label="Discount" value={`− ${inr(invoice.discount)}`} />}
          <div className="border-t border-slate-300 pt-2">
            <Row label="Grand Total" value={inr(invoice.grandTotal)} bold />
          </div>
          <Row label="Paid Amount" value={inr(invoice.paidAmount)} />
          <div className="border-t border-slate-300 pt-2">
            <Row label="Balance Due" value={inr(invoice.balanceAmount)} bold />
          </div>
        </div>
      </div>

      {/* Payments */}
      {payments.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Payment History</p>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-1.5 pr-3">Date</th>
                <th className="py-1.5 pr-3">Method</th>
                <th className="py-1.5 pr-3">Reference</th>
                <th className="py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3">{fmtDate(p.paymentDate)}</td>
                  <td className="py-1.5 pr-3 capitalize">{p.paymentMethod.toLowerCase().replace('_', ' ')}</td>
                  <td className="py-1.5 pr-3">{p.referenceNumber || '—'}</td>
                  <td className="py-1.5 text-right tabular-nums">{inr(p.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-2 text-right font-semibold text-slate-700">Total Paid</td>
                <td className="py-2 text-right font-bold tabular-nums">{inr(paid)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:justify-between">
        <p>Thank you for your business! Materials are charged until returned.</p>
        <p className="sm:text-right">
          Authorized Signatory<br />
          <span className="font-semibold text-slate-700">{BUSINESS.name}</span>
        </p>
      </div>
    </div>
  );
}