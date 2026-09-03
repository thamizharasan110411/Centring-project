export const inr = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export const num = (n) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n || 0));

export const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateLong = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

/** yyyy-MM-dd for <input type="date"> */
export const toDateInput = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
};

export const todayInput = () => toDateInput(new Date());

export const addDaysInput = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
};

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const daysBetween = (from, to) =>
  Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;