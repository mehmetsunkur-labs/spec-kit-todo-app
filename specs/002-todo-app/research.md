# Research: Personal Todo App

**Feature**: `002-todo-app` | **Date**: 2026-09-27 | **Plan**: [plan.md](./plan.md)

The spec leaves all technology choices to planning. Each decision below resolves one open item in the Technical Context. The guiding criteria come from the PRD: simplicity, performance, maintainability, and room to add user accounts later.

---

## 1. Language and runtime

- **Decision**: TypeScript 5.x (strict mode) on Node.js 24 LTS for the backend, the frontend, and the shared code.
- **Rationale**: One language across the whole stack means validation rules and types can be shared, which directly supports FR-015 (the same rules in the UI and in storage). Node 24 is already installed in the dev environment. Strict typing catches contract drift between client and server at compile time.
- **Alternatives considered**: Python (FastAPI) backend with a TS frontend. It works well, but validation would have to be written twice. Go was also considered; it's more than this scope needs and can't share code with the UI.

## 2. Backend framework

- **Decision**: Fastify 5.
- **Rationale**: Small, fast, and well maintained. It has built-in JSON-schema request validation, structured logging (pino), and `app.inject()` for in-process HTTP tests with no network. Plugins keep the code small and easy to follow.
- **Alternatives considered**: Express needs more add-ons for validation and logging, and its async error handling is weaker. NestJS brings too much structure for four endpoints. Hono is a good option but is less established for plain Node servers.

## 3. Storage

- **Decision**: SQLite in a single file, accessed through `better-sqlite3`, with WAL journal mode. Schema changes are plain SQL migration files, tracked with `PRAGMA user_version`.
- **Rationale**: Durable across browser, page, and server restarts (FR-011, SC-004) with zero separate infrastructure, which keeps it easy to deploy. It's synchronous and in-process, so queries on 500+ rows take well under 1 ms (SC-007). All SQL lives behind a repository interface, so moving to PostgreSQL later (for multi-user) only touches one module.
- **Alternatives considered**: PostgreSQL needs a separate service; it's the right choice once there are accounts but too much for v1. A JSON file on disk risks corruption and has no atomic writes. Node's built-in `node:sqlite` is still flagged experimental or release-candidate, so `better-sqlite3` is the safer choice. An ORM (Prisma or Drizzle) is extra tooling for a single table.

## 4. Shared validation

- **Decision**: A small `shared` workspace package that exports the Zod schema for a todo description and the TypeScript types for the API. Both the frontend form and the backend route handlers use it.
- **Rationale**: One definition of the rules "trimmed, 1–500 characters" guarantees the UI and server agree (FR-003, FR-015).
- **Alternatives considered**: Duplicating the rules could drift apart. Generating types from OpenAPI adds a code-generation step for a tiny API.

## 5. Description length and text handling

- **Decision**: Trim leading and trailing whitespace, then count **Unicode code points** (`[...s].length`). The limit is 1–500. Store the text exactly as entered after trimming, with no Unicode normalization. A description is single-line text, so the UI uses a single-line input and the server rejects control characters (including newlines).
- **Rationale**: Counting code points means one emoji counts as one character in most cases, which matches what users expect better than UTF-16 length. Not normalizing preserves "exactly as entered" (edge case: special characters, emoji and non-Latin text). The same function runs on both sides. The input therefore has **no** HTML `maxLength` (which counts UTF-16 units, and would cap emoji at 250). The UI shows a live "n/500" code-point counter and validates on submit.
- **Alternatives considered**: Counting grapheme clusters with `Intl.Segmenter` is the most accurate, but costs more and brings little benefit at a 500 limit. Counting UTF-16 units is surprising for emoji.

## 6. Frontend framework and build

- **Decision**: React 19 with Vite 7, plain CSS (CSS custom properties, mobile-first). No component library.
- **Rationale**: This is the most widely known stack, so it's easy for future developers (maintainability). Vite gives fast dev reloads and a static production build. A handful of components doesn't justify a UI kit, and plain CSS keeps the bundle small, which helps the initial list appear within 1 s (SC-003).
- **Alternatives considered**: Svelte and Solid produce smaller bundles but have smaller hiring pools. Vanilla TypeScript makes optimistic state and rollback harder to maintain. Tailwind adds build configuration for little gain.

## 7. Client state and optimistic updates

- **Decision**: One `useTodos` hook built on `useReducer` holds the list and the load status (`loading | ready | error`). Each mutation is applied to local state straight away (optimistic), then sent to the API.
  - **On success**: replace the optimistic entry with the server's copy (the real `id` and timestamps).
  - **On failure**: undo that single change locally, show a message in an `aria-live` region, and for add, put the typed text back into the input (FR-013, US4-AS4).
  - **On 404** for toggle or delete (the todo was deleted in another tab): show "This task no longer exists", then reload the list from the server to get the true state.
  - **Rapid repeated clicks**: the toggle sends the **absolute** target state (`completed: true/false`), not "flip", so repeating it is safe (idempotent). Requests for the same item are **serialized**: at most one PATCH is in flight per item. While it's in flight, further toggles only update the desired value; when the response arrives, one more PATCH is sent if the desired value differs. This prevents out-of-order responses from leaving the UI and server disagreeing. While a delete is in flight, the item is already removed from the list, so it can't be clicked twice.
  - **Scope of rollback**: a failure undoes only the change that failed (the affected todo goes back to its last server-confirmed state). Other todos, including their own pending changes, are left alone.
