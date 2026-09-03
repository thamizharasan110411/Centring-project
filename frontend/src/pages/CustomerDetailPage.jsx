import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { RENTAL_STATUSES } from '../utils/constants';
import { Spinner, ErrorState, EmptyState } from '../components/Loading';
import { inr, fmtDate } from '../utils/format';
import { PrimaryButton } from '../components/FormControls';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useFetch(
    () => client.get(`/customers/${id}`).then((r) => r.data),
    [id]
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const s = data.stats || {};
  const rentals = data.rentals || [];
  const activeRentals = rentals.filter((r) => ['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE'].includes(r.status));
  const previousRentals = rentals.filter((r) => !['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE'].includes(r.status));

  return (
    <div>
      <PageHeader title={data.name} subtitle={`${data.customerCode} · since ${fmtDate(data.createdAt)}`}>
        <Link to="/customers" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← All Customers</Link>
        <Link to="/rentals/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
          + New Rental
        </Link>
      </PageHeader>

      {/* Contact card */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Mobile</p>
            <p className="font-medium tabular-nums">{data.mobile}</p>
            {data.alternateMobile && <p className="text-xs text-slate-500">Alt: {data.alternateMobile}</p>}
          </div>
          <div>
            <p className="text-xs text-slate-400">Project</p>
            <p className="font-medium">{data.projectName || '—'}</p>
            {data.projectAddress && <p className="text-xs text-slate-500">{data.projectAddress}</p>}
          </div>
          <div>
            <p className="text-xs text-slate-400">Address</p>
            <p className="font-medium">{data.address || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Notes</p>
            <p className="font-medium">{data.notes || '—'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Rentals" value={s.totalRentals} icon="📦" accent="indigo" />
        <StatCard label="Total Rental Amount" value={inr(s.totalRentalAmount)} icon="🧾" accent="sky" />
        <StatCard label="Total Paid" value={inr(s.totalPaidAmount)} icon="💳" accent="emerald" />
        <StatCard label="Outstanding" value={inr(s.outstandingAmount)} icon="💸" accent={Number(s.outstandingAmount) > 0 ? 'rose' : 'emerald'} />
      </div>

      {/* Active rentals */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Active Rentals</h2>
        {activeRentals.length === 0 ? (
          <EmptyState title="No active rentals" message="This customer has no rentals in progress." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Rental</th>
                    <th className="px-4 py-3">Rental Date</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeRentals.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3"><Link to={`/rentals/${r.id}`} className="font-medium text-indigo-600">{r.rentalNumber}</Link></td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(r.rentalDate)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(r.dueDate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{inr(r.grandTotal)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">{inr(r.balanceAmount)}</td>
                      <td className="px-4 py-3"><StatusBadge map={RENTAL_STATUSES} status={r.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/rentals/${r.id}/return`} className="text-xs font-medium text-indigo-600 hover:underline">Return</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pending payments */}
      {s.pendingPayments?.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Pending Payments</h2>
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 text-left text-xs uppercase tracking-wider text-amber-700">
                  <tr>
                    <th className="px-4 py-3">Rental</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-right">Billed</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {s.pendingPayments.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3"><Link to={`/rentals/${r.id}`} className="font-medium text-indigo-600">{r.rentalNumber}</Link></td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(r.dueDate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{inr(r.grandTotal)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{inr(r.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">{inr(r.balanceAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Previous rentals */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Rental History</h2>
        {previousRentals.length === 0 ? (
          <EmptyState title="No previous rentals" message="Completed rentals will appear here." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Rental</th>
                    <th className="px-4 py-3">Rental Date</th>
                    <th className="px-4 py-3">Return Date</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previousRentals.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3"><Link to={`/rentals/${r.id}`} className="font-medium text-indigo-600">{r.rentalNumber}</Link></td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(r.rentalDate)}</td>
                      <td className="px-4 py-3 text-slate-600">{r.returnDate ? fmtDate(r.returnDate) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{inr(r.grandTotal)}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${Number(r.balanceAmount) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{inr(r.balanceAmount)}</td>
                      <td className="px-4 py-3"><StatusBadge map={RENTAL_STATUSES} status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}