const DAY_MS = 24 * 60 * 60 * 1000;

/** Date at local midnight (start of day). */
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayStart() {
  return startOfDay(new Date());
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Whole calendar days from `from` (start of day) to `to` (start of day). */
function dayDiff(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/** dd-MM-yyyy */
function formatDate(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** yyyy-MM-dd (for <input type="date">) */
function toDateInput(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Parse 'yyyy-mm-dd' into a local-midnight Date. Returns null if invalid. */
function parseDateInput(value) {
  if (!value) return null;
  if (value instanceof Date) return startOfDay(value);
  const match = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

/** Start of the week (Sunday) containing `date`. */
function startOfWeek(date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Start of the month containing `date`. */
function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

module.exports = {
  startOfDay,
  todayStart,
  addDays,
  dayDiff,
  formatDate,
  toDateInput,
  parseDateInput,
  startOfWeek,
  startOfMonth,
};