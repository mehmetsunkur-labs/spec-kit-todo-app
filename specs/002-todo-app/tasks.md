---

description: "Task list for the Personal Todo App (002-todo-app)"
---

# Tasks: Personal Todo App

**Input**: Design documents from `/specs/002-todo-app/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [contracts/ui-contract.md](./contracts/ui-contract.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution Principle III says every acceptance scenario and edge case needs an automated test, written before or together with the behavior. In each story, the test tasks come first and MUST fail before the implementation tasks start.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as its own increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1–US4)
- Paths are relative to the repository root

## Path Conventions

This is a web application using npm workspaces: `shared/`, `backend/`, `frontend/` and `e2e/` (see the plan's Project Structure).

- Shared package name: `@todo/shared`. It builds to `shared/dist/` and is imported by both backend and frontend.
- All code is TypeScript with ES modules (`"type": "module"`) and `strict: true`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the workspaces, tooling and test runners.

- [X] T001 Create root `package.json`:
  - `"private": true`, `"type": "module"`, `"engines": { "node": ">=24" }`, and `"workspaces": ["shared", "backend", "frontend", "e2e"]`.
  - Scripts:
    - `build`: builds shared, then backend, then frontend, in that order.
    - `predev`: builds shared.
    - `dev`: runs backend and frontend dev together (`concurrently`, dev dependency).
    - `start`: `npm start -w backend`.
    - `test`: `npm test --workspaces --if-present`.
    - `test:e2e`: `npm test -w e2e`.
    - `lint`: `eslint . && npm run typecheck --workspaces --if-present`. Every workspace's `package.json` defines `typecheck: tsc --noEmit -p tsconfig.json`.
  - Also create `.gitignore` covering `node_modules/`, `dist/`, `data/`, `.env`, `e2e/.tmp/`, `playwright-report/` and `test-results/`.
- [X] T002 [P] Create `tsconfig.base.json` with `strict: true`, `target: ES2023`, `module: NodeNext`, `moduleResolution: NodeNext`, `esModuleInterop`, `skipLibCheck`, `declaration` and `sourceMap`. Each workspace tsconfig extends this file.
- [X] T003 [P] Create `eslint.config.js` (flat config):
  - `typescript-eslint` recommended rules, `eslint-plugin-react` and `eslint-plugin-react-hooks`.
  - `react/no-danger: "error"`, which bans `dangerouslySetInnerHTML` (FR-018, Constitution Security).
  - Ignore `dist/`.
  - Also add `.prettierrc` (singleQuote, trailingComma all, printWidth 100).
- [X] T004 [P] Create the `shared/` workspace:
  - `shared/package.json`: name `@todo/shared`, dependency `zod`, dev dependency `vitest`, scripts `build: tsc -p tsconfig.json` and `test: vitest run`, with `exports` pointing to `./dist/index.js` and types `./dist/index.d.ts`.
  - `shared/tsconfig.json`: `rootDir: src`, `outDir: dist`.
- [X] T005 [P] Create the `backend/` workspace:
  - `backend/package.json`:
    - Dependencies: `fastify@^5`, `@fastify/helmet`, `@fastify/static`, `better-sqlite3`, `@todo/shared`.
    - Dev dependencies: `@types/better-sqlite3`, `tsx`, `vitest`, `yaml`.
    - Scripts: `dev: tsx watch src/server.ts`, `build: tsc -p tsconfig.json && cp -r src/db/migrations dist/db/`, `start: node dist/server.js`, `test: vitest run`, `seed: tsx scripts/seed.ts`.
  - `backend/tsconfig.json`: `rootDir: src`, `outDir: dist`.
  - `backend/vitest.config.ts`: node environment, `tests/**/*.test.ts`.
  - `backend/.env.example` with `PORT=3000`, `DATABASE_PATH=./data/todos.db` and `LOG_LEVEL=info`.
- [X] T006 [P] Create the `frontend/` workspace:
  - `frontend/package.json`:
    - Dependencies: `react@^19`, `react-dom@^19`, `@todo/shared`.
    - Dev dependencies: `vite@^7`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom`.
    - Scripts: `dev: vite`, `build: tsc --noEmit && vite build`, `test: vitest run`.
  - `frontend/tsconfig.json`: `jsx: react-jsx`, `moduleResolution: Bundler`, `noEmit`.
  - `frontend/vite.config.ts`:
    - Proxy `/api` to `http://localhost:3000`.
    - Test config: `environment: 'jsdom'`, `setupFiles: ['tests/setup.ts']`.
  - `frontend/index.html` with `<html lang="en">`, a viewport meta tag, `<title>Todos</title>` and `<div id="root">`.
  - `frontend/tests/setup.ts` importing `@testing-library/jest-dom/vitest`.
  - `frontend/src/vite-env.d.ts` declaring `VITE_API_BASE_URL`.
- [X] T007 [P] Create the `e2e/` workspace:
  - `e2e/package.json`: dev dependencies `@playwright/test` and `@axe-core/playwright`; scripts `test: playwright test` and `typecheck: tsc --noEmit -p tsconfig.json`.
  - `e2e/tsconfig.json` extending `../tsconfig.base.json`, with `noEmit`.
  - `e2e/playwright.config.ts`:
    - `testDir: tests`, `fullyParallel: false`, `workers: 1`, `baseURL: http://localhost:3100`.
    - Projects:
      - `mobile-320`: `viewport { width: 320, height: 640 }`, `hasTouch: true`.
      - `desktop-1280`: `viewport { width: 1280, height: 800 }`.
    - `webServer`:
      - `command: npm run build --prefix .. && npm start --prefix ../backend`.
      - `env: { PORT: '3100', DATABASE_PATH: '../e2e/.tmp/e2e.db' }`.
      - `url: http://localhost:3100/api/health`, `reuseExistingServer: !process.env.CI`.
- [X] T008 Run `npm install` at the root and commit `package-lock.json`. Verify that `npm run lint` and `npm test` both exit 0, with no tests yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation, database, app skeleton, API client and styles that every story needs.

**⚠️ CRITICAL**: No user story work can start until this phase is complete.

### Shared validation (Constitution II, FR-003, FR-015)

