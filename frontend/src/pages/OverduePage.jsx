import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { RENTAL_STATUSES } from '../utils/constants';
import { Spinner, EmptyState, ErrorState } from '../components/Loading';
import { PrimaryButton, SecondaryButton } from '../components/FormControls';
import { inr, num, fmtDate, plural } from '../utils/format';

export default function OverduePage() {
  const toast = useToast();
  const { data: rows, loading, error, refetch } = useFetch(
    () => client.get('/rentals/overdue').then((r) => r.data)
  );

  const [reminder, setReminder] = useState(null);
  const [reminderFor, setReminderFor] = useState(null);
  const [loadingReminder, setLoadingReminder] = useState(false);

  const sendReminder = async (rentalId) => {
    setLoadingReminder(true);
    setReminderFor(rentalId);
    try {
      const res = await client.get(`/rentals/${rentalId}/reminder`);
      setReminder(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingReminder(false);
      setReminderFor(null);
    }
  };

  const openWhatsApp = () => window.open(reminder.whatsappUrl, '_blank', 'noopener');

  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  // Group rows by rental for the reminder buttons
  const byRental = {};
  for (const row of rows || []) {
    if (!byRental[row.rentalId]) {
      byRental[row.rentalId] = { ...row, items: [] };
    }
    byRental[row.rentalId].items.push(row);
  }
  const groups = Object.values(byRental);

  return (
    <div>
      <PageHeader
        title="Overdue Rentals"
        subtitle={groups.length ? `${groups.length} rental${groups.length > 1 ? 's' : ''} past due with un-returned materials` : 'No overdue rentals'}
      >
        {groups.length > 0 && (
          <span className="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
            ⚠️ {groups.length} OVERDUE
          </span>
        )}
      </PageHeader>

      {groups.length === 0 ? (
        <EmptyState
          title="No overdue rentals 🎉"
          message="Rentals become overdue automatically when the due date passes with materials still out."
          action={<Link to="/rentals" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">View Rentals</Link>}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const totalOverdueCharge = g.items.reduce((s, i) => s + Number(i.overdueCharge), 0);
            return (
              <section key={g.rentalId} className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm">
                {/* Header */}
                <div className="flex flex-col gap-3 border-b border-rose-100 bg-rose-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link to={`/rentals/${g.rentalId}`} className="text-base font-bold text-rose-700 hover:underline">{g.rentalNumber}</Link>
                    <StatusBadge map={RENTAL_STATUSES} status={g.status} />
                    <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">⚠️ OVERDUE BY {g.extraDays} DAY{g.extraDays > 1 ? 'S' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p className="text-slate-500">Balance <span className="font-bold text-slate-900 tabular-nums">{inr(g.rentalBalance)}</span></p>
                      <p className="text-xs text-rose-600">Overdue charge {inr(totalOverdueCharge)}</p>
                    </div>
                    <button
                      onClick={() => sendReminder(g.rentalId)}
                      disabled={loadingReminder}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {loadingReminder && reminderFor === g.rentalId ? '…' : 'Send Reminder'}
                    </button>
                    <Link to={`/rentals/${g.rentalId}/return`} className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                      Return
                    </Link>
                  </div>
                </div>

                {/* Items */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-3 py-2.5">Mobile</th>
                        <th className="px-3 py-2.5">Asset</th>
                        <th className="px-3 py-2.5 text-right">Remaining</th>
                        <th className="px-3 py-2.5">Due Date</th>
                        <th className="px-3 py-2.5 text-right">Extra Days</th>
                        <th className="px-3 py-2.5 text-right">Daily Rate</th>
                        <th className="px-4 py-2.5 text-right">Overdue Charge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {g.items.map((row, i) => (
                        <tr key={`${row.rentalId}-${row.assetId}-${i}`}>
                          <td className="px-4 py-2.5">
                            <Link to={`/customers/${row.customerId}`} className="font-medium text-slate-800 hover:text-indigo-600">{row.customerName}</Link>
                            <span className="block text-xs text-slate-400">{row.customerProject || ''}</span>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-600">{row.customerMobile}</td>
                          <td className="px-3 py-2.5 text-slate-700">{row.assetName}<span className="block text-xs text-slate-400">{row.unit}</span></td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-rose-600">{num(row.remainingQuantity)}</td>
                          <td className="px-3 py-2.5 text-slate-600 tabular-nums">{fmtDate(row.dueDate)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.extraDays}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{inr(row.dailyRate)}</td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums text-rose-600">{inr(row.overdueCharge)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-rose-50/50">
                      <tr>
                        <td colSpan={6} className="px-4 py-2.5 text-right text-sm font-semibold text-slate-600">
                          {plural(g.items.reduce((s, r) => s + Number(r.remainingQuantity), 0), 'unit')} still out
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-400">Total overdue</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums text-rose-700">{inr(totalOverdueCharge)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Reminder modal */}
      <Modal open={Boolean(reminder)} onClose={() => setReminder(null)} title="WhatsApp Reminder">
        {reminder && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">This opens WhatsApp with the message below. It is <b>not</b> sent automatically.</p>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                To: {reminder.customerName} · {reminder.mobile}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{reminder.message}</p>
            </div>
            <div className="flex justify-end gap-3">
              <SecondaryButton onClick={() => setReminder(null)}>Close</SecondaryButton>
              <PrimaryButton onClick={openWhatsApp}>Open WhatsApp ↗</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}