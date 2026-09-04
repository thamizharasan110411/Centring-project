import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import PaymentModal from '../components/PaymentModal';
import { Field, TextInput, PrimaryButton, SecondaryButton } from '../components/FormControls';
import { Spinner, ErrorState } from '../components/Loading';
import { RENTAL_STATUSES, INVOICE_STATUSES, RATE_TYPES } from '../utils/constants';
import { inr, num, fmtDate, plural, daysBetween } from '../utils/format';

export default function RentalDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const { data: rental, loading, error, refetch } = useFetch(
    () => client.get(`/rentals/${id}`).then((r) => r.data),
    [id]
  );

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminder, setReminder] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const paid = Number(rental.invoice?.paidAmount || 0);
  const canReturn = !['RETURNED', 'CLOSED'].includes(rental.status);
  const canPay = Number(rental.balanceAmount) > 0 && rental.status !== 'CLOSED';
  const canClose = rental.status === 'RETURNED' && Number(rental.balanceAmount) <= 0;

  const openEdit = () => {
    setEditForm({
      rentalDate: rental.rentalDate?.slice(0, 10),
      dueDate: rental.dueDate?.slice(0, 10),
      transportCharge: rental.transportCharge,
      otherCharge: rental.otherCharge,
      discount: rental.discount,
      securityDeposit: rental.securityDeposit,
      notes: rental.notes || '',
    });
    setEditOpen(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await client.put(`/rentals/${rental.id}`, {
        rentalDate: editForm.rentalDate,
        dueDate: editForm.dueDate,
        transportCharge: Number(editForm.transportCharge) || 0,
        otherCharge: Number(editForm.otherCharge) || 0,
        discount: Number(editForm.discount) || 0,
        securityDeposit: Number(editForm.securityDeposit) || 0,
        notes: editForm.notes || null,
      });
      toast.success(`${res.data.rentalNumber} updated`);
      setEditOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const sendReminder = async () => {
    try {
      const res = await client.get(`/rentals/${rental.id}/reminder`);
      setReminder(res.data);
      setReminderOpen(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openWhatsApp = () => {
    window.open(reminder.whatsappUrl, '_blank', 'noopener');
  };

  const closeRental = async () => {
    const ok = await confirm({
      title: 'Close this rental?',
      message: `Mark ${rental.rentalNumber} as CLOSED? Only possible when everything is returned and the balance is cleared.`,
      confirmText: 'Close Rental',
    });
    if (!ok) return;
    try {
      const res = await client.post(`/rentals/${rental.id}/close`);
      toast.success(`${res.data.rentalNumber} marked as closed`);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remainingTotal = (rental.items || []).reduce((s, it) => s + Number(it.remainingQuantity || 0), 0);

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{rental.rentalNumber} <StatusBadge map={RENTAL_STATUSES} status={rental.status} /></span>}
        subtitle={`Created ${fmtDate(rental.createdAt)}`}
      >
        <Link to="/rentals" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Rentals</Link>
        {rental.overdueDays > 0 && remainingTotal > 0 && (
          <button onClick={sendReminder} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            Send WhatsApp Reminder
          </button>
        )}
        {rental.invoice && (
          <Link to={`/invoices/${rental.invoice.id}`} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100">
            View Invoice
          </Link>
        )}
        {canReturn && <Link to={`/rentals/${rental.id}/return`} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">↩ Return Assets</Link>}
        {canPay && <button onClick={() => setPayOpen(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">Record Payment</button>}
        {canClose && <button onClick={closeRental} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">Mark Closed</button>}
        {rental.status !== 'CLOSED' && rental.status !== 'RETURNED' && (
          <button onClick={openEdit} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Edit</button>
        )}
      </PageHeader>

      {/* Overdue banner */}
      {rental.overdueDays > 0 && remainingTotal > 0 && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-rose-300 bg-rose-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-rose-700">⚠️ OVERDUE BY {rental.overdueDays} DAY{rental.overdueDays > 1 ? 'S' : ''}</p>
            <p className="text-sm text-rose-600">
              Due {fmtDate(rental.dueDate)} · {plural(remainingTotal, 'unit')} still out · Overdue charge: {inr(rental.overdueCharge)}
            </p>
          </div>
          <button onClick={sendReminder} className="self-start rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 sm:self-auto">
            Send Reminder
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Customer */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Customer</h2>
            <div className="flex items-center justify-between">
              <div>
                <Link to={`/customers/${rental.customerId}`} className="text-base font-bold text-slate-900 hover:text-indigo-600">{rental.customer?.name}</Link>
                <p className="text-sm text-slate-500 tabular-nums">{rental.customer?.mobile}{rental.customer?.alternateMobile ? ` · ${rental.customer.alternateMobile}` : ''}</p>
                {rental.customer?.projectName && <p className="text-sm text-slate-600">Project: {rental.customer.projectName}</p>}
              </div>
              <Link to={`/customers/${rental.customerId}`} className="text-sm font-medium text-indigo-600 hover:underline">Profile →</Link>
            </div>
          </section>

          {/* Items */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Rental Items</h2>
              <p className="text-xs text-slate-400">Rental date {fmtDate(rental.rentalDate)} · Due {fmtDate(rental.dueDate)} · {rental.returnDate ? `Returned ${fmtDate(rental.returnDate)}` : 'Not returned yet'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-3 py-3 text-right">Rented</th>
                    <th className="px-3 py-3 text-right">Returned</th>
                    <th className="px-3 py-3 text-right">Damaged</th>
                    <th className="px-3 py-3 text-right">Missing</th>
                    <th className="px-3 py-3 text-right">Remaining</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-3 py-3 text-right">Days</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rental.items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{it.asset?.name}</p>
                        <p className="text-xs text-slate-400">{it.asset?.assetCode} · {it.asset?.unit}</p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{num(it.rentedQuantity)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-600">{num(it.returnedQuantity)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-600">{num(it.damagedQuantity)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-rose-600">{num(it.missingQuantity)}</td>
                      <td className={`px-3 py-3 text-right font-semibold tabular-nums ${it.remainingQuantity > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{num(it.remainingQuantity)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{inr(it.rentalRate)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{it.rentalDays}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{inr(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Returns */}
          {rental.returns?.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-800">Return History</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {rental.returns.map((ret) => (
                  <div key={ret.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-700">Return on {fmtDate(ret.returnDate)} {ret.notes && <span className="font-normal text-slate-400">— {ret.notes}</span>}</p>
                    <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                      {(ret.items || []).map((ri) => (
                        <p key={ri.id}>
                          {ri.returnedQuantity > 0 && `${ri.returnedQuantity} returned`}
                          {ri.missingQuantity > 0 && ` · ${ri.missingQuantity} missing`}
                          {ri.damagedQuantity > 0 && ` · ${ri.damagedQuantity} damaged`}
                          {Number(ri.damageCharge) > 0 && ` (+${inr(ri.damageCharge)})`}
                          {Number(ri.missingCharge) > 0 && ` (+${inr(ri.missingCharge)})`}
                        </p>
                      ))}
                      {ret.missingDetails && (
                        <p className="mt-1 rounded bg-amber-50 px-2 py-1 font-medium text-amber-800">
                          Missing pieces: {ret.missingDetails}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Payments */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Payments</h2>
              {canPay && <button onClick={() => setPayOpen(true)} className="text-sm font-medium text-indigo-600 hover:underline">+ Record Payment</button>}
            </div>
            {rental.payments?.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Method</th>
                      <th className="px-3 py-2.5">Reference</th>
                      <th className="px-3 py-2.5">Notes</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rental.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 text-slate-600">{fmtDate(p.paymentDate)}</td>
                        <td className="px-3 py-2.5 capitalize text-slate-600">{p.paymentMethod.toLowerCase().replace('_', ' ')}</td>
                        <td className="px-3 py-2.5 text-slate-500">{p.referenceNumber || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500">{p.notes || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700">{inr(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right column: charges */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Charges & Totals</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{inr(rental.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Transport</span><span className="tabular-nums">{inr(rental.transportCharge)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Other</span><span className="tabular-nums">{inr(rental.otherCharge)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="tabular-nums">− {inr(rental.discount)}</span></div>
              {Number(rental.overdueCharge) > 0 && (
                <div className="flex justify-between font-medium text-rose-600"><span>Overdue ({rental.overdueDays} days)</span><span className="tabular-nums">+ {inr(rental.overdueCharge)}</span></div>
              )}
              {Number(rental.damageCharge) > 0 && (
                <div className="flex justify-between text-amber-600"><span>Damage</span><span className="tabular-nums">+ {inr(rental.damageCharge)}</span></div>
              )}
              {Number(rental.missingCharge) > 0 && (
                <div className="flex justify-between text-amber-600"><span>Missing</span><span className="tabular-nums">+ {inr(rental.missingCharge)}</span></div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Grand Total</span><span className="tabular-nums">{inr(rental.grandTotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Security Deposit</span><span className="tabular-nums">{inr(rental.securityDeposit)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="tabular-nums text-emerald-600">{inr(paid)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><span>Balance</span><span className={`tabular-nums ${Number(rental.balanceAmount) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{inr(rental.balanceAmount)}</span></div>
            </div>
          </section>

          {rental.notes && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Notes</h2>
              <p className="text-sm text-slate-600">{rental.notes}</p>
            </section>
          )}

          {rental.invoice && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Invoice</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Number</span><span className="font-medium">{rental.invoice.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Date</span><span>{fmtDate(rental.invoice.invoiceDate)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge map={INVOICE_STATUSES} status={rental.invoice.status} /></div>
              </div>
              <Link to={`/invoices/${rental.invoice.id}`} className="mt-4 block rounded-lg bg-slate-800 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-slate-900">
                Open Invoice →
              </Link>
            </section>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${rental.rentalNumber}`} wide>
        {editForm && (
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rental Date" required>
                <TextInput type="date" value={editForm.rentalDate} onChange={(e) => setEditForm({ ...editForm, rentalDate: e.target.value })} />
              </Field>
              <Field label="Due Date" required>
                <TextInput type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
              </Field>
              <Field label="Transport Charge (₹)">
                <TextInput type="number" min="0" step="0.01" value={editForm.transportCharge} onChange={(e) => setEditForm({ ...editForm, transportCharge: e.target.value })} />
              </Field>
              <Field label="Other Charge (₹)">
                <TextInput type="number" min="0" step="0.01" value={editForm.otherCharge} onChange={(e) => setEditForm({ ...editForm, otherCharge: e.target.value })} />
              </Field>
              <Field label="Discount (₹)">
                <TextInput type="number" min="0" step="0.01" value={editForm.discount} onChange={(e) => setEditForm({ ...editForm, discount: e.target.value })} />
              </Field>
              <Field label="Security Deposit (₹)">
                <TextInput type="number" min="0" step="0.01" value={editForm.securityDeposit} onChange={(e) => setEditForm({ ...editForm, securityDeposit: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <TextInput value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </Field>
              </div>
            </div>
            <p className="text-xs text-slate-400">Item quantities cannot be edited after creation — they affect inventory.</p>
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <SecondaryButton type="button" onClick={() => setEditOpen(false)}>Cancel</SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</PrimaryButton>
            </div>
          </form>
        )}
      </Modal>

      {/* Reminder modal */}
      <Modal open={reminderOpen} onClose={() => setReminderOpen(false)} title="WhatsApp Reminder">
        {reminder && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">This opens WhatsApp with the message below. It is <b>not</b> sent automatically.</p>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">To: {reminder.customerName} · {reminder.mobile}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{reminder.message}</p>
            </div>
            <div className="flex justify-end gap-3">
              <SecondaryButton onClick={() => setReminderOpen(false)}>Close</SecondaryButton>
              <PrimaryButton onClick={openWhatsApp}>Open WhatsApp ↗</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      {payOpen && <PaymentModal rentalId={rental.id} onClose={() => setPayOpen(false)} onSaved={refetch} />}
    </div>
  );
}