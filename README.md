# 🏗️ Centering Material Rental ERP

A complete, production-ready ERP for a centering / shuttering material rental business.

Manage assets and customers, create rentals with automatic inventory updates, detect overdue
rentals automatically, charge extra rental days, process partial returns with damage/missing
charges, generate printable invoices, record payments, and view live business reports.

**Stack:** React · Vite · Tailwind CSS · React Router · Axios · Node.js · Express · PostgreSQL · Prisma ORM

---

## Features

| Area | Highlights |
| --- | --- |
| **Admin login** | Single admin account (`POST /api/auth/login` → JWT). All API routes are protected; the frontend redirects to a login page when unauthenticated and auto-logs-out on expired sessions |
| **Dashboard** | Live stat cards (assets, customers, active/overdue rentals, revenue, pending) + recent rentals, overdue list, recent payments, top rented assets |
| **Assets** | Add/edit/delete, search, category filter, available/rented/out-of-stock tracking, rental history |
| **Customers** | CRUD, search, per-customer rentals/payments/outstanding, rental history |
| **Rentals** | Multi-asset rental creation, auto-calculated amounts, advance payments, status filters, overdue badges |
| **Overdue** | Automatic detection (`current date > due date` with un-returned qty), per-item extra-day charges, **WhatsApp reminder** (wa.me deep link, never sent automatically) |
| **Returns** | Partial returns, damaged/missing quantities with charges — only good returns are restocked |
| **Billing** | Auto-generated invoice per rental, print/PDF-friendly, stays in sync with overdue, damage, missing charges and payments |
| **Payments** | Record CASH / UPI / BANK_TRANSFER / CARD payments; invoice status auto-updates (PAID / PARTIALLY_PAID / PENDING) |
| **Reports** | Revenue, rentals, assets, customers — filterable by Today / This Week / This Month / Custom range |

### Core business rules (enforced on the backend, inside PostgreSQL transactions)

1. You can never rent more than the available quantity (rows are locked with `SELECT … FOR UPDATE`).
2. Rental creation = one transaction: Rental + Items → inventory decrement → Invoice → advance payment. Any failure rolls everything back.
3. Returns = one transaction: Return + ReturnItems → item counters → inventory increment (good quantity only) → damage/missing charges → invoice refresh.
4. Overdue charge = remaining quantity × daily rate × extra days — **only un-returned quantity is charged**.
5. Payments validate against the current balance and update invoice + rental in one transaction.
6. A fully returned + fully paid rental automatically becomes **CLOSED** (a manual close is also available).

---

## Project structure

```
centering-erp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Models, enums, indexes, relations
│   │   ├── migrations/            # SQL migration history (works from a fresh DB)
│   │   └── seed.js                # Demo data (9 assets, 4 customers, 6 rentals, payments)
│   ├── scripts/
│   │   └── test-workflow.mjs      # End-to-end workflow smoke test (71 checks)
│   ├── src/
│   │   ├── controllers/           # Thin HTTP handlers
│   │   ├── routes/                # REST routes
│   │   ├── services/              # All business logic
│   │   ├── middleware/            # Centralized error handling
│   │   ├── utils/                 # Validation, dates, money, code generation
│   │   ├── app.js                 # Express app (CORS, JSON, Decimal serialization)
│   │   └── server.js              # Entry point
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/client.js          # Axios instance (base URL from VITE_API_URL)
    │   ├── components/            # Layout, modals, badges, tables, invoice, payment modal…
    │   ├── context/               # Toast + confirmation dialogs
    │   ├── hooks/                 # useFetch
    │   ├── pages/                 # All ERP pages
    │   └── utils/                 # Formatting, constants
    └── .env.example
```

---

## 1. Install frontend

```bash
cd frontend
npm install
```

## 2. Install backend

```bash
cd backend
npm install
```

## 3. Create a PostgreSQL database

You can use:

