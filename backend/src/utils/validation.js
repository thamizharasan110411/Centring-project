const ApiError = require('./ApiError');
const { parseDateInput, startOfDay } = require('./dates');

function assert(condition, message, statusCode = 400) {
  if (!condition) throw new ApiError(statusCode, message);
}

function requiredString(value, label) {
  assert(value !== undefined && value !== null && String(value).trim() !== '', `${label} is required`);
  return String(value).trim();
}

function optionalString(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function asNumber(value, label) {
  const n = Number(value);
  assert(Number.isFinite(n), `${label} must be a valid number`);
  return n;
}

function asNonNegativeNumber(value, label) {
  const n = asNumber(value, label);
  assert(n >= 0, `${label} cannot be negative`);
  return n;
}

function asPositiveNumber(value, label) {
  const n = asNumber(value, label);
  assert(n > 0, `${label} must be greater than zero`);
  return n;
}

function asPositiveInt(value, label) {
  const n = Number(value);
  assert(Number.isInteger(n) && n > 0, `${label} must be a positive whole number`);
  return n;
}

function asNonNegativeInt(value, label) {
  const n = Number(value);
  assert(Number.isInteger(n) && n >= 0, `${label} must be a whole number (0 or more)`);
  return n;
}

function asDate(value, label) {
  const parsed = parseDateInput(value);
  assert(parsed, `${label} must be a valid date (YYYY-MM-DD)`);
  return startOfDay(parsed);
}

function asEnum(value, allowed, label) {
  assert(allowed.includes(value), `${label} must be one of: ${allowed.join(', ')}`);
  return value;
}

module.exports = {
  assert,
  requiredString,
  optionalString,
  asNumber,
  asNonNegativeNumber,
  asPositiveNumber,
  asPositiveInt,
  asNonNegativeInt,
  asDate,
  asEnum,
};