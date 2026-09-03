const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');
const { nextCode } = require('../utils/numbers');
const { assert, requiredString, optionalString, asPositiveInt, asNonNegativeInt, asNonNegativeNumber, asEnum } = require('../utils/validation');

const RATE_TYPES = ['PER_DAY', 'PER_WEEK', 'PER_MONTH'];
const CONDITIONS = ['NEW', 'GOOD', 'USED', 'DAMAGED'];

function deriveStatus(available, total) {
  if (available <= 0) return 'OUT_OF_STOCK';
  if (available <= Math.ceil(total * 0.2)) return 'LOW_STOCK';
  return 'AVAILABLE';
}

function sanitize(body, existing) {
  const name = requiredString(body.name, 'Asset name');
  const category = requiredString(body.category, 'Category');
  const unit = requiredString(body.unit, 'Unit');
  const totalQuantity = asPositiveInt(body.totalQuantity, 'Total quantity');
  const rentalRate = asNonNegativeNumber(body.rentalRate, 'Rental rate');
  const rateType = asEnum(body.rateType || 'PER_DAY', RATE_TYPES, 'Rate type');
  const condition = asEnum(body.condition || 'GOOD', CONDITIONS, 'Condition');

  const oldTotal = existing ? existing.totalQuantity : 0;
  const oldAvailable = existing ? existing.availableQuantity : totalQuantity;
  const availableQuantity = existing ? oldAvailable + (totalQuantity - oldTotal) : totalQuantity;
  assert(
    availableQuantity >= 0,
    'Total quantity cannot be reduced below the quantity currently out on rent.',
    400
  );

  return {
    name,
    category,
    unit,
    totalQuantity,
    availableQuantity,
    rentalRate,
    rateType,
    condition,
    status: deriveStatus(availableQuantity, totalQuantity),
    notes: optionalString(body.notes),
  };
}

async function listAssets({ page = 1, limit = 10, search, category } = {}) {
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { assetCode: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;

  const take = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, assets] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      include: { _count: { select: { rentalItems: true } } },
      orderBy: { id: 'desc' },
      skip,
      take,
    }),
  ]);

  const data = assets.map((a) => ({
    ...a,
    rentedQuantity: Math.max(0, a.totalQuantity - a.availableQuantity),
  }));

  return {
    data,
    meta: { page: Math.max(Number(page) || 1, 1), limit: take, total, totalPages: Math.ceil(total / take) },
  };
}

async function getAsset(id) {
  const asset = await prisma.asset.findUnique({
    where: { id: asPositiveInt(id, 'Asset id') },
    include: {
      rentalItems: {
        include: { rental: { include: { customer: true } } },
        orderBy: { id: 'desc' },
        take: 50,
      },
    },
  });
  if (!asset) throw new ApiError(404, 'Asset not found');
  return {
    ...asset,
    rentedQuantity: Math.max(0, asset.totalQuantity - asset.availableQuantity),
  };
}

async function createAsset(body) {
  const data = sanitize(body, null);
  const assetCode = await nextCode(prisma, 'asset', 'assetCode');
  return prisma.asset.create({ data: { ...data, assetCode } });
}

async function updateAsset(id, body) {
  const assetId = asPositiveInt(id, 'Asset id');
  const existing = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!existing) throw new ApiError(404, 'Asset not found');
  const data = sanitize(body, existing);
  return prisma.asset.update({ where: { id: assetId }, data });
}

async function deleteAsset(id) {
  const assetId = asPositiveInt(id, 'Asset id');
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { _count: { select: { rentalItems: true } } },
  });
  if (!asset) throw new ApiError(404, 'Asset not found');
  assert(
    asset._count.rentalItems === 0,
    'Cannot delete an asset that has rental history.',
    409
  );
  await prisma.asset.delete({ where: { id: assetId } });
  return { id: assetId, deleted: true };
}

async function listCategories() {
  const rows = await prisma.asset.findMany({ select: { category: true }, distinct: ['category'] });
  return rows.map((r) => r.category).sort();
}

module.exports = {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  listCategories,
  deriveStatus,
};