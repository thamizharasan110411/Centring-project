/** Convert a Prisma Decimal / string / number to a plain JS number. */
const toNum = (value) => (value === null || value === undefined ? 0 : Number(value));

/** Round to 2 decimal places (rupee paise). */
const round2 = (n) => {
  const num = toNum(n);
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/** Format a number as Indian Rupees, e.g. ₹12,345.50 */
const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(n));

/** Format a plain number with Indian digit grouping, e.g. 12,345.5 */
const formatNumber = (n) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toNum(n));

module.exports = { toNum, round2, formatINR, formatNumber };