- **Rationale**: Meets the "<100 ms perceived" target (SC-003) without extra libraries, and keeps rollback logic in one tested place.
- **Alternatives considered**: TanStack Query has excellent optimistic-update support but adds a dependency and concepts that aren't needed for one list. Redux is too much for this.

## 8. API style and error format

- **Decision**: A JSON REST API under `/api`: `GET /api/todos`, `POST /api/todos`, `PATCH /api/todos/:id`, `DELETE /api/todos/:id`, plus `GET /api/health`. Every error uses one envelope: `{ "error": { "code", "message", "details?" } }`, with the codes `VALIDATION_ERROR` (400), `NOT_FOUND` (404) and `INTERNAL_ERROR` (500). The server generates UUID v4 IDs. Timestamps are ISO 8601 in UTC with milliseconds.
- **Rationale**: This is the smallest well-defined CRUD surface. The single error shape satisfies "clear, consistent errors" (FR-015). A PATCH that sets `completed` explicitly makes status changes idempotent.
- **Alternatives considered**: GraphQL and tRPC couple the client to the server's technology. A `POST /:id/toggle` endpoint isn't idempotent.

## 9. Ordering

- **Decision**: Newest first: `ORDER BY created_at DESC, id DESC`. The order is always decided by the server; optimistic adds are inserted at the top.
- **Rationale**: FR-010. The `id` tiebreak makes the order fully deterministic when two todos share a millisecond.

## 10. Future owner support (FR-019)

- **Decision**: The `todos` table has `owner_id TEXT NOT NULL DEFAULT 'local'`, with an index on `(owner_id, created_at)`. Every repository method takes an `ownerId` argument. In v1, the route layer supplies it through a single `getOwnerId(request)` function that returns `'local'`.
- **Rationale**: Adding authentication later only means changing `getOwnerId` to read it from the session. No schema rewrite and no change to feature code.
- **Alternatives considered**: Leaving ownership out entirely would need a migration and an update to every query later.

## 11. Deployment shape

- **Decision**: Two workspace packages (`frontend`, `backend`) that build independently. In development: Vite dev server on :5173, which proxies `/api` to Fastify on :3000. In production: the frontend builds to static files. By default the backend serves them with `@fastify/static`, so the result is a single deployable process. The frontend can also be hosted separately by setting `VITE_API_BASE_URL`.
- **Rationale**: "Easy to understand, deploy, and extend". One process with one SQLite file is the simplest possible deployment, and it keeps the frontend/backend separation from the spec's assumptions.
- **Alternatives considered**: Docker Compose with separate containers can come later. A serverless platform isn't compatible with a local SQLite file.

## 12. Testing strategy

- **Decision**:
  - **Vitest** for unit tests: shared validation, the reducer and rollback logic, and the repository against a temporary SQLite file.
  - **Fastify `inject`** contract tests that check every endpoint against [contracts/openapi.yaml](./contracts/openapi.yaml), including error envelopes and the server-restart durability check (SC-004).
  - **React Testing Library** for component behavior and accessible roles.
  - **Playwright** end-to-end tests for each user story at 320 px and desktop viewports. They include network failure injection with `page.route` (US4) and an axe-core accessibility scan.
- **Rationale**: Each spec acceptance scenario maps to an automated test at the cheapest level that can prove it.
- **Alternatives considered**: Jest is slower and needs ESM configuration. Cypress has weaker multi-viewport and network-interception ergonomics than Playwright.

## 13. Security (FR-018)

- **Decision**: Render descriptions only as React text children; never use `dangerouslySetInnerHTML`. The server stores the raw text (no HTML escaping at rest). Add an ESLint rule that bans `dangerouslySetInnerHTML`. Set a strict `Content-Security-Policy` (`default-src 'self'`) with `@fastify/helmet`. Request body limit: 16 KB.
- **Rationale**: Escaping at output, which React does by default, is the correct layer. The CSP is defence in depth.

## 14. Creation-time display (FR-009)

- **Decision**: Show relative time for recent items ("just now", "5 min ago", "yesterday") using `Intl.RelativeTimeFormat`, and absolute dates for older ones using `Intl.DateTimeFormat` in the user's locale. The full timestamp goes in a `<time dateTime=…>` element with a `title`.
- **Rationale**: Human-readable, needs no date library, and the machine-readable value helps screen readers and tests.
