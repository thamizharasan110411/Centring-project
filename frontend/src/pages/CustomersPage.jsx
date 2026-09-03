import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { Field, TextInput, PrimaryButton, SecondaryButton } from '../components/FormControls';
import { Spinner, EmptyState, ErrorState } from '../components/Loading';
import { inr, num } from '../utils/format';

const EMPTY_FORM = {
  name: '', mobile: '', alternateMobile: '', address: '',
  projectName: '', projectAddress: '', notes: '',
};

export default function CustomersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ page, limit: 10, search: search || undefined }),
    [page, search]
  );

  const { data, loading, error, refetch } = useFetch(
    () => client.get('/customers', { params }).then((r) => r),
    [page, search]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name, mobile: c.mobile, alternateMobile: c.alternateMobile || '',
      address: c.address || '', projectName: c.projectName || '',
      projectAddress: c.projectAddress || '', notes: c.notes || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!/^\d{10}$/.test(form.mobile.replace(/\D/g, ''))) errs.mobile = 'Enter a valid 10-digit mobile number';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await client.put(`/customers/${editing.id}`, form);
        toast.success('Customer updated');
      } else {
        await client.post('/customers', form);
        toast.success('Customer added');
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    const ok = await confirm({
      title: 'Delete customer?',
      message: `Delete "${c.name}"? Customers with rental history cannot be deleted.`,
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await client.delete(`/customers/${c.id}`);
      toast.success('Customer deleted');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="Customers" subtitle="Manage customers and their projects">
        <PrimaryButton onClick={openCreate}>+ Add Customer</PrimaryButton>
      </PageHeader>

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, code, mobile or project…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-80"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title="No customers found"
          message={search ? 'Try a different search.' : 'Add your first customer to start renting.'}
          action={!search ? <PrimaryButton onClick={openCreate}>+ Add Customer</PrimaryButton> : null}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3 text-right">Rentals</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.customerCode}</td>
                    <td className="px-4 py-3">
                      <Link to={`/customers/${c.id}`} className="font-medium text-slate-800 hover:text-indigo-600">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{c.mobile}</td>
                    <td className="px-4 py-3 text-slate-600">{c.projectName || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.stats?.totalRentals || 0}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${Number(c.stats?.outstandingAmount) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {inr(c.stats?.outstandingAmount || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/customers/${c.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">View</Link>
                        <button onClick={() => openEdit(c)} className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">Edit</button>
                        <button onClick={() => remove(c)} className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">Delete</button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.customerCode}` : 'Add Customer'} wide>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={formErrors.name}>
              <TextInput value={form.name} onChange={set('name')} placeholder="e.g. Kumar Construction" error={formErrors.name} />
            </Field>
            <Field label="Mobile" required error={formErrors.mobile}>
              <TextInput value={form.mobile} onChange={set('mobile')} placeholder="10-digit mobile" error={formErrors.mobile} maxLength={10} />
            </Field>
            <Field label="Alternate Mobile">
              <TextInput value={form.alternateMobile} onChange={set('alternateMobile')} placeholder="Optional" maxLength={10} />
            </Field>
            <Field label="Project Name">
              <TextInput value={form.projectName} onChange={set('projectName')} placeholder="e.g. Skyline Heights - Whitefield" />
            </Field>
            <Field label="Address">
              <TextInput value={form.address} onChange={set('address')} placeholder="Business / site address" />
            </Field>
            <Field label="Project Address">
              <TextInput value={form.projectAddress} onChange={set('projectAddress')} placeholder="Site address" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <TextInput value={form.notes} onChange={set('notes')} placeholder="Optional" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Customer'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}