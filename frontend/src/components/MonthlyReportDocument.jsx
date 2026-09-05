import { BUSINESS } from '../utils/constants';
import { fmtDate, fmtDateLong, inr, num } from '../utils/format';

const METHOD_BADGE = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card',
};

function MRow({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? 'border-indigo-200 bg-indigo-50/70' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-black tabular-nums ${accent ? 'text-indigo-700' : 'text-slate-800'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

/**
 * Professional monthly business report. id="monthly-print" so the @media print
 * rules in index.css show only this block on A4. Hidden on screen.
 */
export default function MonthlyReportDocument({ report }) {
  if (!report) return null;
  const s = report.summary || {};
  const payments = report.payments || [];
  const rentals = report.rentals || [];
  const byMethod = report.byMethod || [];

  return (
    <div id="monthly-print" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      {/* ===================== Header ===================== */}
      <div className="flex flex-col gap-6 border-b-[3px] border-slate-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{BUSINESS.name}</h1>
          <p className="mt-1 max-w-md text-xs italic leading-relaxed text-slate-500">{BUSINESS.tagline}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">{BUSINESS.address}</p>
          <p className="mt-1 text-sm text-slate-600">
            Phone: <span className="font-medium text-slate-800">{BUSINESS.phone}</span>
            {BUSINESS.email ? <><br />Email: <span className="font-medium text-slate-800">{BUSINESS.email}</span></> : null}
          </p>
        </div>
        <div className="sm:min-w-[260px] sm:text-right">
          <p className="text-2xl font-black uppercase tracking-widest text-slate-800">Monthly Report</p>
          <p className="mt-2 text-lg font-bold text-indigo-700">{report.label}</p>
          <p className="mt-1 text-sm text-slate-500">Generated: <span className="font-medium text-slate-800">{fmtDateLong(new Date())}</span></p>
        </div>
      </div>

      {/* ===================== Summary grid ===================== */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MRow label="Total Rentals" value={num(s.totalRentals)} sub="created this month" />
        <MRow label="Total Billed" value={inr(s.totalBilled)} sub="rental value" />
        <MRow label="Total Revenue" value={inr(s.totalRevenue)} sub={`${num(s.paymentCount)} payments received`} accent />
        <MRow label="Pending / Due" value={inr(s.pendingAmount)} sub="invoices raised this month" />
        <MRow label="Cash Payment" value={inr(s.cashTotal)} sub="collected in cash" />
        <MRow label="UPI Payment" value={inr(s.upiTotal)} sub="collected via UPI" />
        <MRow label="Other Methods" value={inr(s.otherTotal)} sub="card / bank transfer" />
        <MRow label="Total Payment" value={inr(s.totalPayment)} sub="all methods combined" />
        <MRow label="Overdue Charges" value={inr(s.overdueCharges)} sub="billed this month" />
        <MRow label="Damage Charges" value={inr(s.damageCharges)} sub="billed this month" />
        <MRow label="Returns" value={`${num(s.returnsProcessed)}`} sub={`${num(s.returnedUnits)} units returned`} />
        <MRow label="Outstanding Rentals" value={num(s.outstandingRentals)} sub={`${inr(s.outstandingAmount)} open balance`} />
      </div>

      {/* ===================== By method ===================== */}
      {byMethod.length > 0 && (
        <div className="mt-8 avoid-break">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Split by Method</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {byMethod.map((m) => (
              <div key={m.method} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-700">{METHOD_BADGE[m.method] || m.method}</span>
                <span className="tabular-nums"><b className="text-slate-900">{inr(m.total)}</b> <span className="text-xs text-slate-400">({m.count})</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== Transactions ===================== */}
      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment / Transaction Summary</p>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-800 text-left text-[11px] uppercase tracking-wider text-white">
              <th className="border border-slate-700 px-3 py-2.5">Date</th>
              <th className="border border-slate-700 px-3 py-2.5">Rental</th>
              <th className="border border-slate-700 px-3 py-2.5">Customer</th>
              <th className="border border-slate-700 px-3 py-2.5">Method</th>
              <th className="border border-slate-700 px-3 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-slate-200 px-3 py-4 text-center text-xs text-slate-400">No payments recorded in {report.label}.</td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="break-inside-avoid">
                  <td className="border border-slate-200 px-3 py-2 text-slate-600">{fmtDate(p.paymentDate)}</td>
                  <td className="border border-slate-200 px-3 py-2 font-medium text-slate-800">{p.rental?.rentalNumber || '—'}</td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-700">{p.rental?.customer?.name || '—'}</td>
                  <td className="border border-slate-200 px-3 py-2 capitalize text-slate-600">{METHOD_BADGE[p.paymentMethod] || p.paymentMethod?.toLowerCase()}</td>
                  <td className="border border-slate-200 px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">{inr(p.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
          {payments.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={4} className="border border-slate-200 px-3 py-2 text-right font-semibold text-slate-700">Total Collected</td>
                <td className="border border-slate-200 px-3 py-2 text-right font-bold tabular-nums">{inr(s.totalPayment)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ===================== Rentals in month ===================== */}
      <div className="mt-8 avoid-break">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Rentals Raised This Month</p>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="border border-slate-200 px-3 py-2">Rental</th>
              <th className="border border-slate-200 px-3 py-2">Customer</th>
              <th className="border border-slate-200 px-3 py-2">Rental Date</th>
              <th className="border border-slate-200 px-3 py-2">Due Date</th>
              <th className="border border-slate-200 px-3 py-2 text-right">Total</th>
              <th className="border border-slate-200 px-3 py-2 text-right">Paid</th>
              <th className="border border-slate-200 px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rentals.length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-slate-200 px-3 py-4 text-center text-xs text-slate-400">No rentals raised in {report.label}.</td>
              </tr>
            ) : (
              rentals.map((r) => {
                const paid = (r.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const balance = Number(r.grandTotal || 0) - paid;
                return (
                  <tr key={r.id} className="break-inside-avoid">
                    <td className="border border-slate-200 px-3 py-2 font-medium text-slate-800">{r.rentalNumber}</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-700">{r.customer?.name || '—'}</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-600">{fmtDate(r.rentalDate)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-600">{fmtDate(r.dueDate)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{inr(r.grandTotal)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-emerald-700">{inr(paid)}</td>
                    <td className={`border border-slate-200 px-3 py-2 text-right font-semibold tabular-nums ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{inr(balance)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ===================== Footer ===================== */}
      <div className="mt-10 grid gap-6 border-t-2 border-slate-800 pt-6 text-xs text-slate-500 sm:grid-cols-2">
        <div className="avoid-break">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-500">
            <li>Revenue figures are computed from payments actually received during {report.label}.</li>
            <li>Pending / due reflects invoices raised in {report.label} that are not fully paid.</li>
            <li>Overdue &amp; damage charges are those billed during the period.</li>
            <li>Outstanding rentals are rentals that remain open with an unpaid balance.</li>
          </ul>
        </div>
        <div className="sm:text-right avoid-break">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">For {BUSINESS.name}</p>
          <p className="mt-3 text-slate-600">{BUSINESS.address}</p>
          <p className="text-slate-600">{BUSINESS.phone}{BUSINESS.email ? ` · ${BUSINESS.email}` : ''}</p>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400">
        <p>{BUSINESS.name} · Monthly Business Report · {report.label} · This is a computer-generated report.</p>
      </div>
    </div>
  );
}