- [X] T009 [P] Write failing unit tests in `shared/tests/todo.test.ts` for `parseDescription`:
  - Trims `"  Buy milk  "` to `"Buy milk"`.
  - Rejects `""` and `"   "` with "Please enter a task description."
  - Accepts 500 ASCII characters and rejects 501, with "Descriptions can be at most 500 characters."
  - Accepts 500 emoji (`'🎉'.repeat(500)`), because length counts Unicode code points.
  - Rejects `"a\nb"`, `"a\tb"` and `"\u007f"` with "Descriptions must be a single line of text."
  - Preserves `"日本語テキスト 🎉"` and `"<img src=x onerror=alert(1)>"` exactly.
- [X] T010 Implement `shared/src/todo.ts` and re-export it from `shared/src/index.ts` so that T009 passes. The file contains:
  - `DESCRIPTION_MAX_LENGTH = 500`.
  - `ERROR_CODES = ['VALIDATION_ERROR', 'NOT_FOUND', 'INTERNAL_ERROR'] as const` and the `ErrorCode` type.
  - `interface Todo { id: string; description: string; completed: boolean; createdAt: string; updatedAt: string }`.
  - Request and response types: `CreateTodoRequest { description: string }`, `UpdateTodoRequest { completed: boolean }`, `ListTodosResponse { items: Todo[] }`, `ErrorResponse { error: { code: ErrorCode; message: string; details?: { field: string; message: string }[] } }`.
  - A Zod `descriptionSchema` with these rules, applied in order:
    1. trim;
    2. non-empty, else "Please enter a task description.";
    3. `[...s].length <= 500`, else "Descriptions can be at most 500 characters.";
    4. `/[\u0000-\u001F\u007F]/` must not match, else "Descriptions must be a single line of text."
  - `parseDescription(input: unknown): { ok: true; value: string } | { ok: false; message: string }`.
  - `countCodePoints(s: string): number`.

### Backend core

- [X] T011 [P] Implement `backend/src/config.ts`. It exports `loadConfig(env = process.env)`, which returns `{ port, databasePath, logLevel }`:
  - `port` from `PORT`, default `3000`.
  - `databasePath` from `DATABASE_PATH`, default `./data/todos.db`, resolved relative to `process.cwd()`.
  - `logLevel` from `LOG_LEVEL`, default `info`.
  - Throw if `PORT` is not an integer between 1 and 65535.
- [X] T012 [P] Create `backend/src/db/migrations/001_create_todos.sql` with the exact schema from data-model.md:
  - Table `todos`:
    - `id TEXT PRIMARY KEY`
    - `owner_id TEXT NOT NULL DEFAULT 'local'`
    - `description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500)`
    - `completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1))`
    - `created_at TEXT NOT NULL`
    - `updated_at TEXT NOT NULL`
  - Index: `CREATE INDEX idx_todos_owner_created ON todos (owner_id, created_at DESC, id DESC);`
- [X] T013 Implement `backend/src/db/connection.ts`. It exports `openDatabase(path: string): Database`, which:
  - Creates the parent directory if missing, then opens the file with better-sqlite3.
  - Sets `journal_mode = WAL`, `synchronous = NORMAL` and `foreign_keys = ON`.
  - Reads `NNN_*.sql` files from `migrations/` next to the module, sorted by name.
  - Applies each file whose number is greater than `PRAGMA user_version`, inside a transaction, then sets `user_version` to that number.

  Also add a unit test in `backend/tests/unit/connection.test.ts`: opening a temporary file twice applies the migration once, and `user_version` is 1.
- [X] T014 [P] Implement `backend/src/errors.ts`:
  - `class AppError extends Error { statusCode; code: ErrorCode; details? }`, with the helpers `notFound()` (404, `NOT_FOUND`, "This task no longer exists.") and `validationError(message, details)` (400, `VALIDATION_ERROR`).
  - `errorHandler(error, request, reply)`, which maps:
    - `AppError` → its envelope;
    - Fastify validation errors (`error.validation`) → 400 `VALIDATION_ERROR` with `details[{ field, message }]`;
    - `FST_ERR_CTP_*`, invalid JSON and body-too-large errors → 400 `VALIDATION_ERROR`, "The request body is not valid.";
    - anything else → log the error with `request.log.error` and return 500 `{ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Your change was not saved.' } }`. Stack traces and SQL MUST NOT appear in responses.
  - `notFoundHandler` for unknown `/api/*` routes, which returns 404 `NOT_FOUND`.
- [X] T015 [P] Implement `backend/src/todos/owner.ts`: `export function getOwnerId(_request: FastifyRequest): string { return 'local'; }`, with a comment marking it as the single place where authentication plugs in later (FR-019).
- [X] T016 Create `backend/src/todos/repository.ts`:
  - The `TodoRepository` interface exactly as in data-model.md: `list(ownerId)`, `create(ownerId, description)`, `setCompleted(ownerId, id, completed): Todo | null`, `delete(ownerId, id): boolean`.
  - A factory `createSqliteTodoRepository(db)` that prepares its statements once and maps rows (`completed` 0/1 → boolean, snake_case → camelCase).
  - Method bodies are added in the story phases. Until then, the unimplemented methods throw `new Error('not implemented')`.
- [X] T017 [P] Create the backend test helper `backend/tests/helpers.ts`:
  - `createTestApp()` makes a temporary directory with `fs.mkdtempSync(os.tmpdir())`, opens the DB file in it, builds the app with the logger off (it imports `buildApp` from `backend/src/app.ts`, which T019 creates; until then, tests that use the helper fail, as intended), and returns `{ app, db, dbPath, close }`. `close` closes both and removes the directory.
  - `reopenTestApp(dbPath)` restarts the app against the same file.
  - `loadOpenApi()` parses `specs/002-todo-app/contracts/openapi.yaml` with `yaml`.
  - `expectMatchesSchema(body, schemaName)` validates `body` against `components.schemas[schemaName]` using Fastify's bundled Ajv.
- [X] T018 Write the failing contract test `backend/tests/contract/health.test.ts` **before** `app.ts` exists (Constitution III). It checks:
  - `GET /api/health` → 200 `{ status: 'ok' }`.
  - The response carries a `content-security-policy` header containing `default-src 'self'`.
  - `GET /api/nope` → 404 matching `ErrorResponse`.
  - A POST with a 20 KB body → 400 `VALIDATION_ERROR`.
