import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { Field, TextInput, PrimaryButton, SecondaryButton } from '../components/FormControls';
import { Spinner, ErrorState, EmptyState } from '../components/Loading';
import { RENTAL_STATUSES } from '../utils/constants';
import { inr, num, fmtDate, plural, daysBetween } from '../utils/format';

export default function ReturnPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  // Rental selector (used on /returns without a rental id)
  const { data: openRentals, loading: listLoading } = useFetch(
    () =>
      client
        .get('/rentals', { params: { limit: 100, status: 'ACTIVE,PARTIALLY_RETURNED,OVERDUE' } })
        .then((r) => r.data),
    []
  );

  const [rentalId, setRentalId] = useState(routeId || '');

  useEffect(() => {
    if (routeId) setRentalId(routeId);
  }, [routeId]);

  const { data: rental, loading, error, refetch } = useFetch(
    () => (rentalId ? client.get(`/rentals/${rentalId}`).then((r) => r.data) : Promise.resolve(null)),
    [rentalId]
  );

  // Return lines: one per item with remaining quantity
  const initialLines = useMemo(() => {
    if (!rental) return [];
    return (rental.items || [])
      .filter((it) => Number(it.remainingQuantity) > 0)
      .map((it) => ({
        rentalItemId: it.id,
        asset: it.asset,
        rentedQuantity: it.rentedQuantity,
        previouslyReturned: Number(it.returnedQuantity) + Number(it.damagedQuantity) + Number(it.missingQuantity),
        remaining: Number(it.remainingQuantity),
        rate: Number(it.rentalRate),
        returned: '',
        damaged: '',
        missing: '',
        damageCharge: '',
        error: null,
      }));
  }, [rental]);

  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState('');
  const [missingDetails, setMissingDetails] = useState('');
  const [damageDetails, setDamageDetails] = useState('');
  const [overdueDays, setOverdueDays] = useState('');
  const [overdueCharge, setOverdueCharge] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLines(initialLines);
  }, [initialLines]);

  // Display-only: whole days between the due date and today. The CHARGE itself
  // is manual — this value only pre-fills the "Overdue Days" field.
  const computedOverdueDays = rental ? Math.max(0, daysBetween(rental.dueDate, new Date())) : 0;
  useEffect(() => {
    if (computedOverdueDays > 0 && overdueDays === '') {
      setOverdueDays(String(computedOverdueDays));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedOverdueDays]);

  const remainingTotal = (rental?.items || []).reduce((s, it) => s + Number(it.remainingQuantity || 0), 0);
  const setLine = (idx, patch) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch, error: null } : l)));

  // When the damaged quantity changes, suggest qty × rate as the damage charge
  // (still fully editable by the user).
  const setDamaged = (idx, value) => {
    const l = lines[idx];
    const v = String(value);
    const suggestion = Number(v) > 0 ? String(Number(v) * l.rate) : '';
    setLine(idx, { damaged: v, damageCharge: suggestion });
  };

  const validate = () => {
    const errs = lines.map((l) => {
      const returned = Number(l.returned) || 0;
      const damaged = Number(l.damaged) || 0;
      const missing = Number(l.missing) || 0;
      const total = returned + damaged + missing;
      if (!Number.isInteger(returned) || !Number.isInteger(damaged) || !Number.isInteger(missing) || returned < 0 || damaged < 0 || missing < 0) {
        return 'Quantities must be whole numbers (0 or more)';
      }
      if (total > l.remaining) return `Only ${l.remaining} ${l.asset?.unit}(s) remaining`;
      if (l.damageCharge !== '' && (!isFinite(Number(l.damageCharge)) || Number(l.damageCharge) < 0)) {
        return 'Damage charge must be a valid amount (₹)';
      }
      return null; // zero lines are simply skipped
    });
    setLines((ls) => ls.map((l, i) => ({ ...l, error: errs[i] })));
    return errs.every((e) => !e);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted quantities.');
      return;
    }
    const od = overdueCharge === '' ? 0 : Number(overdueCharge);
    if (!isFinite(od) || od < 0) {
      toast.error('Overdue charge must be a valid amount (₹).');
      return;
    }
    const odDays = overdueDays === '' ? 0 : Number(overdueDays);
    if (!Number.isInteger(odDays) || odDays < 0) {
      toast.error('Overdue days must be a whole number (0 or more).');
      return;
    }
    setSubmitting(true);
    try {
      const items = lines
        .filter((l) => (Number(l.returned) || 0) + (Number(l.damaged) || 0) + (Number(l.missing) || 0) > 0)
        .map((l) => ({
          rentalItemId: l.rentalItemId,
          returnedQuantity: Number(l.returned) || 0,
          damagedQuantity: Number(l.damaged) || 0,
          damageCharge: l.damageCharge === '' ? undefined : Number(l.damageCharge) || 0,
          missingQuantity: Number(l.missing) || 0,
        }));
      if (items.length === 0) {
        toast.error('Enter at least one return, damaged or missing quantity.');
        setSubmitting(false);
        return;
      }
      const res = await client.post(`/rentals/${rentalId}/return`, {
        notes: notes || null,
        missingDetails: missingDetails || null,
        damageDetails: damageDetails || null,
        overdueDays: odDays || null,
        overdueCharge: od > 0 ? od : null,
        items,
      });
      const updated = res.data.rental;
      const bits = [];
      if (od > 0) bits.push(`${inr(od)} overdue`);
      const damageTotal = items.reduce((s, i) => s + (Number(i.damageCharge) || 0), 0);
      if (damageTotal > 0) bits.push(`${inr(damageTotal)} damage`);
      const suffix = bits.length ? ` · +${bits.join(' + ')} added to the bill` : '';
      toast.success(`Return recorded — ${updated.rentalNumber} is now ${updated.status.toLowerCase().replace('_', ' ')}${suffix}`);
      if (routeId) {
        navigate(`/rentals/${rentalId}`, { replace: true });
      } else {
        refetch();
        setNotes('');
        setMissingDetails('');
        setDamageDetails('');
        setOverdueDays('');
        setOverdueCharge('');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (listLoading && !routeId) return <Spinner />;

  return (
    <div>
      <PageHeader title="Return Assets" subtitle="Record returned, damaged and missing quantities — inventory updates automatically">
        <Link to="/rentals" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Rentals</Link>
      </PageHeader>

      {!routeId && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Field label="Select an active rental">
            <select
              value={rentalId}
              onChange={(e) => setRentalId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Choose a rental to process a return…</option>
              {(openRentals || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.rentalNumber} — {r.customer?.name} ({r.status.toLowerCase().replace('_', ' ')})
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {!rentalId || !rental ? (
        !routeId ? (
          <EmptyState title="Select a rental" message="Choose an active, partially returned or overdue rental above to record a return." />
        ) : (
          <EmptyState title="Rental not found" message="This rental may not exist." />
        )
      ) : loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <form onSubmit={submit} className="space-y-6">
          {/* Rental summary */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-base font-bold text-slate-900">{rental.rentalNumber} <StatusBadge map={RENTAL_STATUSES} status={rental.status} /></p>
                <p className="mt-0.5 text-sm text-slate-600">{rental.customer?.name} · {rental.customer?.mobile}</p>
                {rental.customer?.projectName && <p className="text-sm text-slate-500">{rental.customer.projectName}</p>}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:text-right">
                <span className="text-slate-500">Rental Date</span><span className="font-medium">{fmtDate(rental.rentalDate)}</span>
                <span className="text-slate-500">Due Date</span><span className="font-medium">{fmtDate(rental.dueDate)}</span>
                <span className="text-slate-500">Units out</span><span className="font-semibold">{plural(remainingTotal, 'unit')}</span>
                <span className="text-slate-500">Balance</span><span className="font-semibold tabular-nums">{inr(rental.balanceAmount)}</span>
              </div>
            </div>
          </section>

          {/* Overdue charge — MANUAL */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Overdue Charge</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Manual — set by you
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Enter the overdue days and the charge you want to add to the bill. Nothing is calculated automatically.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Due Date</p>
                <p className="font-semibold text-slate-800">{fmtDate(rental.dueDate)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Return Date</p>
                <p className="font-semibold text-slate-800">{fmtDate(new Date())}</p>
              </div>
              <Field label="Overdue Days">
                <TextInput
                  type="number"
                  min="0"
                  value={overdueDays}
                  onChange={(e) => setOverdueDays(e.target.value)}
                  placeholder={computedOverdueDays > 0 ? `${computedOverdueDays} (computed)` : '0'}
                />
              </Field>
              <Field label="Overdue Charge (₹)">
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={overdueCharge}
                  onChange={(e) => setOverdueCharge(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
            {Number(rental.overdueCharge) > 0 && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                Already charged on this rental: {inr(rental.overdueCharge)} — this return adds on top of it.
              </p>
            )}
          </section>

          {/* Return lines */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Quantities</h2>
            {lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">All quantities have been returned for this rental.</p>
            ) : (
              <div className="space-y-4">
                {lines.map((l, idx) => {
                  const damaged = Number(l.damaged) || 0;
                  return (
                    <div key={l.rentalItemId} className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{l.asset?.name}</p>
                          <p className="text-xs text-slate-400">{l.asset?.assetCode} · {l.asset?.unit} · rate {inr(l.rate)}</p>
                        </div>
                        <div className="flex gap-4 text-xs text-slate-500">
                          <span>Rented: <b className="text-slate-700">{num(l.rentedQuantity)}</b></span>
                          <span>Returned: <b className="text-emerald-600">{num(l.previouslyReturned)}</b></span>
                          <span>Remaining: <b className="text-rose-600">{num(l.remaining)}</b></span>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label={`Return (${l.asset?.unit})`}>
                          <TextInput type="number" min="0" value={l.returned} onChange={(e) => setLine(idx, { returned: e.target.value })} placeholder="0" />
                        </Field>
                        <Field label={`Damaged (${l.asset?.unit})`} hint="Charged at the rate below — not restocked">
                          <TextInput type="number" min="0" value={l.damaged} onChange={(e) => setDamaged(idx, e.target.value)} placeholder="0" />
                        </Field>
                        <Field label={`Missing Piece (${l.asset?.unit})`} hint="Not restocked and not charged — recorded for the report">
                          <TextInput type="number" min="0" value={l.missing} onChange={(e) => setLine(idx, { missing: e.target.value })} placeholder="0" />
                        </Field>
                      </div>
                      {damaged > 0 && (
                        <div className="mt-3 sm:max-w-xs">
                          <Field label="Damage Charge (₹)" hint={`Suggested ${inr(damaged * l.rate)} (qty × rate) — editable`}>
                            <TextInput
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.damageCharge}
                              onChange={(e) => setLine(idx, { damageCharge: e.target.value })}
                              placeholder="0.00"
                            />
                          </Field>
                        </div>
                      )}
                      {l.error && <p className="mt-1 text-xs font-medium text-rose-600">{l.error}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Return Notes">
                <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Site cleared, all materials counted" />
              </Field>
              <Field label="Missing Piece Details" hint="Describe which pieces are missing, e.g. '12 couplers, 5 base jacks — site supervisor informed'">
                <TextInput value={missingDetails} onChange={(e) => setMissingDetails(e.target.value)} placeholder="e.g. 10 clamps not found at site" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Damage Details" hint="Describe what was damaged, e.g. '6 plates bent, 3 props bent — photos shared'">
                  <TextInput value={damageDetails} onChange={(e) => setDamageDetails(e.target.value)} placeholder="e.g. 5 wooden battens cracked at site" />
                </Field>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Only good returns are added back to available inventory — damaged items are charged (not restocked), missing pieces are recorded (never restocked) and both appear on the return summary, invoice and report.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <SecondaryButton type="button" onClick={() => navigate(routeId ? `/rentals/${rentalId}` : -1)}>Cancel</SecondaryButton>
              <PrimaryButton type="submit" disabled={submitting || lines.length === 0}>
                {submitting ? 'Submitting…' : 'Submit Return'}
              </PrimaryButton>
            </div>
          </section>
        </form>
      )}
    </div>
  );
}