import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import PaymentModal from '../components/PaymentModal';
import { Spinner, EmptyState, ErrorState } from '../components/Loading';
import { PrimaryButton } from '../components/FormControls';
import { PAYMENT_METHOD_FILTERS } from '../utils/constants';
import { inr, fmtDate } from '../utils/format';

export default function PaymentsPage() {
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const params = useMemo(
    () => ({ page, limit: 10, method: method || undefined, search: search || undefined }),
    [page, method, search]
  );

  const { data, loading, error, refetch } = useFetch(
    () => client.get('/payments', { params }).then((r) => r),
    [page, method, search]
  );

  return (
    <div>
      <PageHeader title="Payments" subtitle="Record payments — invoice status and balances update automatically">
        <PrimaryButton onClick={() => setModalOpen(true)}>+ Record Payment</PrimaryButton>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={method}
          onChange={(e) => { setMethod(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          {PAYMENT_METHOD_FILTERS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search reference / rental / customer…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:w-72"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title="No payments yet"
          message="Record the advance or partial payments you receive from customers."
          action={<PrimaryButton onClick={() => setModalOpen(true)}>+ Record Payment</PrimaryButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Rental</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-500">{fmtDate(p.paymentDate)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/rentals/${p.rentalId}`} className="font-medium text-indigo-600 hover:underline">{p.rental?.rentalNumber}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/customers/${p.rental?.customerId}`} className="text-slate-700 hover:text-indigo-600">{p.rental?.customer?.name}</Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{p.paymentMethod.toLowerCase().replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.referenceNumber || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{p.notes || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">{inr(p.amount)}</td>
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

      {modalOpen && <PaymentModal onClose={() => setModalOpen(false)} onSaved={refetch} />}
    </div>
  );
}