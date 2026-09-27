# Todo App

A simple full-stack todo app for one person: add, view, complete and delete tasks. Tasks persist
across refreshes and restarts. The app works from a 320 px phone up to a desktop, with clear
loading, empty and error states.

It was built with [Spec Kit](https://github.com/github/spec-kit)'s spec-driven workflow.
The specification and design live in [`specs/002-todo-app/`](specs/002-todo-app/), and the
project rules are in the [constitution](.specify/memory/constitution.md).

## Prerequisites

- Node.js 24 LTS and npm 11 or later
- For end-to-end tests: `npx playwright install --with-deps chromium`

## Quick start

```bash
npm install
npm run dev      # API on :3000, app on http://localhost:5173 (proxies /api)
```

For production:

```bash
npm run build
npm start        # one process on :3000 serving the API and the built app
```

See the [quickstart guide](specs/002-todo-app/quickstart.md) for manual validation scenarios
and an API smoke test.

## Scripts

| Command                          | What it does                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | Backend (`tsx watch`) and Vite dev server together                                                  |
| `npm run build`                  | Builds `shared`, then `backend`, then `frontend`                                                    |
| `npm start`                      | Runs the production server from `backend/dist`                                                      |
| `npm test`                       | Vitest: unit, contract, integration and component tests, plus the contract-coverage check           |
| `npm run test:e2e`               | Playwright: every user story at 320 px and 1280 px, edge cases, axe accessibility scan, performance |
| `npm run lint`                   | ESLint (bans `dangerouslySetInnerHTML`) and a strict type-check of every workspace                  |
| `npm run seed -w backend -- 500` | Inserts 500 sample todos into the configured database                                               |

## Configuration

The backend reads environment variables. See [`backend/.env.example`](backend/.env.example).

| Variable            | Default           | Purpose                                                                       |
| ------------------- | ----------------- | ----------------------------------------------------------------------------- |
| `PORT`              | `3000`            | HTTP port                                                                     |
| `DATABASE_PATH`     | `./data/todos.db` | SQLite file, created and migrated on first start                              |
| `LOG_LEVEL`         | `info`            | Log level (pino)                                                              |
| `VITE_API_BASE_URL` | `/api`            | Frontend build-time API URL, only needed if the frontend is hosted separately |

## Architecture

```text
shared/    Validation rules and API types, used by both sides (one source of truth)
backend/   Fastify REST API, SQLite via better-sqlite3, SQL migrations
frontend/  React 19 + Vite single-page app, plain CSS
e2e/       Playwright suites that run against a production build
```

- **API**: `GET/POST /api/todos`, `PATCH/DELETE /api/todos/:id`, `GET /api/health`. It is
  specified in [`contracts/openapi.yaml`](specs/002-todo-app/contracts/openapi.yaml).
  Every documented response is covered by a contract test, and `npm test` fails if one isn't.
- **Instant UI**: changes appear before the server confirms them. A failed save rolls back
  only the affected todo, shows a message, and keeps typed text. Status updates for the same
  todo are sent one at a time, so a late response can't overwrite a newer click.
- **Ready for accounts**: every query is scoped by an owner id. In v1, `getOwnerId()` in
  `backend/src/todos/owner.ts` always returns `'local'`; adding sign-in means changing that
  one function.

More detail is in the [implementation plan](specs/002-todo-app/plan.md),
[research decisions](specs/002-todo-app/research.md),
[data model](specs/002-todo-app/data-model.md) and
[UI contract](specs/002-todo-app/contracts/ui-contract.md).
