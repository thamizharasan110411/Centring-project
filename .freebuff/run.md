# Centring Materials ERP — local dev run guide

Three processes make up the live app, all local:

| Process | Port | How to start |
|---|---|---|
| PGlite Postgres (WASM Postgres) | 5432 | `cd backend/.pgtest && node server.js` |
| Backend API (Express + Prisma) | 5000 | `cd backend && node src/server.js` |
| Frontend (Vite dev server) | 5173 | `cd frontend && npm run dev` |

The frontend talks to the API at `http://localhost:5000` (default in `frontend/src/api/client.js`; no `frontend/.env` needed for local dev). No Vite proxy is configured.

## Reproducing artifacts (fresh checkout)

1. `cd backend && npm install` — installs Express, Prisma, JWT, and the PGlite deps (`@electric-sql/pglite-socket`); `postinstall` runs `prisma generate`.
2. `cd frontend && npm install`.
3. `backend/.env` must exist — copy `backend/.env.example` to `backend/.env`. It is checked in locally (gitignored). Values: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/centering_erp`, `PORT=5000`, `FRONTEND_URL=http://localhost:5173`, business details, `ADMIN_USERNAME=admin`, `ADMIN_PASSWORD=admin123`, and a `JWT_SECRET`. **Never commit real secrets** — the local PGlite URL uses throwaway creds.
4. `frontend/.env.example` is optional documentation; the axios client defaults to `http://localhost:5000`.

## Running the servers

### 1. PGlite Postgres (starts empty — `memory://` by default)

`backend/.pgtest/server.js` starts an in-process WASM Postgres speaking the real wire protocol. It defaults to an **in-memory database** (`PGLITE_DATA=memory://`), so on every restart the schema is gone and must be re-applied. For persistence run it with a data dir instead:

```bash
cd backend/.pgtest
node server.js            # in-memory; then re-run migrations (step 2)
# or persist across restarts:
# PGLITE_DATA=backend/.pgtest/data node server.js   (create the dir first)
```

### 2. Apply schema to PGlite (required after a fresh in-memory start)

PGlite chokes on Prisma prepared-statement caching for bulk work, so use the `pgbouncer=true` override and `127.0.0.1` (PGlite binds IPv4 only):

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/centering_erp?pgbouncer=true" npx prisma migrate deploy
# optional demo data:
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/centering_erp?pgbouncer=true" npm run seed
# wipe all data but keep schema (used for the "clean" production start):
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/centering_erp?pgbouncer=true" node scripts/reset-data.js
```

### 3. Backend API (port 5000)

```bash
cd backend && node src/server.js      # or: npm run dev (nodemon)
```

Confirms with `✓ Connected to PostgreSQL` and serves `GET /api/health`. All `/api/*` routes except `/api/health` and `/api/auth/login` require `Authorization: Bearer <JWT>` from `POST /api/auth/login` (`admin` / `admin123`).

### 4. Frontend Vite dev server (port 5173)

```bash
cd frontend && npm run dev
```

Production build check: `cd frontend && npm run build` (emits to `frontend/dist`).

## Notes

- Windows detach recipe used for previews: `Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'C:\Centring-project\frontend' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru` — stdout and stderr must go to different files.
- `backend/vercel.json` + the `postinstall` make the backend deployable to Vercel as a serverless function; the same code runs as a plain Express server locally.
- The backend runs fine against the plain (non-`pgbouncer`) `DATABASE_URL` in `.env` at runtime; the override is only needed for CLI bulk operations (migrate/seed).
