import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/PageHeader';
import InvoiceDocument from '../components/InvoiceDocument';
import PaymentModal from '../components/PaymentModal';
import { Spinner, ErrorState } from '../components/Loading';
import { inr } from '../utils/format';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data: invoice, loading, error, refetch } = useFetch(
    () => client.get(`/invoices/${id}`).then((r) => r.data),
    [id]
  );
  const [payOpen, setPayOpen] = useState(false);

  const print = () => window.print();

  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const canPay = Number(invoice.balanceAmount) > 0 && invoice.status !== 'PAID' && invoice.rental?.status !== 'CLOSED';

  return (
    <div>
      <div className="no-print">
        <PageHeader title={invoice.invoiceNumber} subtitle={`Rental ${invoice.rental?.rentalNumber} · ${invoice.rental?.customer?.name}`}>
          <Link to="/invoices" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Invoices</Link>
          <Link to={`/rentals/${invoice.rentalId}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Rental</Link>
          {canPay && (
            <button onClick={() => setPayOpen(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Record Payment
            </button>
          )}
          <button onClick={print} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900">
            🖨 Print / Save PDF
          </button>
        </PageHeader>

        {Number(invoice.overdueCharge) > 0 && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            ⚠️ This invoice includes an automatic overdue charge of <b>{inr(invoice.overdueCharge)}</b>. It updates automatically while materials remain un-returned.
          </div>
        )}
      </div>

      <InvoiceDocument invoice={invoice} />

      {payOpen && (
        <PaymentModal rentalId={invoice.rentalId} onClose={() => setPayOpen(false)} onSaved={() => { refetch(); toast.success('Payment recorded'); }} />
      )}
    </div>
  );
}