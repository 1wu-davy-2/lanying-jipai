# Repository Guidelines

## Project Structure & Module Organization

`backend/` contains the FastAPI application. Keep HTTP endpoints in `app/routers/`, business rules and transactions in `app/services/`, persistence models in `app/models/`, and request/response contracts in `app/schemas/`. Database migrations live in `backend/alembic/versions/`; backend tests are in `backend/tests/`.

`frontend/` is the Vite React/TypeScript SPA. Organize shared API clients in `src/api/`, reusable UI in `src/components/`, route-level screens in `src/pages/`, state in `src/stores/`, and domain constants/types in `src/constants/` and `src/types/`. `frontend/android/` is the Capacitor wrapper. Product and deployment references belong in `docs/` and `deploy/`.

## Build, Test, and Development Commands

From `backend/`, create a Python 3.11+ virtual environment, install dependencies, then run:

```powershell
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\uvicorn app.main:app --reload
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m scripts.verify_wallets
```

Copy `.env.example` to `.env` before running locally; never commit credentials. From `frontend/`, use `npm install`, `npm run dev`, `npm test`, and `npm run build`. Use `npm run android:sync` after web changes intended for Android; it requires Android API configuration.

## Coding Style & Naming Conventions

Follow the surrounding code: four-space Python indentation and `snake_case` modules, functions, and fields; TypeScript uses two-space indentation, strict mode, `camelCase` values, and `PascalCase` React components/pages. Name tests `test_*.py` and `*.test.tsx`. Keep router handlers thin; put order, wallet, and media invariants in services. No formatter or linter is configured, so run the relevant test suite and build before proposing changes.

## Testing Guidelines

Use pytest for API, migration, configuration, and service behavior. Use Vitest with Testing Library for frontend components and route workflows. Add focused regression coverage alongside changed behavior, especially for authorization, status transitions, balances, and migrations. Run both `python -m pytest -q` and `npm test` when a change crosses the API/UI boundary.

## Commit & Pull Request Guidelines

Use concise conventional commits, matching repository history: `feat: add script library migration`, `fix: validate release config`, or `docs: update deployment plan`. Keep each commit cohesive. PRs should explain the user-facing or operational impact, link the issue when applicable, include migration/configuration notes, list verification commands, and attach screenshots for UI changes.
