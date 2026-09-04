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

/* ------------------------------------------------------------------ */
/* Amount in words (Indian numbering: crore / lakh / thousand)         */
/* ------------------------------------------------------------------ */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoWords(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeWords(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let s = '';
  if (hundreds) s += `${ONES[hundreds]} Hundred`;
  if (rest) s += `${s ? ' ' : ''}${twoWords(rest)}`;
  return s;
}

/** Convert a rupee amount to Indian English words, e.g. 12345.50 → "Rupees Twelve Thousand Three Hundred Forty-Five and Fifty Paise Only". */
export const inrWords = (amount) => {
  const value = Math.abs(Number(amount || 0));
  const whole = Math.floor(value);
  const paise = Math.round((value - whole) * 100);
  if (whole === 0 && paise === 0) return 'Rupees Zero Only';

  let words = '';
  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const rest = whole % 1000;

  if (crore) words += `${twoWords(crore)} Crore `;
  if (lakh) words += `${twoWords(lakh)} Lakh `;
  if (thousand) words += `${twoWords(thousand)} Thousand `;
  if (rest) words += `${threeWords(rest)} `;

  let out = `Rupees ${words.trim()}`;
  if (paise) out += ` and ${twoWords(paise)} Paise`;
  return `${out} Only`;
};

/* ------------------------------------------------------------------ */
/* WhatsApp phone handling                                             */
/* ------------------------------------------------------------------ */

/**
 * Normalize an Indian / international mobile number for wa.me links.
 * Returns the full international digits (with country code) or '' if unusable.
 *   '9876543210'   -> '919876543210'
 *   '+91 98765 43210' -> '919876543210'
 *   '919876543210' -> '919876543210'
 *   '044 98765432' (landline / invalid) -> ''
 */
export const normalizePhone = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = digits.slice(1);
  // 10-digit Indian mobile starting 6-9
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  // Already includes 91 country code
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  // Longer international numbers are kept as-is
  if (digits.length >= 11) return digits;
  return '';
};

/** Build a wa.me deep link with a pre-filled, URL-encoded message. */
export const waLink = (phone, message) => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;