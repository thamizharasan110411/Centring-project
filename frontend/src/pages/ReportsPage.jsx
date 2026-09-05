import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { Spinner, ErrorState, EmptyState } from '../components/Loading';
import MonthlyReportDocument from '../components/MonthlyReportDocument';
import { RENTAL_STATUSES, BUSINESS } from '../utils/constants';
import { inr, num, fmtDate, todayInput } from '../utils/format';

const TABS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'rentals', label: 'Rentals' },
  { key: 'assets', label: 'Assets' },
  { key: 'customers', label: 'Customers' },
];

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const METHOD_BADGE = {
  CASH: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  UPI: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  BANK_TRANSFER: 'bg-sky-100 text-sky-800 ring-sky-200',
  CARD: 'bg-amber-100 text-amber-800 ring-amber-200',
};

const METHOD_LABEL = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card',
};

export default function ReportsPage() {
  const [tab, setTab] = useState('revenue');
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Monthly business report state
  const now = new Date();
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [monthly, setMonthly] = useState(null);
  const [monthlyError, setMonthlyError] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let alive = true;
    setMonthlyError('');
    client
      .get('/reports/monthly', { params: { month: reportMonth, year: reportYear } })
      .then((r) => {
        if (alive) setMonthly(r.data);
      })
      .catch((err) => {
        if (alive) setMonthlyError(err.message || 'Could not load the monthly report.');
      });
    return () => { alive = false; };
  }, [reportMonth, reportYear]);

  const params = useMemo(() => {
    if (range === 'custom') return { range: undefined, from: from || undefined, to: to || undefined };
    return { range };
  }, [range, from, to]);

  const { data, loading, error, refetch } = useFetch(
    () => client.get(`/reports/${tab}`, { params }).then((r) => r.data),
    [tab, range, from, to]
  );

  const summary = data?.summary;

  function downloadMonthlyPdf() {
    if (!monthly) return;
    setPrinting(true);
    // Give React a tick to mount the hidden document, then print.
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 150);
  }

  const ms = monthly?.summary || {};

  return (
    <div>
      <PageHeader title="Reports" subtitle="Business insights computed live from your data" />

      {/* ============ Monthly business report (PDF) ============ */}
      <div className="mb-6 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">📅 Monthly Business Report</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Rentals, revenue, Cash &amp; UPI split, pending dues, overdue charges and returns — downloadable as a professional PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:border-indigo-500 focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en-IN', { month: 'long' })}</option>
              ))}
            </select>
            <select
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:border-indigo-500 focus:outline-none"
            >
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={downloadMonthlyPdf}
              disabled={!monthly || printing}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {printing ? 'Preparing…' : '⬇ Download PDF'}
            </button>
          </div>
        </div>
        {monthlyError && <p className="mt-3 text-xs font-medium text-rose-600">⚠️ {monthlyError}</p>}
        {monthly && !monthlyError && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {[
              ['Rentals', num(ms.totalRentals)],
              ['Revenue', inr(ms.totalRevenue)],
              ['Cash', inr(ms.cashTotal)],
              ['UPI', inr(ms.upiTotal)],
              ['Pending', inr(ms.pendingAmount)],
              ['Overdue', inr(ms.overdueCharges)],
              ['Returns', `${num(ms.returnsProcessed)} (${num(ms.returnedUnits)} units)`],
              ['Outstanding', num(ms.outstandingRentals)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-800" title={String(value)}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============ Tab filter ============ */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ Date filter ============ */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                range === r.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            <span className="text-slate-400">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
        )}
        <span className="text-xs text-slate-400 sm:ml-auto">
          Based on {tab === 'revenue' ? 'payment' : tab === 'assets' ? 'rental item' : 'rental'} dates
        </span>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          {tab === 'revenue' && summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Revenue" value={inr(summary.totalRevenue)} icon="💰" accent="emerald" />
              <StatCard label="Cash Payment" value={inr(summary.cashTotal)} icon="💵" accent="amber" />
              <StatCard label="UPI Payment" value={inr(summary.upiTotal)} icon="📱" accent="indigo" />
              <StatCard label="Other Methods" value={inr(summary.otherTotal)} icon="🏦" accent="sky" />
              <StatCard label="Total Payment" value={inr(summary.totalPayment)} icon="🧾" accent="slate" />
              <StatCard label="Payments Count" value={summary.paymentCount} icon="🔢" accent="indigo" />
              <StatCard label="Paid (all time)" value={inr(summary.paidAmount)} icon="✅" accent="emerald" />
              <StatCard label="Pending (all time)" value={inr(summary.pendingAmount)} icon="⏳" accent="amber" />
            </div>
          )}
          {tab === 'rentals' && summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Rentals" value={summary.total} icon="📦" accent="indigo" />
              <StatCard label="Active" value={summary.active} icon="🔄" accent="sky" />
              <StatCard label="Overdue" value={summary.overdue} icon="⏰" accent="rose" />
              <StatCard label="Completed" value={summary.returned + summary.closed} icon="✅" accent="emerald" sub={`${summary.returned} returned · ${summary.closed} closed`} />
              <StatCard label="Total Billed" value={inr(summary.totalBilled)} icon="🧾" accent="indigo" />
              <StatCard label="Outstanding" value={inr(summary.totalOutstanding)} icon="💸" accent={Number(summary.totalOutstanding) > 0 ? 'rose' : 'emerald'} />
              <StatCard label="Partially Returned" value={summary.partiallyReturned} icon="↩️" accent="sky" />
              <StatCard label="Closed" value={summary.closed} icon="🔒" accent="slate" />
            </div>
          )}

          {/* Tables */}
          {tab === 'revenue' && (
            <ReportTable
              headers={['Date', 'Rental', 'Customer', 'Method', 'Amount']}
              rows={(data?.payments || []).map((p) => ({
                cells: [fmtDate(p.paymentDate), <Link key={p.id} to={`/rentals/${p.rentalId}`} className="font-medium text-indigo-600">{p.rental?.rentalNumber}</Link>, p.rental?.customer?.name,
                <span key="m" className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${METHOD_BADGE[p.paymentMethod] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{METHOD_LABEL[p.paymentMethod] || p.paymentMethod.toLowerCase().replace('_', ' ')}</span>,
                <span key="amt" className="font-semibold text-emerald-700">{inr(p.amount)}</span>],
              }))}
              empty="No payments in this period"
            />
          )}

          {tab === 'rentals' && (
            <ReportTable
              headers={['Rental', 'Customer', 'Rental Date', 'Due Date', 'Total', 'Balance', 'Status']}
              rows={(data?.rentals || []).map((r) => ({
                cells: [
                  <Link key={r.id} to={`/rentals/${r.id}`} className="font-medium text-indigo-600">{r.rentalNumber}</Link>,
                  r.customer?.name, fmtDate(r.rentalDate), fmtDate(r.dueDate),
                  <span key="t" className="tabular-nums">{inr(r.grandTotal)}</span>,
                  <span key="b" className={`tabular-nums ${Number(r.balanceAmount) > 0 ? 'font-semibold text-rose-600' : 'text-slate-400'}`}>{inr(r.balanceAmount)}</span>,
                  <StatusBadge key="s" map={RENTAL_STATUSES} status={r.status} />,
                ],
              }))}
              empty="No rentals in this period"
            />
          )}

          {tab === 'assets' && (
            <ReportTable
              headers={['Asset', 'Category', 'Total', 'Available', 'Rented', 'Times Rented', 'Damaged', 'Missing', 'Rental Revenue']}
              rows={(data?.data || []).map((a) => ({
                cells: [
                  <span key="n"><span className="font-medium text-slate-800">{a.name}</span><span className="block text-xs text-slate-400">{a.assetCode}</span></span>,
                  a.category, num(a.totalQuantity),
                  <span key="av" className="font-semibold">{num(a.availableQuantity)}</span>,
                  <span key="re" className="text-indigo-600">{num(a.rentedQuantity)}</span>,
                  num(a.timesRented),
                  <span key="d" className={a.damagedQuantity > 0 ? 'text-amber-600' : 'text-slate-400'}>{num(a.damagedQuantity)}</span>,
                  <span key="m" className={a.missingQuantity > 0 ? 'text-rose-600' : 'text-slate-400'}>{num(a.missingQuantity)}</span>,
                  <span key="rv" className="tabular-nums">{inr(a.rentalRevenue)}</span>,
                ],
              }))}
              empty="No data"
            />
          )}

          {tab === 'customers' && (
            <>
              {summary && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Customers" value={data.data.length} icon="👥" accent="indigo" />
                  <StatCard label="Rentals" value={summary.rentals} icon="📦" accent="sky" />
                  <StatCard label="Total Billed" value={inr(summary.totalBilled)} icon="🧾" accent="emerald" />
                  <StatCard label="Outstanding" value={inr(summary.outstandingAmount)} icon="💸" accent={Number(summary.outstandingAmount) > 0 ? 'rose' : 'emerald'} />
                </div>
              )}
              <ReportTable
                headers={['Customer', 'Mobile', 'Project', 'Rentals', 'Billed', 'Paid', 'Outstanding']}
                rows={(data?.data || []).map((c) => ({
                  cells: [
                    <Link key={c.id} to={`/customers/${c.id}`} className="font-medium text-slate-800 hover:text-indigo-600">{c.name}</Link>,
                    <span key="m" className="tabular-nums">{c.mobile}</span>, c.projectName || '—',
                    num(c.rentals),
                    <span key="b" className="tabular-nums">{inr(c.totalBilled)}</span>,
                    <span key="p" className="tabular-nums text-emerald-600">{inr(c.totalPaid)}</span>,
                    <span key="o" className={`tabular-nums ${Number(c.outstandingAmount) > 0 ? 'font-semibold text-rose-600' : 'text-emerald-600'}`}>{inr(c.outstandingAmount)}</span>,
                  ],
                }))}
                empty="No customer activity in this period"
              />
            </>
          )}
        </div>
      )}

      {/* Hidden on screen — shown only when printing the monthly PDF */}
      <MonthlyReportDocument report={monthly} />
    </div>
  );
}

function ReportTable({ headers, rows, empty }) {
  if (!rows.length) return <EmptyState title={empty} message="Try a wider date range." />;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/70">
                {row.cells.map((cell, j) => <td key={j} className="px-4 py-3 text-slate-700">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}