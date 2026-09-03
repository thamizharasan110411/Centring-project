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
        missingCharge: '',
        error: null,
      }));
  }, [rental]);

  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLines(initialLines);
  }, [initialLines]);

  const remainingTotal = (rental?.items || []).reduce((s, it) => s + Number(it.remainingQuantity || 0), 0);
  const setLine = (idx, patch) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch, error: null } : l)));

  const suggestedCharge = (qty, rate) => Math.round((Number(qty || 0) * Number(rate || 0)) * 100) / 100;

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
    setSubmitting(true);
    try {
      const items = lines
        .filter((l) => (Number(l.returned) || 0) + (Number(l.damaged) || 0) + (Number(l.missing) || 0) > 0)
        .map((l) => ({
          rentalItemId: l.rentalItemId,
          returnedQuantity: Number(l.returned) || 0,
          damagedQuantity: Number(l.damaged) || 0,
          missingQuantity: Number(l.missing) || 0,
          damageCharge: l.damageCharge === '' || l.damageCharge === null ? undefined : Number(l.damageCharge),
          missingCharge: l.missingCharge === '' || l.missingCharge === null ? undefined : Number(l.missingCharge),
        }));
      if (items.length === 0) {
        toast.error('Enter at least one return, damage or missing quantity.');
        setSubmitting(false);
        return;
      }
      const res = await client.post(`/rentals/${rentalId}/return`, { notes: notes || null, items });
      const updated = res.data.rental;
      toast.success(`Return recorded — ${updated.rentalNumber} is now ${updated.status.toLowerCase().replace('_', ' ')}`);
      if (routeId) {
        navigate(`/rentals/${rentalId}`, { replace: true });
      } else {
        refetch();
        setNotes('');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (listLoading && !routeId) return <Spinner />;

  const currentOverdue = rental ? Math.max(0, daysBetween(rental.dueDate, new Date())) : 0;

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
            {currentOverdue > 0 && remainingTotal > 0 && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                ⚠️ Overdue by <b>{currentOverdue} day{currentOverdue > 1 ? 's' : ''}</b> — current overdue charge {inr(rental.overdueCharge)}. Overdue charge only applies to un-returned quantity and will drop once everything is returned.
              </div>
            )}
          </section>

          {/* Return lines */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Quantities</h2>
            {lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">All quantities have been returned for this rental.</p>
            ) : (
              <div className="space-y-4">
                {lines.map((l, idx) => (
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
                    <div className="grid gap-3 sm:grid-cols-5">
                      <Field label={`Return (${l.asset?.unit})`}>
                        <TextInput type="number" min="0" value={l.returned} onChange={(e) => setLine(idx, { returned: e.target.value })} placeholder="0" />
                      </Field>
                      <Field label={`Damaged (${l.asset?.unit})`}>
                        <TextInput type="number" min="0" value={l.damaged} onChange={(e) => setLine(idx, { damaged: e.target.value })} placeholder="0" />
                      </Field>
                      <Field label={`Missing (${l.asset?.unit})`}>
                        <TextInput type="number" min="0" value={l.missing} onChange={(e) => setLine(idx, { missing: e.target.value })} placeholder="0" />
                      </Field>
                      <Field label="Damage Charge (₹)" hint="Suggested: qty × rate">
                        <TextInput type="number" min="0" step="0.01" value={l.damageCharge} onChange={(e) => setLine(idx, { damageCharge: e.target.value })} placeholder={suggestedCharge(l.damaged, l.rate) ? String(suggestedCharge(l.damaged, l.rate)) : '0.00'} />
                      </Field>
                      <Field label="Missing Charge (₹)" hint="Suggested: qty × rate">
                        <TextInput type="number" min="0" step="0.01" value={l.missingCharge} onChange={(e) => setLine(idx, { missingCharge: e.target.value })} placeholder={suggestedCharge(l.missing, l.rate) ? String(suggestedCharge(l.missing, l.rate)) : '0.00'} />
                      </Field>
                    </div>
                    {l.error && <p className="mt-1 text-xs font-medium text-rose-600">{l.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <Field label="Return Notes">
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Site cleared, 2 plates damaged" />
            </Field>
            <p className="mt-3 text-xs text-slate-400">
              Only good returns are added back to available inventory — damaged and missing quantities are charged but never restocked.
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