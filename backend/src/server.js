require('dotenv').config();
const app = require('./app');
const prisma = require('./prisma');

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log('✓ Connected to PostgreSQL');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('✗ Could not connect to the database. Check DATABASE_URL.');
    console.error(err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`✓ Centring Materials ERP API running on http://localhost:${PORT}`);
    console.log(`  Health check: http://localhost:${PORT}/api/health`);
  });

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log('\nShutting down...');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();