import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import PaymentModal from '../components/PaymentModal';
import { Spinner, EmptyState, ErrorState } from '../components/Loading';
import { PrimaryButton } from '../components/FormControls';
import { RENTAL_STATUSES, RENTAL_STATUS_FILTERS } from '../utils/constants';
import { inr, fmtDate } from '../utils/format';

export default function RentalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [payRental, setPayRental] = useState(null);

  const params = useMemo(
    () => ({ page, limit: 10, search: search || undefined, status: status || undefined }),
    [page, search, status]
  );

  const { data, loading, error, refetch } = useFetch(
    () => client.get('/rentals', { params }).then((r) => r),
    [page, search, status]
  );

  const setStatus = (value) => {
    setPage(1);
    if (value) setSearchParams({ status: value });
    else setSearchParams({});
  };

  return (
    <div>
      <PageHeader title="Rentals" subtitle="Track rentals, returns, billing and payments">
        <Link to="/rentals/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
          + New Rental
        </Link>
      </PageHeader>

      {/* Status filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {RENTAL_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              status === f.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
            {f.value && (
              <span className="ml-1 opacity-60">
                ({f.value === 'OVERDUE' ? '⚠' : ''})
              </span>
            )}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search rental no. / customer…"
          className="ml-auto w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none sm:w-64"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title={status ? `No ${status.toLowerCase().replace('_', ' ')} rentals` : 'No rentals yet'}
          message={search ? 'Try a different search.' : 'Create a rental to get started.'}
          action={!search && !status ? <Link to="/rentals/new"><PrimaryButton>+ New Rental</PrimaryButton></Link> : null}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rental No.</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Rental Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link to={`/rentals/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.rentalNumber}</Link>
                      {r.overdueDays > 0 && r.remainingQuantity > 0 && (
                        <span className="ml-1.5 text-xs font-bold text-rose-600">⚠️ +{r.overdueDays}d</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/customers/${r.customerId}`} className="font-medium text-slate-800 hover:text-indigo-600">{r.customer?.name}</Link>
                      <span className="block text-xs text-slate-400">{r.customer?.mobile}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.customer?.projectName || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(r.rentalDate)}</td>
                    <td className={`px-4 py-3 tabular-nums ${r.overdueDays > 0 ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>{fmtDate(r.dueDate)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{inr(r.grandTotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{inr(r.invoice?.paidAmount || 0)}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${Number(r.balanceAmount) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{inr(r.balanceAmount)}</td>
                    <td className="px-4 py-3"><StatusBadge map={RENTAL_STATUSES} status={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 whitespace-nowrap">
                        <Link to={`/rentals/${r.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">View</Link>
                        {!['RETURNED', 'CLOSED'].includes(r.status) && (
                          <Link to={`/rentals/${r.id}/return`} className="rounded-md px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50">Return</Link>
                        )}
                        {Number(r.balanceAmount) > 0 && !['CLOSED'].includes(r.status) && (
                          <button onClick={() => setPayRental(r)} className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">Payment</button>
                        )}
                        {r.invoice && (
                          <Link to={`/invoices/${r.invoice.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50">Invoice</Link>
                        )}
                      </div>
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

      {payRental && (
        <PaymentModal rentalId={payRental.id} onClose={() => setPayRental(null)} onSaved={refetch} />
      )}
    </div>
  );
}