- **Local PostgreSQL** — `CREATE DATABASE centering_erp;`
- **Neon** — create a project at [neon.tech](https://neon.tech), copy the connection string.
- **Supabase** — create a project at [supabase.com](https://supabase.com), copy the connection string (add `?pgbouncer=true` if you use the pooled port `6543`).

## 4. Configure DATABASE_URL

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/centering_erp
PORT=5000
FRONTEND_URL=http://localhost:5173

# Used on printed invoices
BUSINESS_NAME=Centring Materials
BUSINESS_ADDRESS=Plot No. 12, Industrial Area, Hosur Road, Bengaluru - 560100
BUSINESS_PHONE=+91 98765 43210
BUSINESS_EMAIL=info@balajicentering.in
```

> **Tip:** set `TZ=Asia/Kolkata` on your backend host so business dates match Indian time.

## 5. Run Prisma migration

```bash
cd backend
npx prisma migrate deploy
```

This applies the migration in `prisma/migrations/` to your database. It works from a
completely fresh database — no manual SQL needed. (During development you can instead use
`npx prisma db push` to sync the schema directly.)

## 6. Run seed (optional demo data)

```bash
cd backend
npm run seed
```

Seeds 9 assets, 4 customers, 6 rentals (active, overdue, partially returned, returned,
closed), returns with damage/missing charges, and payments. Use `RESET=1 npm run seed` to
wipe existing data first.

## 7. Start the backend

```bash
cd backend
npm run dev          # nodemon (development)
# or
npm start            # node (production)
```

API: `http://localhost:5000/api` · Health check: `http://localhost:5000/api/health`

## 8. Start the frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_URL if the backend isn't on localhost:5000
npm run dev
```

Open `http://localhost:5173` — you'll be asked to log in.

## 8b. Admin login

The system has a single admin account, configured in `backend/.env`:

| Variable | Default |
| --- | --- |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `admin123` |
| `JWT_SECRET` | generated for you in `.env` — change it on every deployment |

**Change the password before going live.** Sessions last 24 hours by default
(`JWT_EXPIRES_IN`). The login page shows the default credentials as a hint — remove that
hint from `frontend/src/pages/LoginPage.jsx` once you've changed them.

## 9. Build the frontend for Vercel

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`. Locally you can preview it with `npm run preview`.

## 10. Deploy (Vercel + Neon)

### 1. Create the Neon database (free tier is enough)

1. Sign up at [neon.tech](https://neon.tech) → **Create a project** → name it `centering-erp`,
   pick a region near you.
2. Copy **both** connection strings from the dashboard (Neon shows them in tabs):
   - **Pooled** — host contains `-pooler` (e.g. `ep-xxx-pooler.region.aws.neon.tech`) →
     used by the **running app**.
   - **Direct** — plain host (`ep-xxx.region.aws.neon.tech`) → used for **migrations/seed**.
3. From your machine, create the schema and load sample data (one-time):
   ```bash
   cd backend
   DATABASE_URL="postgresql://…DIRECT…" npx prisma migrate deploy
   DATABASE_URL="postgresql://…DIRECT…" npm run seed
   ```

### 2. Deploy the backend → Vercel (serverless)

The backend ships with `backend/vercel.json` — it runs as a serverless function, no server to keep alive.

**Option A — Vercel CLI (fastest, no GitHub needed):**

```bash
cd backend
npx vercel login          # opens a browser — approve it
npx vercel                # first deploy (preview URL)
npx vercel --prod         # production deploy
npx vercel env add DATABASE_URL production    # use the POOLED string + ?sslmode=require
# repeat `npx vercel env add NAME production` for:
#   FRONTEND_URL   → https://<your-frontend>.vercel.app (CORS)
#   ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET (openssl rand -hex 32), JWT_EXPIRES_IN
#   BUSINESS_NAME, BUSINESS_ADDRESS, BUSINESS_PHONE, BUSINESS_EMAIL
npx vercel redeploy --prod   # after adding env vars
```

**Option B — GitHub + vercel.com:** push the repo, then on [vercel.com](https://vercel.com)
→ **New Project** → import the repo → **Root Directory:** `backend` → add the same env vars → Deploy.

### 3. Deploy the frontend → Vercel

```bash
cd frontend
npx vercel login          # if not already logged in
npx vercel                # first deploy
npx vercel --prod
npx vercel env add VITE_API_URL production   # https://<your-backend>.vercel.app/api
npx vercel redeploy --prod
```

(GitHub route: Root Directory `frontend`, single env var `VITE_API_URL`.)

### 4. Final checks

- Backend `FRONTEND_URL` must exactly match the deployed frontend URL (CORS).
- Change `ADMIN_PASSWORD` before sharing the link.
- Verify the deployed API end-to-end — it now authenticates automatically:
  ```bash
  cd backend
  node scripts/test-workflow.mjs https://<your-backend>.vercel.app/api
  ```

---

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Admin login → `{ token, admin }` (public) |
| GET | `/api/auth/me` | Validate the current token (protected) |
| GET/POST | `/api/customers` | List / create customers |
| GET/PUT/DELETE | `/api/customers/:id` | Customer detail, update, delete |
| GET/POST | `/api/assets` | List / create assets |
| GET/PUT/DELETE | `/api/assets/:id` | Asset detail, update, delete |
| GET | `/api/assets/categories` | Distinct categories |
| GET/POST | `/api/rentals` | List / create rentals |
| GET/PUT | `/api/rentals/:id` | Rental detail / edit charges & dates |
| GET | `/api/rentals/overdue` | Overdue rows (per outstanding item) |
| POST | `/api/rentals/:id/return` | Process a (partial) return |
| POST | `/api/rentals/:id/close` | Manually close a settled rental |
| GET | `/api/rentals/:id/reminder` | Build WhatsApp reminder (message + wa.me link) |
| GET/POST | `/api/payments` | List / record payments |
| GET | `/api/invoices` | List invoices |
| GET | `/api/invoices/:id` | Invoice detail (rental, items, payments) |
| GET | `/api/invoices/rental/:rentalId` | Invoice for a rental |
| GET | `/api/reports/dashboard` | Dashboard numbers |
| GET | `/api/reports/revenue` | Revenue report (range filter) |
| GET | `/api/reports/rentals` | Rental report (range filter) |
| GET | `/api/reports/assets` | Asset report (range filter) |
| GET | `/api/reports/customers` | Customer report (range filter) |

List endpoints support `?page=`, `?limit=`, `?search=`, and status filters
(e.g. `?status=ACTIVE,PARTIALLY_RETURNED`). Reports support `?range=today|week|month`
or `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

All responses use a consistent shape: `{ success, data, meta? }` or `{ success, error }`.

**Authentication:** every endpoint except `/api/health` and `/api/auth/login` requires an
`Authorization: Bearer <token>` header. Get a token from `POST /api/auth/login`. The frontend
attaches it automatically and redirects to the login page when a session expires (HTTP 401).

---

## Testing the full workflow

With the backend running against a seeded database:

```bash
cd backend
npm run test:workflow
```

The script (75 assertions) covers: admin login → seeded sanity → overdue detection & WhatsApp reminder →
rental creation (amounts, inventory decrement, invoice, advance) → overbooking rejection →
due-date validation → overdue on a new rental → partial return (inventory +6 only, damage/
missing charged, overdue drops for returned qty) → over-return rejection → full return →
payment lifecycle (balance, invoice status, auto-close) → overpayment rejection → dashboard
& reports → customer stats.

## Development without installing PostgreSQL (optional)

The repo includes a dev helper that runs a real PostgreSQL server in-process (WASM),
so you can develop without installing Postgres:

```bash
cd backend
npm install --prefix .pgtest
PGLITE_PORT=5432 node .pgtest/server.js          # starts Postgres on 127.0.0.1:5432
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true" npm run seed
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true&connection_limit=5" npm run dev
```

Note: PGlite multiplexes a single connection, so `?pgbouncer=true` (disable prepared
statement caching) is required for the local dev server only — real PostgreSQL doesn't
need it.

---

## How the business logic works

### Rental creation (single transaction)

1. Lock the chosen assets (`SELECT … FOR UPDATE`) so concurrent rentals can't overbook.
2. Validate: customer exists, ≥ 1 item, quantity > 0 and ≤ available, rate > 0, due date ≥ rental date, advance ≤ grand total.
3. Compute each line: `quantity × rate × days` (PER_WEEK bills per started week, PER_MONTH per started month).
4. Create Rental + RentalItems, decrement `Asset.availableQuantity`, create the Invoice, record the advance payment.
5. Recompute totals/status. Any failure rolls the whole transaction back.

### Overdue detection

On every read of rentals/invoices/dashboard/reports the system refreshes open rentals:

```
extraDays      = today − dueDate          (only when today > dueDate)
overdueCharge += remainingQty × rate × extraDays   (per item, remaining only)
```

The rental status becomes `OVERDUE`; the invoice's overdue charge, grand total, and
balance are updated immediately.

### Returns

`returned` quantities go back into `Asset.availableQuantity`. `damaged` and `missing`
quantities are charged (default suggestion = qty × rate, editable) but **never restocked**.
Status becomes `PARTIALLY_RETURNED` until everything is accounted for, then `RETURNED`
(→ `CLOSED` automatically once the balance is cleared).

### Payments

Each payment validates against the outstanding balance, then updates
`Invoice.paidAmount / balanceAmount / status` and the rental's balance in one transaction.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | API port (default 5000) |
| `FRONTEND_URL` | Allowed frontend origin(s), comma-separated (CORS) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Single admin login credentials (default `admin` / `admin123`) |
| `JWT_SECRET` | Secret signing session tokens — set a long random value in production |
| `JWT_EXPIRES_IN` | Session validity, default `24h` |
| `BUSINESS_NAME` / `BUSINESS_ADDRESS` / `BUSINESS_PHONE` / `BUSINESS_EMAIL` | Shown on printed invoices |

### Frontend (`frontend/.env`)

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Backend API base URL, e.g. `https://api.example.com/api` |
| `VITE_BUSINESS_*` | Optional — overrides the business details shown on invoices |

`.env` files are git-ignored; commit `.env.example` instead.