- [X] T019 Implement `backend/src/app.ts` so that T018 passes. It exports `buildApp({ db, logger }: { db: Database; logger?: boolean | object }): FastifyInstance`, which:
  - Creates Fastify with `bodyLimit: 16384`, `ajv: { customOptions: { removeAdditional: false, coerceTypes: false } }` (so `"yes"` or `5` is never coerced), and the logger.
  - Registers `@fastify/helmet` with CSP `default-src 'self'` (`script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`).
  - Sets `errorHandler` and `notFoundHandler` from T014.
  - Decorates `todos` with `createSqliteTodoRepository(db)`.
  - Registers `GET /api/health`, which runs `SELECT 1` and returns `{ status: 'ok' }`.
  - Registers the todos routes plugin (`backend/src/todos/routes.ts`, initially empty) under the prefix `/api`.
  - If `frontend/dist` exists (resolved from the backend package root as `../frontend/dist`), registers `@fastify/static` for it, with a SPA fallback that serves `index.html` for non-`/api` GET requests.
- [X] T020 Implement `backend/src/server.ts`. It calls `loadConfig()`, `openDatabase()` and `buildApp()`, then `listen({ port, host: '0.0.0.0' })`. On `SIGINT` and `SIGTERM`, it awaits `app.close()`, calls `db.close()`, then exits with code 0.

### Frontend core

- [X] T021 [P] Write failing tests in `frontend/tests/api-client.test.ts`, stubbing `fetch` with `vi.stubGlobal`:
  - A success response is parsed into typed data.
  - An error envelope becomes `ApiError { status, code, message, details }`.
  - A network rejection becomes `ApiError { status: 0, code: 'NETWORK_ERROR', message: "Couldn't reach the server." }`.
  - A 204 response resolves to `undefined`.
- [X] T022 Implement `frontend/src/api/client.ts` so that T021 passes:
  - `class ApiError extends Error`.
  - `BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'`.
  - An internal `request<T>(method, path, body?)` that sets the JSON headers and parses the error envelope.
  - The exports `listTodos(): Promise<Todo[]>`, `createTodo(description)`, `updateTodo(id, completed)` and `deleteTodo(id)`, all using the types from `@todo/shared`.
- [X] T023 [P] Write failing tests in `frontend/tests/formatTime.test.ts` for `formatCreatedAt(iso, now)`:
  - Under 60 s → "just now".
  - Under 60 min → "5 min ago".
  - Under 24 h → "3 hr ago".
  - Yesterday → "yesterday".
  - Older → a locale date via `Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })`.
  - `formatFullTimestamp(iso)` → a date-time string for the `title` attribute.
- [X] T024 Implement `frontend/src/lib/formatTime.ts` using `Intl.RelativeTimeFormat` (`numeric: 'auto'`) and `Intl.DateTimeFormat`, with no date library, so that T023 passes.
- [X] T025 [P] Create `frontend/src/styles.css` (mobile first):
  - CSS custom properties for colors, with WCAG AA contrast.
  - `body` has an explicit background; `main` has `max-width: 40rem; margin-inline: auto; padding-inline: 16px`.
  - `.visually-hidden` utility.
  - Every button, text input **and checkbox itself** measures at least 44 × 44 px. Style the checkbox with `appearance: none; inline-size: 44px; block-size: 44px` plus a visible checked mark; a large label alone is not enough, because T072 measures each control's own box.
  - `:focus-visible` shows a 3 px outline.
  - `.todo-description { overflow-wrap: anywhere; }` and no element wider than the viewport.
  - `@media (prefers-reduced-motion: reduce)` disables transitions.
- [X] T026 Create `frontend/src/main.tsx`, which renders `<App />` into `#root` and imports `styles.css`. Create `frontend/src/App.tsx` with `<main>` and `<h1>Todos</h1>`, plus placeholders for the form and list.
- [X] T027 [P] Create `e2e/tests/helpers.ts`:
  - `resetTodos(request)` calls `GET /api/todos` and then `DELETE`s each item through Playwright's `APIRequestContext`.
  - `seedTodos(request, descriptions: string[])` POSTs each one in order.
  - `todoItems(page)` returns `page.getByRole('list', { name: 'Tasks' }).getByRole('listitem')`.

**Checkpoint**: `npm run lint` and `npm test` pass. `GET /api/health` works. The page shows the "Todos" heading.

---

## Phase 3: User Story 1: Add tasks and see them (Priority: P1) 🎯 MVP

**Goal**: The user opens the app, sees their todos (or an empty state), adds tasks that appear at the top straight away, and still sees them after refreshes and server restarts.

**Independent Test**: Start with no data, add three tasks, refresh, and confirm all three are shown newest first with their descriptions and creation times. Blank input creates nothing.

### Tests for User Story 1 ⚠️ (write first, confirm they FAIL)

- [X] T028 [P] [US1] Write the repository unit tests in `backend/tests/unit/repository.test.ts`, using the helper's temporary DB. They check that:
  - `create('local', 'A')` returns a UUID v4 `id`, `completed: false`, and `createdAt === updatedAt` as an ISO 8601 UTC string with milliseconds.
  - `list('local')` returns items newest first, `created_at DESC, id DESC`. Fake the clock with `vi.setSystemTime` to cover equal timestamps.
  - `list('other')` does not return `'local'` todos (owner scoping, FR-019).
- [X] T029 [P] [US1] Write the contract tests in `backend/tests/contract/todos-create-list.test.ts`, validating every response body with `expectMatchesSchema`. They check that:
  - `GET /api/todos` on an empty DB → 200 `{ items: [] }`.
  - `POST /api/todos {"description":"  Buy milk  "}` → 201, with a `Location` header of `/api/todos/{id}` and a `Todo` whose description is `"Buy milk"` and `completed` is `false`.
  - A subsequent GET lists items newest first.
  - Each of these → 400 `VALIDATION_ERROR` with a `details[0].field` of `description`, except where noted:
    - `""`
    - `"   "`
    - 501 characters
    - `"a\nb"`
    - a missing `description`
    - `{"description": 5}`
    - an extra property `{"description":"x","completed":true}` (here `details[0].field` is `completed`)
  - Invalid JSON → 400.
  - 500 emoji → 201.
  - Markup text is returned byte for byte, unescaped.
