# Implementation Plan: Personal Todo App

**Branch**: `002-todo-app` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-todo-app/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build a minimal full-stack todo app for one user. The user can add, view, complete or uncomplete, and delete tasks. Tasks persist across refreshes and restarts, and the app has clear loading, empty and error states on desktop and mobile.

Technical approach:
- **Language**: a TypeScript monorepo using npm workspaces.
- **Backend**: a Fastify REST API (`/api/todos`) that persists to SQLite behind a repository interface. Every query is already scoped by owner, so accounts can be added later.
- **Frontend**: a React + Vite single-page app that updates optimistically and rolls back on failure.
- **Shared package**: one validation schema used by both sides (see [research.md](./research.md)).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on Node.js 24 LTS

**Primary Dependencies**:
- Backend: Fastify 5, `@fastify/static`, `@fastify/helmet`, better-sqlite3
- Frontend: React 19, Vite 7
- Shared: Zod

**Storage**: SQLite in a single file (WAL mode). Migrations are plain SQL files tracked by `PRAGMA user_version`.

**Testing**:
- Vitest for unit and component tests, with React Testing Library for components
- Fastify `inject` for contract tests
- Playwright and `@axe-core/playwright` for end-to-end and accessibility tests

**Target Platform**: A Linux or any Node 24 server. Current evergreen desktop and mobile browsers.

**Project Type**: Web application (frontend and backend, plus a shared package)

**Performance Goals**:
- Perceived action latency under 100 ms, through optimistic UI
- Initial list shown within 1 s
- API p95 under 50 ms locally with 500 todos

**Constraints**:
- Usable at 320 px wide with no horizontal scroll
- Keyboard and screen-reader operable (WCAG 2.1 AA)
- User text is never rendered as HTML
- Request bodies are limited to 16 KB
- No offline support

**Scale/Scope**: One implicit user per deployment. At least 500 todos stay responsive. One screen, 4 API operations plus a health check.

All items are resolved; none are marked NEEDS CLARIFICATION.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against [constitution v1.0.0](../../.specify/memory/constitution.md), ratified 2026-09-27.

| Rule | How this plan complies | Status |
|---|---|---|
| **I. Simplicity & Scope Discipline**: work traces to the spec | Every source module maps to FRs (see Requirement Traceability). No features beyond the spec | ✅ |
| I. Simplest design; dependencies justified | 3 small packages, one deployable process. No ORM, state library or UI kit. Each runtime dependency is justified in Complexity Tracking below | ✅ |
| I. No partial out-of-scope work | Contracts have no auth, editing, filters, priorities or deadlines. The only extension point is owner-scoping, which FR-019 asks for. "Future extension" in data-model.md is notes only, not code | ✅ |
| **II. Contract-First, Single Source of Validation**: contracts before code | [openapi.yaml](./contracts/openapi.yaml) and [ui-contract.md](./contracts/ui-contract.md) are written in Phase 1, before tasks | ✅ |
| II. Validation defined once, applied in UI and storage | Zod schema in `shared/src/todo.ts`, used by `TodoForm` and `routes.ts`, with DB `CHECK` constraints as a backstop | ✅ |
| II. One error format, no internal details leaked | `{ error: { code, message, details? } }`. The 500 response returns a generic message and details are only logged | ✅ |
| **III. Tested Acceptance Criteria**: every scenario and edge case tested | Test levels are mapped in [research.md §12](./research.md). One Playwright suite per user story, plus `edge-cases` | ✅ |
| III. Contract tests cover every endpoint and its errors | `backend/tests/contract/` covers every operation and every documented response in openapi.yaml | ✅ |
| III. Tests written first or alongside; regression tests for bugs | Enforced when tasks are generated and in review: each task includes its tests | ✅ |
| **IV. Accessible, Responsive UX**: keyboard and screen reader, WCAG 2.1 AA | Native checkbox and button, labelled input, `aria-live` status, focus management (ui-contract) | ✅ |
| IV. Not color alone; 320 px; 44 px touch targets | Completed = strike-through + muted + checked box. Mobile-first single column | ✅ |
| IV. Loading, empty and error states defined | The States table in ui-contract.md | ✅ |
| IV. E2E tests at mobile and desktop plus an axe scan | Playwright projects `mobile-320` and `desktop-1280`, plus `a11y` with `@axe-core/playwright` | ✅ |
| **V. Durable Data & Graceful Failure**: acknowledged writes are durable | SQLite in WAL mode. The server responds only after the commit. A restart integration test covers this (SC-004) | ✅ |
| V. Optimistic updates roll back; input never lost | `useTodos` reducer ([research.md §7](./research.md)); US4 acceptance scenarios 3 and 4 | ✅ |
| V. Single repository boundary scoped by owner | `TodoRepository(ownerId, …)` and `getOwnerId()` ([data-model.md](./data-model.md)) | ✅ |
| **Security**: plain-text rendering, CSP, bounded payloads, server-side validation | React text nodes, ESLint ban on `dangerouslySetInnerHTML`, `@fastify/helmet` CSP, 16 KB body limit | ✅ |
| Security: no secrets; configuration from the environment | `backend/.env.example` with safe defaults; `.env` is git-ignored | ✅ |
| **Performance**: budgets must not regress | `e2e/tests/perf` seeds 500 todos and asserts the SC-003 targets (under 100 ms after each action, list within 1 s) | ✅ |
| Strict type-checking and zero lint errors | `tsconfig.base.json` has `strict: true`. `npm run lint` runs ESLint and `tsc --noEmit` | ✅ |
| **Workflow**: branch, artifacts, quality gates, runnable quickstart | Branch `002-todo-app`. Artifacts in `specs/002-todo-app/`. The quickstart's `lint`, `test` and `test:e2e` scripts are the merge gate | ✅ |

