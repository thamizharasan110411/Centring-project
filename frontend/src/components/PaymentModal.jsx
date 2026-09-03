import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Modal from './Modal';
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from './FormControls';
import { PAYMENT_METHODS } from '../utils/constants';
import { inr, todayInput } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/useFetch';

/**
 * Modal to record a payment.
 *  - rentalId (optional): pre-select a specific rental.
 *  - onSaved: called with the API response after a successful payment.
 */
export default function PaymentModal({ rentalId, onClose, onSaved }) {
  const toast = useToast();
  const [rentals, setRentals] = useState([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(rentalId || '');
  const [form, setForm] = useState({
    paymentDate: todayInput(),
    amount: '',
    paymentMethod: 'CASH',
    referenceNumber: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Fetch rentals that still carry a balance.
  const { data: listData } = useFetch(
    () => client.get('/rentals', { params: { limit: 100, status: 'ACTIVE,PARTIALLY_RETURNED,OVERDUE,RETURNED' } }).then((r) => r.data),
    []
  );
  const outstandingRentals = useMemo(
    () => (listData || []).filter((r) => Number(r.balanceAmount) > 0),
    [listData]
  );

  // If we were given a specific rental id, load it (it may not be in the list).
  useEffect(() => {
    if (!rentalId) return;
    setRentalsLoading(true);
    client
      .get(`/rentals/${rentalId}`)
      .then((r) => {
        setRentals((prev) => (prev.some((x) => x.id === r.data.id) ? prev : [r.data, ...prev]));
      })
      .catch(() => toast.error('Could not load rental details'))
      .finally(() => setRentalsLoading(false));
  }, [rentalId, toast]);

  const allRentals = useMemo(() => {
    const map = new Map();
    for (const r of outstandingRentals) map.set(r.id, r);
    for (const r of rentals) map.set(r.id, r);
    return [...map.values()];
  }, [outstandingRentals, rentals]);

  const selected = allRentals.find((r) => String(r.id) === String(selectedId));

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!selectedId) errs.rental = 'Select a rental';
    const amount = Number(form.amount);
    if (!(amount > 0)) errs.amount = 'Enter an amount greater than zero';
    if (!form.paymentDate) errs.paymentDate = 'Select a payment date';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await client.post('/payments', {
        rentalId: Number(selectedId),
        paymentDate: form.paymentDate,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        referenceNumber: form.referenceNumber || null,
        notes: form.notes || null,
      });
      toast.success(`Payment of ${inr(form.amount)} recorded against ${res.data.rental.rentalNumber}`);
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Record Payment" wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rental" required error={errors.rental}>
            <SelectInput
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={Boolean(rentalId) || rentalsLoading}
              error={errors.rental}
            >
              <option value="">Select rental…</option>
              {allRentals.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.rentalNumber} — {r.customer?.name} (balance {inr(r.balanceAmount)})
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Payment Date" required error={errors.paymentDate}>
            <TextInput type="date" value={form.paymentDate} onChange={set('paymentDate')} error={errors.paymentDate} />
          </Field>
          <Field label="Amount (₹)" required error={errors.amount}>
            <TextInput type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={set('amount')} error={errors.amount} />
          </Field>
          <Field label="Payment Method" required>
            <SelectInput value={form.paymentMethod} onChange={set('paymentMethod')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Reference Number">
            <TextInput placeholder="e.g. UPI ref / cheque no." value={form.referenceNumber} onChange={set('referenceNumber')} />
          </Field>
          <Field label="Notes">
            <TextInput placeholder="Optional" value={form.notes} onChange={set('notes')} />
          </Field>
        </div>

        {selected && (
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Balance for <span className="font-semibold">{selected.rentalNumber}</span>:{' '}
            <span className="font-bold text-slate-900">{inr(selected.balanceAmount)}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}