- [X] T030 [P] [US1] Write the integration test in `backend/tests/integration/persistence.test.ts`. It creates 3 todos, closes the app and DB, calls `reopenTestApp(dbPath)`, and asserts that `GET /api/todos` returns deep-equal items (same `id`, `description`, `completed`, `createdAt`). This covers SC-004 and FR-011.
- [X] T031 [P] [US1] Write the reducer and hook tests in `frontend/tests/useTodos.test.tsx`, using `renderHook` with a mocked `api/client`. They check that:
  - The initial status is `loading`, and after `listTodos` resolves it is `ready` with the items.
  - `add('Task')` puts an item with `tempId` at index 0 straight away, before the promise settles.
  - On success, the item is replaced with the server `Todo`, keeping its position.
  - `add` returns `true` on success.
- [X] T032 [P] [US1] Write the component tests in `frontend/tests/TodoForm.test.tsx`. They check that:
  - There is a textbox labelled "New task" with **no** `maxLength` attribute (HTML counts UTF-16 units, but the limit is 500 code points), and a button "Add task".
  - A counter linked by `aria-describedby` shows "0/500", and "3/500" after typing `🎉🎉🎉` (code points, via `countCodePoints`).
  - Typing and pressing Enter calls `onAdd` with the trimmed text, clears the input, and keeps focus on it.
  - Submitting `"   "` does not call `onAdd`, sets `aria-invalid="true"`, and shows "Please enter a task description." linked by `aria-describedby`.
  - Entering 501 characters and submitting does not call `onAdd` and shows "Descriptions can be at most 500 characters." (validated with `parseDescription` from `@todo/shared`).
  - Entering 500 emoji and submitting calls `onAdd` with all 500.
- [X] T033 [P] [US1] Write the component tests in `frontend/tests/TodoList.test.tsx`. They check that:
  - With no items, "No tasks yet. Add one above to get started." is shown.
  - With items, a `list` named "Tasks" has one `listitem` per todo, in the given order.
  - Each item shows its description as text (markup is rendered literally, with no `img` element created).
  - Each item has a `<time>` element whose `dateTime` equals `createdAt`.
  - "{n} of {total} remaining" is shown.
- [X] T034 [P] [US1] Write the Playwright spec `e2e/tests/us1-capture.spec.ts`, with `resetTodos` in `beforeEach`. It checks that:
  - The empty state is visible (US1-AS1).
  - Adding "One", "Two" and "Three" shows each at the top straight away, with the input cleared and focused (US1-AS2).
  - After `page.reload()`, the order is Three, Two, One and the times are unchanged (US1-AS3).
  - Submitting whitespace creates no item (US1-AS4).
  - Leading and trailing spaces are trimmed.

### Implementation for User Story 1

- [X] T035 [US1] Implement `list` and `create` in `backend/src/todos/repository.ts`:
  - `list`: `SELECT … WHERE owner_id = ? ORDER BY created_at DESC, id DESC`.
  - `create`: `id = crypto.randomUUID()`, `now = new Date().toISOString()`, INSERT with `completed = 0` and `created_at = updated_at = now`, then return the mapped `Todo`.
  - T028 must pass.
- [X] T036 [US1] Implement `backend/src/todos/routes.ts` as a Fastify plugin:
  - `GET /todos` → `{ items: app.todos.list(getOwnerId(req)) }`.
  - `POST /todos`:
    - JSON body schema: `{ type: 'object', required: ['description'], additionalProperties: false, properties: { description: { type: 'string' } } }`.
    - The handler runs `parseDescription` from `@todo/shared` and throws `validationError(message, [{ field: 'description', message }])` on failure. Otherwise it creates the todo, sets `Location`, and replies 201.
  - Map Ajv errors to `details[{ field, message }]` with the offending property name: `description` when missing or of the wrong type, and the extra property's own name (e.g. `completed`) for `additionalProperties` errors.
  - T029 and T030 must pass.
- [X] T037 [US1] Implement `frontend/src/state/useTodos.ts`:
  - State: `{ status: 'loading' | 'ready' | 'error'; items: ViewTodo[]; notice: { kind: 'error' | 'info'; message: string } | null }`, where `ViewTodo = Todo & { key: string; pending?: boolean }` and `key` is `id` or `temp-<n>`.
  - A pure `todosReducer` with the actions `loadStart`, `loadSuccess`, `loadFailure`, `addOptimistic`, `addConfirmed`, `addFailed` and `dismissNotice`. The reducer is exported for tests.
  - The hook loads on mount and exposes `{ state, add(description): Promise<boolean>, reload(), dismissNotice() }`.
  - T031 must pass.
- [X] T038 [P] [US1] Implement `frontend/src/components/TodoForm.tsx` according to ui-contract.md:
  - A `<form>` containing a visible `<label for="new-task">New task</label>`, an `<input id="new-task" autoComplete="off">` with **no** `maxLength`, a counter `<span id="new-task-count">{countCodePoints(value)}/500</span>`, and `<button type="submit">Add task</button>`.
  - Client validation uses `parseDescription` on submit, with the error in `<p id="new-task-error">` wired to `aria-invalid` and `aria-describedby` (which references both the counter and the error).
  - Props: `onAdd(description): Promise<boolean>` and `disabled`.
  - On submit: clear the input and keep focus.
  - T032 must pass.
- [X] T039 [P] [US1] Implement `frontend/src/components/TodoItem.tsx` (display only for now):
  - An `<li>` containing `<span className="todo-description">{todo.description}</span>` (a text child only) and `<time dateTime={todo.createdAt} title={formatFullTimestamp(...)}>{formatCreatedAt(...)}</time>`.
  - Wrapped in `React.memo`, so 500-item lists re-render cheaply.
- [X] T040 [US1] Implement `frontend/src/components/TodoList.tsx`:
  - The empty state: `<p>No tasks yet. Add one above to get started.</p>`.
  - Otherwise `<ul aria-label="Tasks">` rendering a `TodoItem` per item, keyed by `key`.
  - `<p>{remaining} of {total} remaining</p>`.
  - T033 must pass.
