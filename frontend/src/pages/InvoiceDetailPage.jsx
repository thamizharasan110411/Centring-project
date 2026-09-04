import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/PageHeader';
import InvoiceDocument from '../components/InvoiceDocument';
import PaymentModal from '../components/PaymentModal';
import Modal from '../components/Modal';
import { PrimaryButton, SecondaryButton } from '../components/FormControls';
import { Spinner, ErrorState } from '../components/Loading';
import { inr, normalizePhone, waLink } from '../utils/format';

/** Build the professional WhatsApp invoice message. */
function buildInvoiceMessage(invoice) {
  const rental = invoice?.rental || {};
  const customer = rental.customer || {};
  const status = String(invoice.status || 'PENDING').toLowerCase().replace('_', ' ');
  return [
    `Hello ${customer.name || 'Customer'},`,
    '',
    `Your rental invoice ${invoice.invoiceNumber} (Rental Ref: ${rental.rentalNumber || '—'}) has been generated.`,
    '',
    `• Total Amount: ${inr(invoice.grandTotal)}`,
    `• Payment Status: ${status}`,
    `• Balance Due: ${inr(invoice.balanceAmount)}`,
    '',
    'Please find the attached invoice PDF for your reference.',
    'Thank you for your business!',
  ].join('\n');
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data: invoice, loading, error, refetch } = useFetch(
    () => client.get(`/invoices/${id}`).then((r) => r.data),
    [id]
  );
  const [payOpen, setPayOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');

  const print = () => window.print();

  const openWhatsApp = () => {
    const phone = normalizePhone(invoice.rental?.customer?.mobile);
    if (!phone) {
      toast.error(`No valid mobile number for ${invoice.rental?.customer?.name || 'this customer'} — add one in the customer profile first.`);
      return;
    }
    setWaPhone(phone);
    setWaMessage(buildInvoiceMessage(invoice));
    setWaOpen(true);
  };

  const launchWhatsApp = () => {
    window.open(waLink(waPhone, waMessage), '_blank', 'noopener');
  };

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
          <button onClick={openWhatsApp} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            💬 Send via WhatsApp
          </button>
        </PageHeader>

        {Number(invoice.overdueCharge) > 0 && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            ⚠️ This invoice includes an automatic overdue charge of <b>{inr(invoice.overdueCharge)}</b> for the late return period.
          </div>
        )}
      </div>

      <InvoiceDocument invoice={invoice} />

      {/* WhatsApp preview modal */}
      <Modal open={waOpen} onClose={() => setWaOpen(false)} title="Send Invoice via WhatsApp">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This opens WhatsApp with the message below — it is <b>not</b> sent automatically.
          </p>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              To: {invoice.rental?.customer?.name} · +{waPhone}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{waMessage}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <b>Note:</b> WhatsApp Web cannot attach files automatically from a browser. For the best result, tap <b>Save PDF</b> first, then after WhatsApp opens, attach the downloaded PDF to this chat.
          </div>
          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <SecondaryButton onClick={print}>🖨 Save PDF first</SecondaryButton>
            <SecondaryButton onClick={() => setWaOpen(false)}>Close</SecondaryButton>
            <PrimaryButton onClick={launchWhatsApp} className="bg-emerald-600 hover:bg-emerald-700">Open WhatsApp ↗</PrimaryButton>
          </div>
        </div>
      </Modal>

      {payOpen && (
        <PaymentModal rentalId={invoice.rentalId} onClose={() => setPayOpen(false)} onSaved={() => { refetch(); toast.success('Payment recorded'); }} />
      )}
    </div>
  );
}