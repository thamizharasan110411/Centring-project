import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton, DangerButton } from '../components/FormControls';
import { Spinner, EmptyState, ErrorState } from '../components/Loading';
import { ASSET_STATUSES, ASSET_CONDITIONS, RATE_TYPES } from '../utils/constants';
import { inr, num, fmtDate, plural } from '../utils/format';

const EMPTY_FORM = {
  name: '', category: '', unit: '', totalQuantity: '', rentalRate: '',
  rateType: 'PER_DAY', condition: 'GOOD', notes: '',
};

export default function AssetsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ page, limit: 10, search: search || undefined, category: category || undefined }),
    [page, search, category]
  );

  const { data, loading, error, refetch } = useFetch(
    () => client.get('/assets', { params }).then((r) => r),
    [page, search, category]
  );

  const { data: categories } = useFetch(() => client.get('/assets/categories').then((r) => r.data), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (asset) => {
    setEditing(asset);
    setForm({
      name: asset.name, category: asset.category, unit: asset.unit,
      totalQuantity: asset.totalQuantity, rentalRate: asset.rentalRate,
      rateType: asset.rateType, condition: asset.condition, notes: asset.notes || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.category.trim()) errs.category = 'Category is required';
    if (!form.unit.trim()) errs.unit = 'Unit is required';
    const qty = Number(form.totalQuantity);
    if (!Number.isInteger(qty) || qty <= 0) errs.totalQuantity = 'Must be a positive whole number';
    const rate = Number(form.rentalRate);
    if (!(rate >= 0) || !Number.isFinite(rate)) errs.rentalRate = 'Enter a valid rate';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...form,
      totalQuantity: Number(form.totalQuantity),
      rentalRate: Number(form.rentalRate),
    };
    try {
      if (editing) {
        await client.put(`/assets/${editing.id}`, payload);
        toast.success(`Asset "${form.name}" updated`);
      } else {
        await client.post('/assets', payload);
        toast.success(`Asset "${form.name}" added`);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (asset) => {
    const ok = await confirm({
      title: 'Delete asset?',
      message: `Delete "${asset.name}" (${asset.assetCode})? This cannot be undone.`,
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await client.delete(`/assets/${asset.id}`);
      toast.success('Asset deleted');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="Assets" subtitle="Manage centering materials, rates and availability">
        <PrimaryButton onClick={openCreate}>+ Add Asset</PrimaryButton>
      </PageHeader>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or asset code…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-72"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:w-56"
        >
          <option value="">All Categories</option>
          {(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm text-slate-400 sm:ml-auto">{data?.meta?.total || 0} assets</span>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title="No assets found"
          message={search || category ? 'Try changing the search or filter.' : 'Add your first centering material to start renting.'}
          action={!search && !category ? <PrimaryButton onClick={openCreate}>+ Add Asset</PrimaryButton> : null}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Asset Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-right">Rented</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.assetCode}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewing(a)} className="text-left font-medium text-slate-800 hover:text-indigo-600">
                        {a.name}
                      </button>
                      <span className="block text-xs text-slate-400">{a.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{num(a.totalQuantity)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{num(a.availableQuantity)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-indigo-600">{num(a.rentedQuantity)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inr(a.rentalRate)}<span className="block text-[10px] text-slate-400">{RATE_TYPES.find((r) => r.value === a.rateType)?.label}</span></td>
                    <td className="px-4 py-3"><StatusBadge map={ASSET_CONDITIONS} status={a.condition} /></td>
                    <td className="px-4 py-3"><StatusBadge map={ASSET_STATUSES} status={a.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewing(a)} className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">View</button>
                        <button onClick={() => openEdit(a)} className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">Edit</button>
                        <button onClick={() => remove(a)} className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">Delete</button>
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

      {/* Add / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.assetCode}` : 'Add Asset'} wide>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Asset Name" required error={formErrors.name}>
              <TextInput value={form.name} onChange={set('name')} placeholder="e.g. Steel Plate" error={formErrors.name} />
            </Field>
            <Field label="Category" required error={formErrors.category}>
              <TextInput value={form.category} onChange={set('category')} placeholder="e.g. Centering Plates" error={formErrors.category} list="asset-categories" />
              <datalist id="asset-categories">
                {(categories || []).map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Unit" required error={formErrors.unit}>
              <SelectInput value={form.unit} onChange={set('unit')} error={formErrors.unit}>
                <option value="">Select unit…</option>
                {['Piece', 'Set', 'Pair', 'Meter', 'Bag', 'No.'].map((u) => <option key={u} value={u}>{u}</option>)}
              </SelectInput>
            </Field>
            <Field label="Total Quantity" required error={formErrors.totalQuantity} hint={editing ? `Currently rented out: ${num(editing.rentedQuantity)} ${editing.unit}s — available quantity adjusts automatically.` : null}>
              <TextInput type="number" min="1" value={form.totalQuantity} onChange={set('totalQuantity')} error={formErrors.totalQuantity} />
            </Field>
            <Field label="Rental Rate (₹)" required error={formErrors.rentalRate}>
              <TextInput type="number" min="0" step="0.01" value={form.rentalRate} onChange={set('rentalRate')} placeholder="e.g. 10" error={formErrors.rentalRate} />
            </Field>
            <Field label="Rate Type" required>
              <SelectInput value={form.rateType} onChange={set('rateType')}>
                {RATE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </SelectInput>
            </Field>
            <Field label="Condition">
              <SelectInput value={form.condition} onChange={set('condition')}>
                {Object.entries(ASSET_CONDITIONS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </SelectInput>
            </Field>
            <Field label="Notes">
              <TextInput value={form.notes} onChange={set('notes')} placeholder="Optional" />
            </Field>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Asset'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing ? `${viewing.assetCode} — ${viewing.name}` : ''} wide>
        {viewing && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Total Quantity', num(viewing.totalQuantity)],
                ['Available', num(viewing.availableQuantity)],
                ['Rented Out', num(viewing.rentedQuantity)],
                ['Rate', `${inr(viewing.rentalRate)} / ${RATE_TYPES.find((r) => r.value === viewing.rateType)?.label?.toLowerCase().replace('per ', '')}`],
                ['Category', viewing.category],
                ['Unit', viewing.unit],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <StatusBadge map={ASSET_CONDITIONS} status={viewing.condition} />
              <StatusBadge map={ASSET_STATUSES} status={viewing.status} />
              {viewing.notes && <p className="text-sm text-slate-600">{viewing.notes}</p>}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Rental History (recent)</h4>
              {viewing.rentalItems?.length ? (
                <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Rental</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewing.rentalItems.map((ri) => (
                        <tr key={ri.id}>
                          <td className="px-3 py-2"><Link to={`/rentals/${ri.rentalId}`} className="font-medium text-indigo-600">{ri.rental?.rentalNumber}</Link></td>
                          <td className="px-3 py-2 text-slate-600">{ri.rental?.customer?.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{plural(ri.rentedQuantity, viewing.unit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{inr(ri.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Never rented.</p>
              )}
            </div>
            <div className="flex justify-end">
              <PrimaryButton onClick={() => { setViewing(null); openEdit(viewing); }}>Edit Asset</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}