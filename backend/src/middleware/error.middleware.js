const { Prisma } = require('@prisma/client');
const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function mapPrismaError(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return new ApiError(409, 'A record with this unique value already exists.', err.meta);
      case 'P2025':
        return new ApiError(404, 'The requested record was not found.');
      case 'P2003':
        return new ApiError(409, 'This record is still in use and cannot be deleted or linked.');
      case 'P2014':
        return new ApiError(409, 'This change would break an existing relation.');
      default:
        return new ApiError(400, `Database error (${err.code}).`);
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return new ApiError(400, 'Invalid data supplied to the database.');
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError === false && err.name === 'PrismaClientInitializationError') {
    return new ApiError(500, 'Database connection failed. Check DATABASE_URL.');
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    error = new ApiError(400, 'Invalid JSON in request body.');
  } else if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError) {
    error = mapPrismaError(error);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[Error]', error);
  }

  const body = { success: false, error: message };
  if (error.details) body.details = error.details;
  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };