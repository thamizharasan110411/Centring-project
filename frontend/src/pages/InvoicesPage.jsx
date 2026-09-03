import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { Spinner, EmptyState, ErrorState } from '../components/Loading';
import { INVOICE_STATUSES, INVOICE_STATUS_FILTERS } from '../utils/constants';
import { inr, fmtDate } from '../utils/format';

export default function InvoicesPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ page, limit: 10, search: search || undefined, status: status || undefined }),
    [page, search, status]
  );

  const { data, loading, error, refetch } = useFetch(
    () => client.get('/invoices', { params }).then((r) => r),
    [page, search, status]
  );

  return (
    <div>
      <PageHeader title="Billing / Invoices" subtitle="Every rental generates an invoice that stays in sync with returns and payments" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {INVOICE_STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                status === f.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search invoice / rental / customer…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:w-64 sm:ml-auto"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.data.length === 0 ? (
        <EmptyState title="No invoices" message="Invoices are generated automatically when a rental is created." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice No.</th>
                  <th className="px-4 py-3">Rental</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link to={`/invoices/${inv.id}`} className="font-mono text-xs font-semibold text-indigo-600 hover:underline">{inv.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/rentals/${inv.rentalId}`} className="font-medium text-slate-700 hover:text-indigo-600">{inv.rental?.rentalNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{inv.rental?.customer?.name}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{inr(inv.grandTotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{inr(inv.paidAmount)}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${Number(inv.balanceAmount) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{inr(inv.balanceAmount)}</td>
                    <td className="px-4 py-3"><StatusBadge map={INVOICE_STATUSES} status={inv.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/invoices/${inv.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination meta={data.meta} onPage={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}