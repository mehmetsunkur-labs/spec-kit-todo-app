# Data Model: Personal Todo App

**Feature**: `002-todo-app` | **Date**: 2026-09-27 | **Plan**: [plan.md](./plan.md)

## Entity: Todo

A single task the user wants to track.

| Field         | API name      | Storage column | Type                     | Rules |
|---------------|---------------|----------------|--------------------------|-------|
| Identifier    | `id`          | `id`           | UUID v4 string           | Server-generated, immutable, unique (FR-004) |
| Description   | `description` | `description`  | string                   | Trimmed. 1–500 Unicode code points. No control characters. Stored exactly as entered after trimming (FR-003, FR-018) |
| Status        | `completed`   | `completed`    | boolean (INTEGER 0/1)    | `false` on create (FR-005). Can switch both ways (FR-006) |
| Created at    | `createdAt`   | `created_at`   | ISO 8601 UTC string, ms  | Set by the server on create, immutable (FR-004, FR-009) |
| Updated at    | `updatedAt`   | `updated_at`   | ISO 8601 UTC string, ms  | Set by the server on create and on every status change |
| Owner         | *(not exposed)* | `owner_id`   | string                   | `'local'` in v1. Every repository query is scoped by it (FR-019) |

### Validation rules

These are defined once in `shared/src/todo.ts` and used by both frontend and backend (FR-015):

1. Trim leading and trailing whitespace from `description`.
2. Reject if the trimmed value is empty → `VALIDATION_ERROR`, "Please enter a task description."
3. Reject if it is longer than 500 code points → `VALIDATION_ERROR`, "Descriptions can be at most 500 characters."
4. Reject if it contains control characters (U+0000–U+001F, U+007F) → `VALIDATION_ERROR`, "Descriptions must be a single line of text."
5. `completed` in a PATCH must be a JSON boolean. Unknown body properties are rejected (`additionalProperties: false`).
6. `id` path parameters must be UUIDs. Malformed values → `VALIDATION_ERROR` (400). Well-formed IDs that don't exist → `NOT_FOUND` (404).

### State transitions

```text
          create
            │
            ▼
   ┌──────────────┐  PATCH completed=true   ┌───────────────┐
   │    Active    │ ──────────────────────▶ │   Completed   │
   │ completed=0  │ ◀────────────────────── │  completed=1  │
   └──────────────┘  PATCH completed=false  └───────────────┘
            │                                        │
            └──────────── DELETE ────────────────────┘
                              ▼
                         (removed permanently, no trash or undo)
```

- Setting `completed` to the value it already has is a successful no-op. It still returns 200 and still updates `updatedAt`, which keeps rapid repeated clicks safe.
- Delete is a hard delete.

### Ordering

The list is always returned newest first: `created_at DESC, rowid DESC` (FR-010). Ties on `created_at` (todos created in the same millisecond) are broken by insertion order, SQLite's implicit `rowid`, not by the random UUID `id`, which would shuffle them.

## Storage schema (SQLite)

Migration `001_create_todos.sql`:

```sql
CREATE TABLE todos (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL DEFAULT 'local',
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  completed   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX idx_todos_owner_created ON todos (owner_id, created_at DESC, id DESC);
```

Migration `002_order_ties_by_insertion.sql` replaces that index to match the `rowid` tiebreak:

```sql
DROP INDEX idx_todos_owner_created;
CREATE INDEX idx_todos_owner_created_at ON todos (owner_id, created_at);
```

Every SQLite index entry already ends with the `rowid`, so a reverse scan of this index serves `ORDER BY created_at DESC, rowid DESC` without a sort.

- The SQLite `CHECK` constraints are a last-resort guard. The authoritative validation is the shared schema. SQLite's `length()` counts characters, which matches code points for valid UTF-8.
- Connection pragmas: `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`.
- Migrations run in order at startup. Their progress is tracked with `PRAGMA user_version`.

## Repository interface

This is the boundary for FR-019: feature code depends only on this interface, never on SQL.

```ts
interface TodoRepository {
  list(ownerId: string): Todo[];                                        // newest first
  create(ownerId: string, description: string): Todo;                   // description already validated
  setCompleted(ownerId: string, id: string, completed: boolean): Todo | null; // null → not found
  delete(ownerId: string, id: string): boolean;                         // false → not found
}
```

## Client-side view model

The frontend adds transient state that is never sent to the server:

| Field    | Type                          | Purpose |
|----------|-------------------------------|---------|
| `status` | `'loading' \| 'ready' \| 'error'` | List-level load state (FR-014) |
| `pending`| per-item flag                 | The item has an unconfirmed optimistic change. Its controls stay usable, because the requests send absolute values and are idempotent |
| `tempId` | string (`temp-<n>`)           | Key for an optimistically added item until the server returns the real `id` |
| `notice` | `{ kind, message } \| null`    | Latest error or info message, announced through `aria-live` |

## Future extension (not in v1)

- **User accounts**: add a `users` table and a foreign key `todos.owner_id → users.id`. `getOwnerId(request)` then reads the owner from the session. No other feature code changes.
- **Editing a description**: add `description` to the PATCH body. It reuses the same validation.