- [X] T041 [US1] Wire `frontend/src/App.tsx`: `useTodos()`, then `<TodoForm onAdd={add} />`, then `<TodoList items={state.items} />` when `status === 'ready'`. Add `.todo-description`, list and form layout styles to `frontend/src/styles.css`. T034 must pass on both Playwright projects.

**Checkpoint**: US1 is fully functional. `npm test` and `npx playwright test us1` pass. This is the MVP, and it can be demoed.

---

## Phase 4: User Story 2: Mark tasks as done (Priority: P2)

**Goal**: The user switches a todo between active and completed. Completed todos look clearly different (not by color alone), and the status persists.

**Independent Test**: Mark a todo complete, confirm it's struck through and muted with a checked box, refresh, confirm it's still complete, then mark it active again.

**Depends on**: US1, which provides create and the list to act on.

### Tests for User Story 2 ⚠️ (write first, confirm they FAIL)

- [X] T042 [P] [US2] Add `setCompleted` cases to `backend/tests/unit/repository.test.ts`:
  - Setting `true` then `false` returns the updated `Todo`, and `updatedAt` increases while `createdAt` stays the same.
  - Setting the same value twice succeeds both times (idempotent).
  - An unknown id returns `null`.
  - Another owner's id returns `null`.
- [X] T043 [P] [US2] Write the contract tests in `backend/tests/contract/todos-update.test.ts`:
  - `PATCH /api/todos/:id {"completed":true}` → 200 `Todo` with `completed: true`. Repeating it → 200 (idempotent).
  - `{"completed":false}` → 200 with `completed: false`.
  - A well-formed but unknown UUID → 404 `NOT_FOUND`, "This task no longer exists."
  - `/api/todos/not-a-uuid` → 400.
  - `{"completed":"yes"}`, `{}` and `{"completed":true,"description":"x"}` → 400 `VALIDATION_ERROR`.
  - All bodies are validated with `expectMatchesSchema`.
- [X] T044 [P] [US2] Extend `backend/tests/integration/persistence.test.ts`: after completing one todo and reopening, `completed` is still `true` (US2-AS3).
- [X] T045 [P] [US2] Add toggle cases to `frontend/tests/useTodos.test.tsx`:
  - `toggle(key, true)` sets `completed: true` straight away, then calls `updateTodo(id, true)` with the **absolute** value.
  - On success, the item is replaced with the server copy.
  - **Out-of-order responses**: with manually controlled mocked promises, call `toggle(key, true)` then `toggle(key, false)`. Only one `updateTodo` is in flight at a time. When the first resolves (`completed: true`), a second `updateTodo(id, false)` is sent. The item shows `false` throughout and ends `false`, matching the server's last write.
  - Three quick toggles (true, false, true) send at most two requests and end `true`.
- [X] T046 [P] [US2] Write the component tests in `frontend/tests/TodoItem.test.tsx`:
  - The `checkbox` has the todo's description as its accessible name and is checked when `completed`.
  - Clicking it, or pressing Space, calls `onToggle(key, !completed)`.
  - When completed, the `<li>` has `data-completed="true"` and the description has the class `is-completed`.
- [X] T047 [P] [US2] Write the Playwright spec `e2e/tests/us2-complete.spec.ts`:
  - Seed two todos.
  - Check the first: it's checked straight away and the description has a `text-decoration-line` of `line-through` (US2-AS1). The count updates.
  - Reload: still checked (US2-AS3).
  - Uncheck: active again (US2-AS2).
  - Toggle using only the keyboard (Tab to the checkbox, then Space).

### Implementation for User Story 2

- [X] T048 [US2] Implement `setCompleted` in `backend/src/todos/repository.ts`: `UPDATE todos SET completed = ?, updated_at = ? WHERE owner_id = ? AND id = ?`. If `changes === 0`, return `null`; otherwise return the re-selected row. T042 must pass.
- [X] T049 [US2] Add `PATCH /todos/:id` to `backend/src/todos/routes.ts`:
  - Params schema: `{ id: { type: 'string', format: 'uuid' } }`.
  - Body schema: `{ type: 'object', required: ['completed'], additionalProperties: false, properties: { completed: { type: 'boolean' } } }`.
  - Throw `notFound()` on `null`. Otherwise reply 200 with the `Todo`.
  - T043 and T044 must pass.
- [X] T050 [US2] Add the `toggleOptimistic`, `toggleConfirmed` and `toggleFailed` actions to `frontend/src/state/useTodos.ts`, and expose `toggle(key, completed)`:
  - Per item, track `confirmedCompleted` (the last value the server confirmed) and `desiredCompleted` (the last value the user asked for). `toggle` sets `desiredCompleted` and the displayed `completed` straight away.
  - Keep **at most one PATCH in flight per item**. If none is in flight, send `desiredCompleted`. When a response arrives, set `confirmedCompleted` from it; if `desiredCompleted` differs, send another PATCH with it. Only replace the item with the server copy when nothing more is queued, so a stale response never overwrites a newer choice.
  - Rollback for US4 restores `confirmedCompleted`.
  - Ignore toggles on items that still have a `tempId`.
  - T045 must pass.
- [X] T051 [US2] Update `frontend/src/components/TodoItem.tsx`:
  - Add `<input type="checkbox" id={`todo-${key}`} checked={completed} onChange={() => onToggle(key, !completed)}>` with `<label htmlFor>` wrapping the description, so the checkbox's name is the description.
  - Add `data-completed` and the `is-completed` class.
  - In `frontend/src/styles.css`, `.is-completed` gets `text-decoration: line-through` **and** a muted color that still meets AA contrast (FR-008, not color alone).
  - Pass `onToggle` through `TodoList` and `App`.
  - T046 and T047 must pass.

**Checkpoint**: US1 and US2 both work. The completed state persists and is keyboard operable.

---

## Phase 5: User Story 3: Delete tasks (Priority: P3)

**Goal**: The user deletes any todo. It disappears straight away and stays gone. Deleting the last one shows the empty state.

**Independent Test**: With several todos, delete one, confirm it vanishes, refresh, and confirm it's still gone and the others are unchanged.

