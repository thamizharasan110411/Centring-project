import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/PageHeader';
import Combobox from '../components/Combobox';
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from '../components/FormControls';
import { Spinner, ErrorState } from '../components/Loading';
import { PAYMENT_METHODS, RATE_TYPES } from '../utils/constants';
import { inr, todayInput, addDaysInput, daysBetween } from '../utils/format';

/** Mirrors the backend billing rule: PER_WEEK bills per started week, PER_MONTH per started month. */
function lineAmount(qty, rate, days, rateType) {
  const factor = rateType === 'PER_WEEK' ? 7 : rateType === 'PER_MONTH' ? 30 : 1;
  const billable = Math.max(1, Math.ceil(Number(days) / factor));
  return Math.round(Number(qty || 0) * Number(rate || 0) * billable * 100) / 100;
}

const emptyRow = (days) => ({ assetId: '', quantity: '', rate: '', days: String(days), error: null });

export default function NewRentalPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const { data: customers, loading: customersLoading, error: customersError } = useFetch(
    () => client.get('/customers', { params: { limit: 100 } }).then((r) => r.data),
    []
  );
  const { data: assets, loading: assetsLoading, error: assetsError } = useFetch(
    () => client.get('/assets', { params: { limit: 100 } }).then((r) => r.data),
    []
  );

  const [customerId, setCustomerId] = useState('');
  const [rentalDate, setRentalDate] = useState(todayInput());
  const [dueDate, setDueDate] = useState(addDaysInput(15));
  const [transportCharge, setTransportCharge] = useState('');
  const [otherCharge, setOtherCharge] = useState('');
  const [discount, setDiscount] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([emptyRow(15)]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const assetMap = useMemo(() => new Map((assets || []).map((a) => [a.id, a])), [assets]);
  const rentableAssets = useMemo(() => (assets || []).filter((a) => Number(a.availableQuantity) > 0), [assets]);

  const selectedCustomer = customers?.find((c) => String(c.id) === String(customerId));

  const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));

  const subtotal = rows.reduce((sum, row) => {
    const asset = assetMap.get(Number(row.assetId));
    return sum + lineAmount(row.quantity, row.rate, row.days, asset?.rateType);
  }, 0);
  const grandTotal = Math.max(0, subtotal + num(transportCharge) + num(otherCharge) - num(discount));
  const balance = grandTotal - num(advancePaid);

  const setRow = (idx, patch) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch, error: null } : r)));

  const addRow = () => setRows((rs) => [...rs, emptyRow(Math.max(1, daysBetween(rentalDate, dueDate)))]);
  const removeRow = (idx) => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== idx) : rs));

  const daysForDates = Math.max(1, daysBetween(rentalDate, dueDate));

  const validate = () => {
    const errs = {};
    if (!customerId) errs.customer = 'Select a customer';
    if (!rentalDate) errs.rentalDate = 'Select a rental date';
    if (!dueDate) errs.dueDate = 'Select a due date';
    else if (rentalDate && dueDate < rentalDate) errs.dueDate = 'Due date cannot be before rental date';

    let hasAsset = false;
    const rowErrors = rows.map((row) => {
      const asset = assetMap.get(Number(row.assetId));
      if (!row.assetId) return 'Select an asset';
      hasAsset = true;
      const qty = Number(row.quantity);
      if (!Number.isInteger(qty) || qty <= 0) return 'Qty must be a positive whole number';
      if (asset && qty > Number(asset.availableQuantity)) return `Only ${asset.availableQuantity} ${asset.unit}(s) available`;
      if (!(Number(row.rate) > 0)) return 'Enter a valid rate';
      if (!(Number(row.days) >= 1)) return 'Enter days (≥ 1)';
      return null;
    });
    if (!hasAsset) errs.rows = 'Add at least one asset';
    setRows((rs) => rs.map((r, i) => ({ ...r, error: rowErrors[i] })));
    setErrors(errs);
    return Object.keys(errs).length === 0 && rowErrors.every((e) => !e);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customerId: Number(customerId),
        rentalDate,
        dueDate,
        transportCharge: num(transportCharge),
        otherCharge: num(otherCharge),
        discount: num(discount),
        securityDeposit: num(securityDeposit),
        advancePaid: num(advancePaid),
        paymentMethod,
        notes: notes || null,
        items: rows.map((row) => ({
          assetId: Number(row.assetId),
          quantity: Number(row.quantity),
          rate: Number(row.rate),
          days: Number(row.days),
        })),
      };
      const res = await client.post('/rentals', payload);
      toast.success(`Rental ${res.data.rentalNumber} created — inventory updated`);
      navigate(`/rentals/${res.data.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (customersLoading || assetsLoading) return <Spinner />;
  if (customersError) return <ErrorState error={customersError} />;
  if (assetsError) return <ErrorState error={assetsError} />;

  return (
    <div>
      <PageHeader title="New Rental" subtitle="Create a rental — inventory and invoice update automatically">
        <Link to="/rentals" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Rentals</Link>
      </PageHeader>

      <form onSubmit={submit} className="space-y-6">
        {/* Customer */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">1 · Customer</h2>
          <Field label="Customer" required error={errors.customer}>
            <Combobox
              options={customers || []}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Search and select customer…"
              getLabel={(c) => `${c.name} (${c.customerCode})`}
              getSub={(c) => `${c.mobile} · ${c.projectName || 'No project'}`}
              error={errors.customer}
            />
          </Field>
          {selectedCustomer && (
            <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm sm:grid-cols-3">
              <div><p className="text-xs text-slate-400">Mobile</p><p className="font-medium tabular-nums">{selectedCustomer.mobile}</p></div>
              <div><p className="text-xs text-slate-400">Project</p><p className="font-medium">{selectedCustomer.projectName || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Address</p><p className="font-medium">{selectedCustomer.address || '—'}</p></div>
            </div>
          )}
        </section>

        {/* Rental details */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">2 · Rental Details</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Rental Number" hint="Auto-generated">
              <TextInput value="RNT-XXXX (auto)" disabled className="bg-slate-50 text-slate-400" />
            </Field>
            <Field label="Rental Date" required error={errors.rentalDate}>
              <TextInput type="date" value={rentalDate} onChange={(e) => setRentalDate(e.target.value)} error={errors.rentalDate} />
            </Field>
            <Field label="Due Date" required error={errors.dueDate}>
              <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} error={errors.dueDate} />
            </Field>
            <Field label="Advance Payment Method">
              <SelectInput value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Security Deposit (₹)">
              <TextInput type="number" min="0" step="0.01" value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Transport Charge (₹)">
              <TextInput type="number" min="0" step="0.01" value={transportCharge} onChange={(e) => setTransportCharge(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Other Charge (₹)">
              <TextInput type="number" min="0" step="0.01" value={otherCharge} onChange={(e) => setOtherCharge(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Discount (₹)">
              <TextInput type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Advance Paid (₹)">
              <TextInput type="number" min="0" step="0.01" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
        </section>

        {/* Assets */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">3 · Add Assets</h2>
            <SecondaryButton type="button" onClick={addRow}>+ Add Row</SecondaryButton>
          </div>
          {errors.rows && <p className="mb-3 text-sm font-medium text-rose-600">{errors.rows}</p>}

          <div className="space-y-3">
            {rows.map((row, idx) => {
              const asset = assetMap.get(Number(row.assetId));
              return (
                <div key={idx} className="rounded-lg border border-slate-200 p-3">
                  <div className="grid gap-3 sm:grid-cols-6">
                    <div className="sm:col-span-2">
                      <Field label="Asset">
                        <Combobox
                          options={rentableAssets}
                          value={row.assetId}
                          onChange={(id) => {
                            const a = assetMap.get(Number(id));
                            setRow(idx, { assetId: id, rate: a ? a.rentalRate : '', days: row.days || daysForDates });
                          }}
                          placeholder="Select asset…"
                          getLabel={(a) => `${a.name} (${a.assetCode})`}
                          getSub={(a) => `Available: ${a.availableQuantity} ${a.unit} · ${inr(a.rentalRate)}/${RATE_TYPES.find((r) => r.value === a.rateType)?.label?.toLowerCase().replace('per ', '')}`}
                          error={row.error}
                        />
                      </Field>
                    </div>
                    <div>
                      <Field label={`Available (${asset?.unit || 'unit'})`}>
                        <TextInput value={asset ? asset.availableQuantity : '—'} disabled className="bg-slate-50" />
                      </Field>
                    </div>
                    <div>
                      <Field label="Rental Qty" required>
                        <TextInput type="number" min="1" value={row.quantity} onChange={(e) => setRow(idx, { quantity: e.target.value })} placeholder="0" />
                      </Field>
                    </div>
                    <div>
                      <Field label="Rate (₹)">
                        <TextInput type="number" min="0" step="0.01" value={row.rate} onChange={(e) => setRow(idx, { rate: e.target.value })} placeholder="0.00" />
                      </Field>
                    </div>
                    <div>
                      <Field label="Days">
                        <TextInput type="number" min="1" value={row.days} onChange={(e) => setRow(idx, { days: e.target.value })} placeholder="0" />
                      </Field>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      Amount: <span className="font-bold text-slate-900">{inr(lineAmount(row.quantity, row.rate, row.days, asset?.rateType))}</span>
                      {asset && <span className="ml-2 text-xs text-slate-400">({asset.rateType === 'PER_DAY' ? 'per day' : asset.rateType === 'PER_WEEK' ? 'per week' : 'per month'} billing)</span>}
                    </p>
                    <button type="button" onClick={() => removeRow(idx)} disabled={rows.length === 1}
                      className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40">
                      Remove
                    </button>
                  </div>
                  {row.error && <p className="mt-1 text-xs font-medium text-rose-600">{row.error}</p>}
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="mt-5 flex flex-col gap-4 rounded-lg bg-slate-50 p-4 sm:flex-row sm:justify-end">
            <div className="w-full space-y-1.5 text-sm sm:w-72">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium tabular-nums">{inr(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Transport Charge</span><span className="tabular-nums">+ {inr(num(transportCharge))}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Other Charge</span><span className="tabular-nums">+ {inr(num(otherCharge))}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="tabular-nums">− {inr(num(discount))}</span></div>
              <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-slate-900"><span>Grand Total</span><span className="tabular-nums">{inr(grandTotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Advance Paid</span><span className="tabular-nums">− {inr(num(advancePaid))}</span></div>
              <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold"><span>Balance Due</span><span className={`tabular-nums ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{inr(balance)}</span></div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Field label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for this rental" />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => navigate('/rentals')}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Rental & Generate Invoice'}
            </PrimaryButton>
          </div>
        </section>
      </form>
    </div>
  );
}