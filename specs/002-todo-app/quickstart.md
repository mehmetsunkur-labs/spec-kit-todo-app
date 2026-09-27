# Quickstart & Validation Guide: Personal Todo App

**Feature**: `002-todo-app` | **Plan**: [plan.md](./plan.md)

This guide shows how to run the app and check that each user story works. For API shapes see [contracts/openapi.yaml](./contracts/openapi.yaml). For UI names and states see [contracts/ui-contract.md](./contracts/ui-contract.md). For fields and rules see [data-model.md](./data-model.md).

## Prerequisites

- Node.js 24 LTS and npm 11 or later
- Build tools for the native `better-sqlite3` module. Prebuilt binaries normally cover Linux, macOS and Windows.
- Playwright browsers, for end-to-end tests: `npx playwright install --with-deps chromium`

## Setup

```bash
npm install                 # installs all workspaces (shared, backend, frontend, e2e)
cp backend/.env.example backend/.env   # optional; defaults shown below
```

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Backend HTTP port |
| `DATABASE_PATH` | `./data/todos.db` | SQLite file. It's created, and migrated, on first start |
| `LOG_LEVEL` | `info` | pino log level |
| `VITE_API_BASE_URL` | `/api` | API base URL for the frontend. Only needed if the frontend is hosted separately |

## Run

```bash
npm run dev      # backend on :3000 and Vite on :5173 (proxies /api) → open http://localhost:5173
npm run build    # type-checks and builds shared, backend and frontend
npm start        # production: a single process on :3000 serving the API and the built frontend
```

## Automated checks

```bash
npm run lint         # ESLint (also bans dangerouslySetInnerHTML) and tsc --noEmit
npm test             # Vitest: unit, contract and component tests for all workspaces
npm run test:e2e     # Playwright: all user stories at 320 px and 1280 px, plus an axe scan
```

Expected result: every test passes, with no accessibility violations of serious or critical impact.

## API smoke test (backend running on :3000)

```bash
curl -s localhost:3000/api/health                                  # → {"status":"ok"}
curl -s -XPOST localhost:3000/api/todos -H 'content-type: application/json' \
     -d '{"description":"  Buy milk  "}'                            # → 201, description "Buy milk", completed false
curl -s localhost:3000/api/todos                                   # → {"items":[…]} newest first
curl -s -XPATCH localhost:3000/api/todos/<id> -H 'content-type: application/json' \
     -d '{"completed":true}'                                        # → 200, completed true
curl -s -XPOST localhost:3000/api/todos -H 'content-type: application/json' \
     -d '{"description":"   "}'                                     # → 400 VALIDATION_ERROR
curl -s -o /dev/null -w '%{http_code}\n' -XDELETE localhost:3000/api/todos/<id>   # → 204
curl -s -XDELETE localhost:3000/api/todos/<id>                     # → 404 NOT_FOUND
```

## Manual validation scenarios

Each scenario matches a spec user story. Playwright automates all of them.

### US1: Add tasks and see them

1. Delete `data/todos.db`, run `npm start`, and open the app. **Expect** the empty state (UI contract → Empty).
2. Add "One", "Two" and "Three". **Expect** each to appear at the top straight away, and the input to be cleared and still focused.
3. Refresh the page. **Expect** "Three, Two, One" with the same creation times.
4. Stop and restart the server, then refresh. **Expect** the same list (SC-004).
5. Submit blank input, then 501 characters. **Expect** no todo is created and a validation message appears.

### US2: Mark tasks done

1. Tick "Two". **Expect** it to be struck through and muted with a checked box, and the count to update.
2. Refresh. **Expect** it to still be completed. Untick it. **Expect** it to be active again.

### US3: Delete tasks

1. Delete "One". **Expect** it to vanish straight away and focus to move to the next item.
2. Refresh. **Expect** it to still be gone. Delete the rest. **Expect** the empty state.

### US4: Loading and error states

1. In DevTools, throttle the network to "Slow 3G" and reload. **Expect** "Loading tasks…" until the list appears.
2. Stop the backend and reload. **Expect** the load-error alert with "Try again". Start the backend and click it. **Expect** the list to appear.
3. With the list loaded, stop the backend, then add, toggle and delete a task. **Expect** each change to revert, the save-error message to appear, and for add, the typed text to stay in the input. Start the backend and retry. **Expect** success with no page reload.

### Edge cases

- Open two tabs. Delete a todo in tab A, then toggle it in tab B. **Expect** "This task no longer exists." and tab B's list to refresh.
- Add `<img src=x onerror=alert(1)>`, "日本語テキスト 🎉", and a 500-character string with no spaces. **Expect** each to be shown literally and wrapped, with no script running and no horizontal scroll at 320 px.
- Seed 500 todos (`npm run seed -- 500` in `backend`), then add, toggle and delete. **Expect** the UI to update in under 100 ms (SC-007).
