const ApiError = require('./ApiError');

const PREFIXES = {
  customer: 'CST',
  asset: 'AST',
  rental: 'RNT',
  invoice: 'INV',
};

/**
 * Generate the next sequential business code, e.g. RNT-0012.
 * Looks at the highest id for the model and increments the numeric suffix.
 */
async function nextCode(prisma, model, field) {
  const prefix = PREFIXES[model];
  if (!prefix) throw new ApiError(500, `No code prefix configured for model "${model}"`);
  const last = await prisma[model].findFirst({
    orderBy: { id: 'desc' },
    select: { [field]: true },
  });
  let next = 1;
  if (last && last[field]) {
    const match = String(last[field]).match(/(\d+)\s*$/);
    if (match) next = parseInt(match[1], 10) + 1;
  }
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

/**
 * Retry an operation a few times when it fails because of a unique-code
 * collision (P2002) — protects sequential code generation under concurrency.
 */
async function withUniqueRetry(fn, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      if (error && error.code === 'P2002' && i < attempts - 1) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

module.exports = { nextCode, withUniqueRetry };