**Depends on**: US1. It's independent of US2.

### Tests for User Story 3 ⚠️ (write first, confirm they FAIL)

- [X] T052 [P] [US3] Add `delete` cases to `backend/tests/unit/repository.test.ts`:
  - `delete` returns `true` and the row is gone.
  - A second `delete` of the same id returns `false`.
  - Another owner's id returns `false`.
- [X] T053 [P] [US3] Write the contract tests in `backend/tests/contract/todos-delete.test.ts`:
  - `DELETE /api/todos/:id` → 204 with an empty body.
  - Repeating it → 404 `NOT_FOUND`.
  - `/api/todos/not-a-uuid` → 400.
  - After deleting, `GET` no longer lists the todo, and the other todos are unchanged.
- [X] T054 [P] [US3] Extend `backend/tests/integration/persistence.test.ts`: a deleted todo is still gone after reopening (US3-AS2).
- [X] T055 [P] [US3] Add remove cases to `frontend/tests/useTodos.test.tsx`: `remove(key)` takes the item out straight away (before the promise settles) and calls `deleteTodo(id)`. On success the state is unchanged.
- [X] T056 [P] [US3] Add delete cases to `frontend/tests/TodoItem.test.tsx` and `frontend/tests/TodoList.test.tsx`:
  - There is a button named "Delete task: {description}" that calls `onDelete(key)`.
  - After deleting, focus moves to the next item's checkbox, or to the previous item's if the last item was deleted, or to the "New task" input if the list is now empty.
- [X] T057 [P] [US3] Write the Playwright spec `e2e/tests/us3-delete.spec.ts`:
  - Seed three todos and delete the middle one: it's gone straight away (US3-AS1) and focus is on the next item.
  - Reload: still gone, and the others are unchanged (US3-AS2).
  - Delete the rest: the empty state is shown (US3-AS3).
  - **Keyboard only** (FR-017): seed two todos, Tab to "Delete task: …" and press Enter. The item is gone and focus is on the remaining item's checkbox. Delete that one the same way: focus moves to the "New task" input.

### Implementation for User Story 3

- [X] T058 [US3] Implement `delete` in `backend/src/todos/repository.ts`: `DELETE FROM todos WHERE owner_id = ? AND id = ?`, returning `changes > 0`. T052 must pass.
- [X] T059 [US3] Add `DELETE /todos/:id` to `backend/src/todos/routes.ts`. It uses the same params schema as PATCH, throws `notFound()` on `false`, and otherwise replies `204` with no body. T053 and T054 must pass.
- [X] T060 [US3] Add the `removeOptimistic`, `removeConfirmed` and `removeFailed` actions to `frontend/src/state/useTodos.ts`, and expose `remove(key)`. `removeOptimistic` stores the removed item and its index for rollback in US4. T055 must pass.
- [X] T061 [US3] Add `<button type="button" aria-label={`Delete task: ${description}`}>` with a visible "Delete" label or icon to `frontend/src/components/TodoItem.tsx`. Implement focus management in `frontend/src/components/TodoList.tsx` using refs keyed by item `key`; the input ref is passed from `App`. Pass `onDelete` through `TodoList` and `App`. T056 and T057 must pass.

**Checkpoint**: US1, US2 and US3 work. All CRUD operations are complete.

---

## Phase 6: User Story 4: Loading and error states (Priority: P3)

**Goal**: A loading indicator is shown while the list loads, a load failure offers a retry, and failed saves roll back with a clear message without losing what the user typed.

**Independent Test**: Delay `/api/todos` and confirm the loading indicator appears. Make add, toggle and delete fail, and confirm each time that a message appears, the list shows the true saved state, and a retry works with no page reload.

**Depends on**: US1 (load and add). It adds rollback behavior to US2 and US3 when those are present.

### Tests for User Story 4 ⚠️ (write first, confirm they FAIL)

- [X] T062 [P] [US4] Add failure cases to `frontend/tests/useTodos.test.tsx`:
  - If `listTodos` rejects → `status: 'error'`. `reload()` → `loading`, then `ready`.
  - If `add` fails → the temporary item is removed, the notice is "Couldn't save your change. Please try again.", and `add` resolves to `false`.
  - If `toggle` fails → `completed` goes back to the last server-confirmed value (`confirmedCompleted`), and any queued value is dropped.
  - If `remove` fails → the item is put back at its original index.
  - If `toggle` or `remove` fails with `ApiError` code `NOT_FOUND` → the notice is "This task no longer exists." and `listTodos` is called again (a reload).
  - A failure on one item leaves the other items and their pending changes alone.
- [X] T063 [P] [US4] Write the component tests in `frontend/tests/LoadState.test.tsx` and `frontend/tests/StatusBanner.test.tsx`:
  - The loading state is `role="status"` with "Loading tasks…".
  - The error state is `role="alert"` with "Couldn't load your tasks." and a button "Try again" that calls `onRetry`.
  - `StatusBanner` renders the notice in a `role="status"` region with `aria-live="polite"`, has a "Dismiss" button, and dismisses itself automatically after 6000 ms (`vi.useFakeTimers`).
- [X] T064 [P] [US4] Add to `frontend/tests/TodoForm.test.tsx`: when `onAdd` resolves to `false`, the input value is restored to the submitted text and keeps focus (US4-AS4). While `disabled`, the input and button are disabled.
- [X] T065 [P] [US4] Write the Playwright spec `e2e/tests/us4-errors.spec.ts`, using `page.route('**/api/todos**', …)`:
  - Delay the GET by 1.5 s: "Loading tasks…" is visible, then the list appears (US4-AS1).
  - Make the GET return 500: the alert appears. Remove the route and click "Try again": the list loads (US4-AS2).
  - Make POST, PATCH and DELETE each abort in turn: the list goes back to its previous state and the save-error message appears (US4-AS3). After a failed add, the input still holds the text; remove the route and press Enter: the item is saved (US4-AS4). No `page.reload()` is used anywhere in the flow (SC-005).

### Implementation for User Story 4

