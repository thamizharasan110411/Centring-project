const express = require('express');
const cors = require('cors');
const { Prisma } = require('@prisma/client');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

// --- CORS: allow the configured frontend origin(s) ---
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (curl, Postman) and same-origin requests.
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// --- Response serialization: convert Prisma Decimal & Dates to plain JSON types ---
function toPlain(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = toPlain(value[key]);
    return out;
  }
  return value;
}

// eslint-disable-next-line no-unused-vars
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(toPlain(body));
  next();
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;