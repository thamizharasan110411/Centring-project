export const RENTAL_STATUSES = {
  ACTIVE: { label: 'Active', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  PARTIALLY_RETURNED: { label: 'Partially Returned', cls: 'bg-sky-100 text-sky-800 ring-sky-200' },
  RETURNED: { label: 'Returned', cls: 'bg-indigo-100 text-indigo-800 ring-indigo-200' },
  OVERDUE: { label: 'Overdue', cls: 'bg-rose-100 text-rose-800 ring-rose-200' },
  CLOSED: { label: 'Closed', cls: 'bg-slate-200 text-slate-700 ring-slate-300' },
};

export const INVOICE_STATUSES = {
  PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  PARTIALLY_PAID: { label: 'Partially Paid', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  PENDING: { label: 'Pending', cls: 'bg-rose-100 text-rose-800 ring-rose-200' },
};

export const ASSET_STATUSES = {
  AVAILABLE: { label: 'Available', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  LOW_STOCK: { label: 'Low Stock', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  OUT_OF_STOCK: { label: 'Out of Stock', cls: 'bg-rose-100 text-rose-800 ring-rose-200' },
};

export const ASSET_CONDITIONS = {
  NEW: { label: 'New', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  GOOD: { label: 'Good', cls: 'bg-sky-100 text-sky-800 ring-sky-200' },
  USED: { label: 'Used', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  DAMAGED: { label: 'Damaged', cls: 'bg-rose-100 text-rose-800 ring-rose-200' },
};

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CARD', label: 'Card' },
];

export const RATE_TYPES = [
  { value: 'PER_DAY', label: 'Per Day' },
  { value: 'PER_WEEK', label: 'Per Week' },
  { value: 'PER_MONTH', label: 'Per Month' },
];

export const RENTAL_STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PARTIALLY_RETURNED', label: 'Partially Returned' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CLOSED', label: 'Closed' },
];

export const INVOICE_STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
];

export const PAYMENT_METHOD_FILTERS = [
  { value: '', label: 'All Methods' },
  ...PAYMENT_METHODS,
];

export const BUSINESS = {
  name: import.meta.env.VITE_BUSINESS_NAME || 'Centring Materials',
  address: import.meta.env.VITE_BUSINESS_ADDRESS || 'Plot No. 12, Industrial Area, Hosur Road, Bengaluru - 560100',
  phone: import.meta.env.VITE_BUSINESS_PHONE || '+91 98765 43210',
  email: import.meta.env.VITE_BUSINESS_EMAIL || 'info@balajicentering.in',
};