- [X] T066 [US4] Implement rollback in `frontend/src/state/useTodos.ts`:
  - `addFailed` removes the temporary item.
  - `toggleFailed` restores `confirmedCompleted` and clears the queued value.
  - `removeFailed` reinserts the item at its stored index.
  - Every failure sets the notice "Couldn't save your change. Please try again."
  - A `NOT_FOUND` error sets "This task no longer exists." and calls `reload()`.
  - `loadFailure` sets `status: 'error'`.
  - T062 must pass.
- [X] T067 [P] [US4] Implement `frontend/src/components/LoadState.tsx`:
  - `status === 'loading'` → `<p role="status">Loading tasks…</p>`.
  - `status === 'error'` → `<div role="alert"><p>Couldn't load your tasks.</p><button onClick={onRetry}>Try again</button></div>`.
- [X] T068 [P] [US4] Implement `frontend/src/components/StatusBanner.tsx`: a live region that is always mounted, `<div role="status" aria-live="polite">`, showing the notice text and a "Dismiss" button. It auto-dismisses after 6000 ms, and the timer resets when the notice changes. T063 must pass.
- [X] T069 [US4] Update `frontend/src/components/TodoForm.tsx` so that when `await onAdd(text)` returns `false`, the input value is set back to the submitted text and focus stays. Pass `disabled={state.status !== 'ready'}` from `App`. T064 must pass.
- [X] T070 [US4] Wire `frontend/src/App.tsx`:
  - Render `<StatusBanner notice onDismiss>` above the list.
  - Render `<LoadState status onRetry={reload}>` in place of the list while loading or in error.
  - Add the banner, alert and spinner-free styles to `frontend/src/styles.css`.
  - T065 must pass on both Playwright projects.

**Checkpoint**: All four user stories work on their own and together.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, accessibility, performance, security checks and documentation that span every story.

- [X] T071 [P] Write the Playwright spec `e2e/tests/edge-cases.spec.ts`. It checks that:
  - `<img src=x onerror=alert(1)>` is shown as literal text, and no dialog fires (`page.on('dialog')` fails the test) (FR-018).
  - `"日本語テキスト 🎉"` round-trips exactly after a reload.
  - A 500-character description with no spaces wraps, and `document.documentElement.scrollWidth <= clientWidth` holds on `mobile-320` (FR-016).
  - Typing 501 characters and submitting shows "Descriptions can be at most 500 characters." and creates nothing. 500 emoji can be added and round-trip after a reload.
  - Two quick clicks on the same checkbox, and a double-click on delete, end in a consistent state with no error notice.
  - **Two tabs**: open a second `page` in the same context. Delete a todo in page A, then toggle it in page B: B shows "This task no longer exists." and its list refreshes without the todo.
- [X] T072 [P] Write the Playwright spec `e2e/tests/a11y.spec.ts`. It runs `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()` in the empty, populated (with completed items), loading and error states, and asserts that there are no violations of impact `serious` or `critical`. It also checks that every interactive element's bounding box is at least 44 × 44 px on `mobile-320`.
- [X] T073 [P] Implement `backend/scripts/seed.ts`. It reads the count from `process.argv[2]` (default 500), opens `loadConfig().databasePath` with `openDatabase`, and inserts `Task #n` todos through the repository with `create`. It's used as `npm run seed -w backend -- 500`.
- [X] T074 Write the Playwright spec `e2e/tests/perf.spec.ts` (SC-003, SC-007, Constitution Performance):
  - Seed 500 todos through the API.
  - Measure navigation to a visible first list item: under 1000 ms.
  - For add, toggle and delete, measure from the input event to the DOM change with `performance.now()` inside `page.evaluate` and a `MutationObserver`: each under 100 ms.
  - Run it on `desktop-1280` only.
  - Also add `backend/tests/integration/perf.test.ts` (plan goal: API p95 under 50 ms). Seed 500 todos through the repository, then run 200 `app.inject` calls each for `GET /api/todos`, `POST`, `PATCH` and `DELETE`. Assert that the p95 of each is under 50 ms.
- [X] T075 Add contract coverage checking (Constitution III):
  - `backend/tests/contract/coverage.ts` exports `covered(method: string, path: string, status: number)`, which appends `"POST /todos 400"` style keys to a JSON file in the Vitest temp dir (`coverage-keys.json`).
  - Every contract test calls `covered(...)` next to each response assertion (the health test from T018 and the story contract tests T029, T043 and T053).
  - `backend/vitest.config.ts` sets `globalTeardown: 'tests/contract/check-coverage.ts'`. That file loads `openapi.yaml`, builds every `METHOD path status` key from `paths.*.*.responses`, and throws (failing the run) listing any key that was never recorded.
- [X] T076 [P] Write `README.md` at the repository root with a project summary, the prerequisites, a pointer to `specs/002-todo-app/quickstart.md`, the scripts table, the environment variables and the architecture overview (with links to plan.md and the contracts).
- [X] T077 Verify the production build: `npm run build && npm start`. Then check that `http://localhost:3000/` serves the SPA with the CSP header, that `/api/health` is ok, and that a deep link like `/anything` falls back to `index.html`. Fix any path problems in `backend/src/app.ts`.
- [X] T078 Run the full gate: `npm run lint && npm test && npm run test:e2e` must all pass with zero lint errors. Then walk through every manual scenario in `specs/002-todo-app/quickstart.md` (including the curl smoke test and the server restart) and update the quickstart wherever the actual commands or output differ.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T008 depends on T001–T007.
- **Foundational (Phase 2)**: Depends on Setup and BLOCKS every user story.
  - Within it: T010 depends on T009. T013 depends on T012. T016 depends on T010. T017 depends on T013. T018 depends on T017. T019 depends on T014–T016 and T018. T020 depends on T011 and T019. T022 depends on T021. T024 depends on T023. T026 depends on T025.
- **US1 (Phase 3)**: Depends on Foundational. This is the MVP.
- **US2 (Phase 4)** and **US3 (Phase 5)**: Each depends on US1 (for create and the list), not on each other. They can run in parallel after US1, but both touch `repository.ts`, `routes.ts`, `useTodos.ts` and `TodoItem.tsx`, so merge them one after the other.
- **US4 (Phase 6)**: Depends on US1. Its toggle and remove rollback tests (T062) and the e2e spec (T065) also need US2 and US3, so do it after them.
- **Polish (Phase 7)**: Depends on US1–US4. T074 depends on T027. T078 comes last.

