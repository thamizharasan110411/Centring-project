import { Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { RENTAL_STATUSES, INVOICE_STATUSES, BUSINESS } from '../utils/constants';
import { inr, fmtDate, plural } from '../utils/format';
import { Spinner, ErrorState } from '../components/Loading';
import PageHeader from '../components/PageHeader';

export default function DashboardPage() {
  const { data, loading, error, refetch } = useFetch(
    () => client.get('/reports/dashboard').then((r) => r.data)
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const c = data.cards || {};

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${BUSINESS.name} — business overview, all figures come live from the database`}
      >
        <Link to="/rentals/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
          + New Rental
        </Link>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Assets" value={c.totalAssets} icon="🧱" accent="indigo" to="/assets" sub="asset types in inventory" />
        <StatCard label="Available Units" value={c.availableAssets} icon="✅" accent="emerald" to="/assets" sub="ready to rent" />
        <StatCard label="Rented Units" value={c.rentedAssets} icon="📦" accent="sky" to="/rentals" sub="currently out with customers" />
        <StatCard label="Customers" value={c.totalCustomers} icon="👥" accent="indigo" to="/customers" />
        <StatCard label="Active Rentals" value={c.activeRentals} icon="🔄" accent="sky" to="/rentals" sub="rentals in progress" />
        <StatCard label="Overdue Rentals" value={c.overdueRentals} icon="⏰" accent="rose" to="/overdue" sub={c.overdueRentals > 0 ? 'action required!' : 'all clear'} />
        <StatCard label="Pending Payments" value={inr(c.pendingPayments)} icon="💸" accent="amber" to="/payments" sub="outstanding balance" />
        <StatCard label="Total Revenue" value={inr(c.totalRevenue)} icon="💰" accent="emerald" to="/payments" sub="collected so far" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Recent rentals */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Recent Rentals</h2>
            <Link to="/rentals" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all →</Link>
          </div>
          {data.recentRentals.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No rentals yet. Create your first rental!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-2.5">Rental</th>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5">Due</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentRentals.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-indigo-600">
                        <Link to={`/rentals/${r.id}`}>{r.rentalNumber}</Link>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{r.customer?.name}</td>
                      <td className="px-3 py-3 text-slate-500">{fmtDate(r.dueDate)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{inr(r.grandTotal)}</td>
                      <td className="px-5 py-3"><StatusBadge map={RENTAL_STATUSES} status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Overdue rentals */}
        <section className="rounded-xl border border-rose-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-rose-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-rose-700">⚠️ Overdue Rentals</h2>
            <Link to="/overdue" className="text-sm font-medium text-rose-600 hover:text-rose-700">View all →</Link>
          </div>
          {data.overdueRentals.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No overdue rentals. 🎉</p>
          ) : (
            <div className="divide-y divide-rose-50">
              {data.overdueRentals.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <Link to={`/rentals/${r.id}`} className="text-sm font-semibold text-rose-700 hover:underline">
                      {r.rentalNumber}
                    </Link>
                    <p className="text-xs text-slate-500">{r.customerName} · {r.mobile}</p>
                    <p className="mt-0.5 text-xs text-rose-600">
                      {plural(r.remainingQuantity, 'unit')} out · overdue {r.overdueCharge ? `${inr(r.overdueCharge)} charge` : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">{inr(r.balanceAmount)}</p>
                    <p className="text-xs text-slate-400">due {fmtDate(r.dueDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent payments */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Recent Payments</h2>
            <Link to="/payments" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all →</Link>
          </div>
          {data.recentPayments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Rental</th>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5">Method</th>
                    <th className="px-5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayments.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-500">{fmtDate(p.paymentDate)}</td>
                      <td className="px-3 py-3">
                        <Link to={`/rentals/${p.rentalId}`} className="font-medium text-indigo-600">
                          {p.rental?.rentalNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{p.rental?.customer?.name}</td>
                      <td className="px-3 py-3 capitalize text-slate-500">{p.paymentMethod.toLowerCase().replace('_', ' ')}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-emerald-700">{inr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Top rented assets */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Top Rented Assets</h2>
          </div>
          {data.topRentedAssets.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No rental activity yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.topRentedAssets.map((a, i) => (
                <div key={a.assetId} className="flex items-center gap-4 px-5 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/assets/${a.assetId}`} className="text-sm font-medium text-slate-800 hover:text-indigo-600">
                      {a.name}
                    </Link>
                    <p className="text-xs text-slate-400">{a.assetCode} · {a.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{a.rentedQuantity} {a.unit}s</p>
                    <p className="text-xs text-rose-500">{a.damagedQuantity > 0 ? `${a.damagedQuantity} damaged` : 'no damage'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}