**Pre-research gate**: ✅ Passes.

**Post-design re-check (after Phase 1)**: ✅ Passes. The contracts and data model stay within the spec's scope. There are no violations. The runtime dependencies are recorded in Complexity Tracking, as Principle I requires.

## Project Structure

### Documentation (this feature)

```text
specs/002-todo-app/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── openapi.yaml     # REST API contract
│   └── ui-contract.md   # Accessible UI elements and states
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
package.json                 # npm workspaces root; dev/build/test/lint scripts
tsconfig.base.json
eslint.config.js

shared/
└── src/
    ├── todo.ts              # Zod description schema, Todo and API types, error codes
    └── index.ts

backend/
├── src/
│   ├── server.ts            # entry point: config, listen, graceful shutdown
│   ├── app.ts               # buildApp(): plugins, error handler, routes, static files
│   ├── config.ts
│   ├── db/
│   │   ├── connection.ts    # open SQLite, pragmas, run migrations
│   │   └── migrations/001_create_todos.sql
│   ├── todos/
│   │   ├── repository.ts    # TodoRepository interface and SQLite implementation
│   │   ├── routes.ts        # /api/todos handlers
│   │   └── owner.ts         # getOwnerId(request) → 'local' (FR-019 seam)
│   └── errors.ts            # AppError, error envelope mapping
├── scripts/seed.ts
└── tests/
    ├── contract/            # every endpoint vs contracts/openapi.yaml
    ├── integration/         # persistence across app restarts (SC-004)
    └── unit/                # repository against a temporary DB

frontend/
├── index.html
├── vite.config.ts           # /api proxy to :3000
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/client.ts        # fetch wrapper; parses the error envelope
│   ├── state/useTodos.ts    # reducer, optimistic updates, rollback
│   ├── components/          # TodoForm, TodoList, TodoItem, StatusBanner, LoadState
│   ├── lib/formatTime.ts
│   └── styles.css
└── tests/                   # reducer unit tests and RTL component tests

e2e/
├── playwright.config.ts     # projects: mobile-320, desktop-1280
└── tests/                   # us1-capture, us2-complete, us3-delete, us4-errors, edge-cases, a11y, perf
```

**Structure Decision**: This is a web application, laid out as npm workspaces:
- `shared/` holds validation and types, used by both sides (FR-015).
- `backend/` is the Fastify API with SQLite.
- `frontend/` is the React SPA.
- `e2e/` holds the Playwright suites that span both.

In production, the backend serves the built frontend, so there is one process and one database file to deploy.

## Requirement Traceability

| Requirement | Where it's handled |
|---|---|
| FR-001, FR-014 | `useTodos` load status and `LoadState`; `GET /api/todos` |
| FR-002, FR-003, FR-005, FR-015 | `shared/todo.ts` schema, used in `TodoForm` and `routes.ts`; DB `CHECK` constraints |
| FR-004, FR-009, FR-010 | [data-model.md](./data-model.md); `formatTime.ts`; `ORDER BY created_at DESC, id DESC` |
| FR-006, FR-007 | `PATCH` and `DELETE` in [openapi.yaml](./contracts/openapi.yaml) |
| FR-008, FR-016, FR-017 | [ui-contract.md](./contracts/ui-contract.md); `styles.css`; Playwright at 320 px and axe scans |
| FR-011 | SQLite WAL; restart integration test |
| FR-012, FR-013 | Optimistic reducer with rollback and the status banner ([research.md §7](./research.md)) |
| FR-018 | React text rendering; ESLint ban on `dangerouslySetInnerHTML`; CSP |
| FR-019 | `owner_id` column, `TodoRepository(ownerId, …)`, `getOwnerId()` |
| SC-003, SC-007 | `e2e/tests/perf`: timings for actions and initial load with 500 seeded todos |

## Complexity Tracking

There are no constitution violations. Principle I requires every new dependency to be justified, so each one is listed here. Full comparisons are in [research.md](./research.md).

| Dependency | Why it's needed | Simpler alternative rejected because |
|---|---|---|
| Fastify (+ `@fastify/static`, `@fastify/helmet`) | HTTP API with schema validation, logging and in-process test injection. Serves the built frontend. Sets the CSP | Plain `node:http` means hand-writing routing, body limits, error mapping and security headers (§2, §13) |
| better-sqlite3 | Durable, file-based storage with no separate service (Principle V) | `node:sqlite` is not yet stable. A JSON file has no atomic writes (§3) |
| Zod | One validation schema shared by UI and server (Principle II) | Hand-written checks in two places would drift apart (§4) |
| React + Vite | A well-known UI library and fast build, which suits maintainability | Vanilla DOM code makes optimistic state and rollback harder to maintain (§6) |
| Vitest, React Testing Library, Playwright, axe-core (dev only) | Required test levels and scans (Principles III and IV) | No lighter set covers component, multi-viewport end-to-end and accessibility checks (§12) |