### User Story Dependency Graph

```text
Setup → Foundational → US1 (MVP) ─┬─→ US2 ─┐
                                  └─→ US3 ─┴─→ US4 → Polish
```

### Within Each User Story

- Test tasks come first and MUST fail before implementation (Constitution III).
- Repository → routes → client state (`useTodos`) → components → `App` wiring.
- Each story ends at a checkpoint where its Playwright spec passes on both viewports.

### Parallel Opportunities

- Setup: T002–T007 all run in parallel after T001.
- Foundational: T009, T011, T012, T014, T015, T017, T021, T023, T025 and T027 are independent files and can run in parallel.
- Each story: all test tasks marked [P] run in parallel. In US1, T038 and T039 (form and item components) run in parallel after T037.
- US2 and US3 can be built by different people after US1.
- Polish: T071, T072, T073 and T076 run in parallel.

---

## Parallel Example: User Story 1

```bash
# All US1 tests together (separate files):
Task: "T028 Repository unit tests in backend/tests/unit/repository.test.ts"
Task: "T029 Contract tests in backend/tests/contract/todos-create-list.test.ts"
Task: "T030 Persistence integration test in backend/tests/integration/persistence.test.ts"
Task: "T031 useTodos tests in frontend/tests/useTodos.test.tsx"
Task: "T032 TodoForm tests in frontend/tests/TodoForm.test.tsx"
Task: "T033 TodoList tests in frontend/tests/TodoList.test.tsx"
Task: "T034 Playwright spec in e2e/tests/us1-capture.spec.ts"

# After the backend (T035, T036) and useTodos (T037) are done, the components in parallel:
Task: "T038 TodoForm in frontend/src/components/TodoForm.tsx"
Task: "T039 TodoItem in frontend/src/components/TodoItem.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "T062 useTodos failure tests in frontend/tests/useTodos.test.tsx"
Task: "T063 LoadState/StatusBanner tests in frontend/tests/LoadState.test.tsx, StatusBanner.test.tsx"
Task: "T065 Playwright spec in e2e/tests/us4-errors.spec.ts"
# then
Task: "T067 LoadState in frontend/src/components/LoadState.tsx"
Task: "T068 StatusBanner in frontend/src/components/StatusBanner.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001–T008).
2. Phase 2: Foundational (T009–T027). This is critical, because it blocks every story.
3. Phase 3: US1 (T028–T041).
4. **STOP and VALIDATE**: run the US1 part of quickstart.md and `npx playwright test us1`. Demo it.

### Incremental Delivery

1. Setup + Foundational → the foundation is ready.
2. US1 → validate → demo (the MVP: add, view, persist).
3. US2 → validate → demo (complete and uncomplete).
4. US3 → validate → demo (delete; full CRUD).
5. US4 → validate → demo (loading, error and rollback).
6. Polish → full gate (T078) → ready to merge.

### Parallel Team Strategy

1. Everyone works on Setup and Foundational together.
2. Developer A does US1. Once it's merged, developer A takes US2 while developer B takes US3.
3. US4 comes after both, and the Polish tasks are split up by the [P] markers.

---

## Notes

- [P] tasks touch different files and don't depend on unfinished tasks.
- The user-facing message strings above are the contract (ui-contract.md and data-model.md). Use them verbatim, because tests assert them.
- Commit after each task or logical group, with messages that describe intent (Constitution Workflow).
- Never use `dangerouslySetInnerHTML`, because lint fails the build.
- Stop at any checkpoint to validate a story on its own.

---

## Implementation Notes (recorded during `/speckit-implement`, 2026-09-27)

Where the build differs from the task text, and why:

- **Versions**: TypeScript 5.9, Vite 8, Vitest 5, Zod 4, Fastify 5, React 19. The frontend first pinned Vite 7, but Vitest 5 installed Vite 8 at the root, and `@vitejs/plugin-react` then used Vite 8's built-in refresh plugin inside the Vite 7 dev server, so `npm run dev` failed with `Missing field moduleType`. Everything now uses one Vite 8 copy. ESLint stays on 9 because `eslint-plugin-react` does not support ESLint 10 yet.
- **Build config**: each workspace has `tsconfig.json` (type-checks source and tests) and `tsconfig.build.json` (emits source only). `e2e/` and `frontend/` use `Bundler` module resolution.
- **Root `npm test`** runs only the Vitest workspaces (`shared`, `backend`, `frontend`). Playwright runs through `npm run test:e2e`.
- **Relative times** (T023/T024): `Intl.RelativeTimeFormat` `long` style in the user's locale ("now", "5 minutes ago", "yesterday") instead of the hard-coded English "just now" / "5 min ago".
- **US1 e2e isolation** depends on US3: `resetTodos` clears data with `DELETE`, so the US1 Playwright spec was verified after T059.
- **F11/F13**: `loadFailure` and the failure actions were added in US4 only. The checkbox and Delete button are disabled while a todo's add is still unsaved.
- **Background refresh**: after a `NOT_FOUND`, the list refreshes without showing the loading state and keeps adds that are still in flight.
- **`.env` loading**: `backend/.env` is loaded at startup if present (`process.loadEnvFile`), and variables already set take precedence. The quickstart relies on this.
- **Contract coverage** (T075): the check runs as Vitest global setup/teardown and is enforced when `CHECK_CONTRACT_COVERAGE=1` (set by `npm test`). Documented `500` responses are exempt, because they can't be triggered through the API; `tests/unit/errors.test.ts` covers the 500 path.

Bugs found by the tests and fixed, each with a regression test:

1. **Double-clicking Delete removed two todos**: after the first click, the next item's Delete button slid under the pointer. The second click of a double-click is now ignored (`event.detail > 1`). Found by `e2e/tests/edge-cases.spec.ts`.
2. **Todos created in the same millisecond came back shuffled**: the `id DESC` tiebreak ordered random UUIDs. Ties now break by insertion order (`rowid DESC`), with migration `002_order_ties_by_insertion.sql` for the index. The data model, research §9 and plan are updated. It showed up as an intermittent contract-test failure (2 of 8 runs), and 0 of 10 after the fix.
