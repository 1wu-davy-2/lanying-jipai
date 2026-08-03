# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"蓝鹰寄拍" — a marketplace platform connecting merchants (商家) who post photoshoot/video orders with models/talents (达人) who fulfill them. Three roles: `merchant`, `model`, `admin`. The project is a monorepo with two independent subprojects: `backend/` (Python FastAPI) and `frontend/` (React + Vite + Capacitor).

## Commands

### Backend (run from `backend/`)

```bash
# Start dev server
uvicorn app.main:app --reload

# Run all tests
pytest

# Run a single test file
pytest tests/test_order_api.py

# Run a single test by name
pytest tests/test_order_api.py::test_function_name -v

# Apply DB migrations
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "description"
```

### Frontend (run from `frontend/`)

```bash
npm run dev          # Vite dev server
npm run build        # TypeScript check + Vite production build
npm run test         # Vitest (run once)
npm run preview      # Preview production build

# Android
npm run android:sync # Build + cap sync
npm run android:open # Open in Android Studio
```

## Architecture

### Backend

**Response envelope** — every endpoint returns `{code: int, message: str, data: T}`. HTTP errors map to app-level codes (400→1001, 401→1002, etc.). New endpoints must follow this convention via the helpers in `app/routers/`.

**Database** — SQLAlchemy 2 sync ORM. Models use `ID_TYPE = BigInteger().with_variant(Integer, "sqlite")` so the same code runs on SQLite (dev/test) and MariaDB (production). Dev tests use an in-memory SQLite DB created fresh per test session.

**Auth** — JWT access tokens (30 min) + refresh tokens (7 days). `app/deps.py` provides `get_current_user`, `require_merchant`, `require_model`, `require_admin` FastAPI dependencies. Login lockout logic is in `app/security.py`.

**Order lifecycle** — `PUBLISHED → CLAIMED → SHIPPED → IN_PROGRESS → SUBMITTED → COMPLETED / DISPUTED`. Multi-talent fulfillment is supported: an order can have multiple `Fulfillment` records (one per talent slot). Business logic lives in `app/services/order_service.py` and `app/services/wallet_service.py`.

**Media storage** — abstracted in `app/services/media_storage.py`. Driver is selected by config: `local` (default), `cos` (Tencent Cloud), or `minio`. Files are served at `/uploads`.

**Bootstrap** — an admin account is auto-created on startup by `app/services/bootstrap.py` if none exists.

### Frontend

**Routing** — React Router v7. Entry at `App.tsx`. Three role portals: `/merchant/*`, `/model/*`, `/admin/*`. `routes/ProtectedRoute.tsx` gates routes by role.

**Auth state** — Zustand store in `stores/authStore.ts`, persisted to `localStorage` under key `lanying-jipai-auth`. Axios instance in `api/client.ts` injects the Bearer token and redirects to `/login` on 401.

**API layer** — all backend calls go through typed wrappers in `api/` (orders.ts, users.ts, wallets.ts, admin.ts, auth.ts). Each uses a `request<T>()` helper that unwraps the `{code, message, data}` envelope and throws on non-zero code.

**Data fetching** — TanStack React Query v5. Use `useQuery` / `useMutation` in page components; do not call API wrappers directly from event handlers.

**UI** — Ant Design 5. Mobile shell is Capacitor 8 targeting Android.

## Key Config

Backend settings are loaded by `app/config.py` (pydantic-settings) from environment variables or a `.env` file at `backend/.env`. See `.env.example` at the repo root for required variables.

## Testing Notes

- Backend tests use SQLite in-memory and a shared `TestClient`; look at `tests/conftest.py` for fixtures.
- Frontend tests use Vitest + Testing Library; mock API calls with `vi.mock('../api/...')`.
- E2E tests use Playwright (Python); separate from the pytest unit suite.
