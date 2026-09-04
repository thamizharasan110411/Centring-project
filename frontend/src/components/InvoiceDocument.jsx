import { BUSINESS, INVOICE_STATUSES } from '../utils/constants';
import { fmtDate, fmtDateLong, inr, num, inrWords } from '../utils/format';
import StatusBadge from './StatusBadge';

function Row({ label, value, bold = false, muted = false }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className={bold ? 'font-semibold text-slate-900' : muted ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
      <span className={`${bold ? 'text-base font-bold text-slate-900' : ''} tabular-nums`}>{value}</span>
    </div>
  );
}

/**
 * Professional full invoice layout. Rendered with id="invoice-print" so the
 * @media print rules in index.css show only this block with A4 margins.
 */
export default function InvoiceDocument({ invoice }) {
  const rental = invoice?.rental || {};
  const customer = rental.customer || {};
  const items = rental.items || [];
  const payments = rental.payments || [];
  const returns = rental.returns || [];
  const paid = Number(invoice.paidAmount || 0);
  const overdueDays =
    Number(rental.overdueDays) ||
    (rental.returnDate ? Math.max(0, Math.round((new Date(rental.returnDate) - new Date(rental.dueDate)) / 86400000)) : 0);
  const hasOverdue = Number(invoice.overdueCharge) > 0;

  const statusLabel = INVOICE_STATUSES[invoice.status]?.label || invoice.status;

  return (
    <div id="invoice-print" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      {/* ===================== Header ===================== */}
      <div className="flex flex-col gap-6 border-b-[3px] border-slate-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{BUSINESS.name}</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">Centering Material Rentals</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">{BUSINESS.address}</p>
          <p className="mt-1 text-sm text-slate-600">
            Phone: <span className="font-medium text-slate-800">{BUSINESS.phone}</span>
            {BUSINESS.email ? <><br />Email: <span className="font-medium text-slate-800">{BUSINESS.email}</span></> : null}
          </p>
        </div>
        <div className="sm:min-w-[260px] sm:text-right">
          <p className="text-3xl font-black uppercase tracking-widest text-slate-800">Invoice</p>
          <p className="mt-2 text-lg font-bold text-indigo-700">{invoice.invoiceNumber}</p>
          <p className="mt-1 text-sm text-slate-500">Invoice Date: <span className="font-medium text-slate-800">{fmtDateLong(invoice.invoiceDate)}</span></p>
          <p className="mt-1 text-sm text-slate-500">Rental Ref: <span className="font-medium text-slate-800">{rental.rentalNumber}</span></p>
          <div className="mt-3 inline-block sm:inline-block">
            <StatusBadge map={INVOICE_STATUSES} status={invoice.status} />
          </div>
        </div>
      </div>

      {/* ===================== Parties ===================== */}
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4 avoid-break">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Billed To</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{customer.name}</p>
          {customer.address && <p className="mt-1 text-sm leading-relaxed text-slate-600">{customer.address}</p>}
          <p className="mt-2 text-sm text-slate-600">Mobile: <span className="font-semibold tabular-nums text-slate-800">{customer.mobile}</span></p>
          {customer.alternateMobile && <p className="text-sm text-slate-600">Alt: <span className="tabular-nums">{customer.alternateMobile}</span></p>}
          {customer.projectName && (
            <p className="mt-2 text-sm text-slate-600">Project: <span className="font-medium text-slate-800">{customer.projectName}</span></p>
          )}
          {customer.projectAddress && <p className="text-sm text-slate-600">{customer.projectAddress}</p>}
        </div>
        <div className="rounded-lg border border-slate-200 p-4 avoid-break">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Rental Details</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Rental Date</dt><dd className="font-medium text-slate-800">{fmtDate(rental.rentalDate)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Due Date</dt><dd className="font-medium text-slate-800">{fmtDate(rental.dueDate)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Return Date</dt><dd className="font-medium text-slate-800">{rental.returnDate ? fmtDate(rental.returnDate) : '—'}</dd></div>
            {hasOverdue && (
              <div className="flex justify-between gap-4"><dt className="text-rose-600">Overdue Days</dt><dd className="font-bold text-rose-700 tabular-nums">{overdueDays}</dd></div>
            )}
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className="font-medium capitalize text-slate-800">{String(rental.status || '').toLowerCase().replace('_', ' ')}</dd></div>
          </dl>
        </div>
      </div>

      {/* ===================== Items ===================== */}
      <div className="mt-8 avoid-break">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-800 text-left text-[11px] uppercase tracking-wider text-white">
              <th className="border border-slate-700 px-3 py-2.5">#</th>
              <th className="border border-slate-700 px-3 py-2.5">Asset / Item</th>
              <th className="border border-slate-700 px-3 py-2.5 text-right">Qty</th>
              <th className="border border-slate-700 px-3 py-2.5 text-right">Rate (₹)</th>
              <th className="border border-slate-700 px-3 py-2.5 text-right">Days</th>
              <th className="border border-slate-700 px-3 py-2.5 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="break-inside-avoid">
                <td className="border border-slate-200 px-3 py-2.5 text-slate-500">{i + 1}</td>
                <td className="border border-slate-200 px-3 py-2.5">
                  <p className="font-semibold text-slate-800">{it.asset?.name}</p>
                  <p className="text-xs text-slate-400">
                    {it.asset?.assetCode} · {it.asset?.unit}
                    {Number(it.returnedQuantity) > 0 && <> · returned {num(it.returnedQuantity)}</>}
                    {Number(it.missingQuantity) > 0 && <> · missing {num(it.missingQuantity)}</>}
                  </p>
                </td>
                <td className="border border-slate-200 px-3 py-2.5 text-right tabular-nums">{num(it.rentedQuantity)}</td>
                <td className="border border-slate-200 px-3 py-2.5 text-right tabular-nums">{num(it.rentalRate)}</td>
                <td className="border border-slate-200 px-3 py-2.5 text-right tabular-nums">{it.rentalDays}</td>
                <td className="border border-slate-200 px-3 py-2.5 text-right font-semibold tabular-nums">{inr(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===================== Returns & charges ===================== */}
      {returns.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm avoid-break">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Return Summary</p>
          <div className="mt-2 space-y-2">
            {returns.map((ret) => (
              <div key={ret.id} className="text-slate-700">
                <p className="text-xs font-semibold text-slate-600">Return on {fmtDate(ret.returnDate)}</p>
                <div className="mt-0.5 space-y-0.5 text-xs text-slate-600">
                  {(ret.items || []).map((ri) => (
                    <p key={ri.id}>
                      {[ri.returnedQuantity > 0 ? `${num(ri.returnedQuantity)} returned` : null,
                        ri.missingQuantity > 0 ? `${num(ri.missingQuantity)} missing` : null]
                        .filter(Boolean).join(' · ') || '—'}
                      {Number(ri.damageCharge) > 0 && <> · damage {inr(ri.damageCharge)}</>}
                      {Number(ri.missingCharge) > 0 && <> · missing charge {inr(ri.missingCharge)}</>}
                    </p>
                  ))}
                  {ret.missingDetails && (
                    <p className="mt-0.5 rounded bg-white/70 px-2 py-1 italic text-amber-800">
                      Missing pieces: {ret.missingDetails}
                    </p>
                  )}
                  {ret.notes && <p className="text-slate-400 italic">Note: {ret.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== Totals ===================== */}
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="space-y-2 self-start text-sm avoid-break">
          {hasOverdue ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Overdue</p>
              <p className="mt-1 text-sm text-rose-700">
                Returned {overdueDays} day{overdueDays > 1 ? 's' : ''} after due date ({fmtDate(rental.dueDate)}) — charged at the per-unit rate for the overdue period.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No overdue charge — returned on or before the due date.</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 text-sm avoid-break">
          <Row label="Rental Subtotal" value={inr(invoice.subtotal)} />
          <Row label="Transport Charge" value={inr(invoice.transportCharge)} muted={!Number(invoice.transportCharge)} />
          <Row label="Other Charge" value={inr(invoice.otherCharge)} muted={!Number(invoice.otherCharge)} />
          {hasOverdue && <Row label={`Overdue Charge (${overdueDays} days)`} value={`+ ${inr(invoice.overdueCharge)}`} />}
          {Number(invoice.damageCharge) > 0 && <Row label="Damage Charge" value={`+ ${inr(invoice.damageCharge)}`} />}
          {Number(invoice.missingCharge) > 0 && <Row label="Missing Charge" value={`+ ${inr(invoice.missingCharge)}`} />}
          {Number(invoice.discount) > 0 && <Row label="Discount" value={`− ${inr(invoice.discount)}`} />}
          <div className="my-2 border-t-2 border-slate-800" />
          <div className="flex items-baseline justify-between gap-4 rounded bg-slate-800 px-3 py-2.5 text-white">
            <span className="text-sm font-bold uppercase tracking-wider">Grand Total</span>
            <span className="text-lg font-black tabular-nums">{inr(invoice.grandTotal)}</span>
          </div>
          <Row label="Paid Amount" value={inr(invoice.paidAmount)} />
          <div className="my-1.5 border-t border-slate-200" />
          <div className="flex justify-between gap-4 py-1">
            <span className="font-semibold text-slate-900">Balance Due</span>
            <span className={`font-bold tabular-nums ${Number(invoice.balanceAmount) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{inr(invoice.balanceAmount)}</span>
          </div>
        </div>
      </div>

      {/* Amount in words */}
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm avoid-break">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Amount in words: </span>
        <span className="font-medium text-slate-700">{inrWords(invoice.grandTotal)}</span>
        <span className="ml-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status: </span>
        <span className={`text-xs font-bold uppercase tracking-wider ${statusLabel === 'Paid' ? 'text-emerald-600' : statusLabel === 'Pending' ? 'text-rose-600' : 'text-amber-600'}`}>
          {statusLabel}
        </span>
      </div>

      {/* ===================== Payments ===================== */}
      {payments.length > 0 && (
        <div className="mt-8 avoid-break">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment History</p>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="border border-slate-200 px-3 py-2">Date</th>
                <th className="border border-slate-200 px-3 py-2">Method</th>
                <th className="border border-slate-200 px-3 py-2">Reference</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="border border-slate-200 px-3 py-1.5">{fmtDate(p.paymentDate)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 capitalize">{p.paymentMethod.toLowerCase().replace('_', ' ')}</td>
                  <td className="border border-slate-200 px-3 py-1.5">{p.referenceNumber || '—'}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right tabular-nums">{inr(p.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={3} className="border border-slate-200 px-3 py-2 text-right font-semibold text-slate-700">Total Paid</td>
                <td className="border border-slate-200 px-3 py-2 text-right font-bold tabular-nums">{inr(paid)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ===================== Terms & footer ===================== */}
      <div className="mt-10 grid gap-6 border-t-2 border-slate-800 pt-6 text-xs text-slate-500 sm:grid-cols-2">
        <div className="avoid-break">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Terms & Conditions</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-500">
            <li>Materials are charged on a daily basis until the full quantity is returned to our yard.</li>
            <li>Items returned after the due date are charged at the rental rate for each overdue day.</li>
            <li>Missing pieces are recorded on the return and are not restocked to inventory.</li>
            <li>Balance dues are payable within 7 days of the invoice date.</li>
            <li>Transport charges, if any, are payable by the customer.</li>
          </ul>
        </div>
        <div className="sm:text-right avoid-break">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">For {BUSINESS.name}</p>
          <div className="mt-10">
            <p className="font-semibold text-slate-700">Authorized Signatory</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-1 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400">
        <p>{BUSINESS.name} · {BUSINESS.address} · {BUSINESS.phone}{BUSINESS.email ? ` · ${BUSINESS.email}` : ''}</p>
        <p>This is a computer-generated invoice and does not require a physical signature. Thank you for your business!</p>
      </div>
    </div>
  );
}