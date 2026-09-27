# Todo App Constitution

## Core Principles

### I. Simplicity & Scope Discipline

- Every feature MUST trace back to a requirement in an approved spec. Work that no spec asks for
  MUST NOT be merged.
- The simplest design that meets the spec MUST be chosen. A new dependency, service, package or
  abstraction layer MUST be justified in the plan's Complexity Tracking table.
- Out-of-scope items listed in a spec (for v1: accounts, collaboration, priorities, deadlines,
  notifications, editing, search, filters, bulk actions) MUST NOT be partly built "for later".
  Extension points are allowed only where a requirement asks for one, such as owner-scoping.

**Rationale**: The product is deliberately small. Unused features and speculative abstractions add
maintenance cost without adding user value.

### II. Contract-First, Single Source of Validation

- Every interface between frontend and backend MUST be defined in a versioned contract
  (`specs/<feature>/contracts/`) before it is implemented. The implementation MUST match the
  contract, and any change MUST update the contract in the same change.
- Validation rules for user input MUST be defined once and applied both in the UI and at the
  storage boundary. The server MUST NOT trust the client.
- Errors MUST use one consistent machine-readable format with messages that are safe to show to
  users. Internal details (stack traces, SQL) MUST NOT reach the client.

**Rationale**: One definition of each rule prevents the client and server from drifting apart, and
explicit contracts make both sides testable on their own.

### III. Tested Acceptance Criteria

- Every acceptance scenario and edge case in a spec MUST be covered by at least one automated test
  at the cheapest level that proves it (unit, contract, component or end-to-end).
- Contract tests MUST exercise every endpoint, including its error responses.
- Tests for a behavior MUST be written before or together with that behavior, and MUST fail when
  the behavior is broken. A change that breaks the test suite MUST NOT be merged.
- Bug fixes MUST include a regression test.

**Rationale**: The spec's success criteria are only credible if they're verified automatically on
every change.

### IV. Accessible, Responsive User Experience

- All core actions MUST be operable by keyboard alone and understandable with a screen reader.
  Target: WCAG 2.1 AA.
- Status and state MUST NOT be conveyed by color alone.
- The UI MUST work without horizontal scrolling from 320 px wide up to desktop, with touch targets
  of at least 44 × 44 px.
- Every view that loads or saves data MUST define its loading, empty and error states.
- End-to-end tests MUST run at both a mobile and a desktop viewport and include an automated
  accessibility scan with no serious or critical violations.

**Rationale**: Success is measured by users completing every task without guidance, on any device.

### V. Durable Data & Graceful Failure

- Every acknowledged write MUST be durable: it survives page refreshes, browser restarts and server
  restarts.
- User actions MUST give immediate feedback. If the interface updates before the server confirms,
  a failure MUST roll back to the last saved state, be reported clearly, and keep the rest of the
  app usable. User input MUST NOT be lost on a failed save.
- Data access MUST go through a single repository boundary, with queries scoped by owner, so the
  storage engine or multi-user support can change without rewriting features.

**Rationale**: Reliability across sessions is a primary success measure, and the architecture must
not block the planned move to user accounts.

## Security & Performance Standards

- User-supplied text MUST be rendered as plain text only. Unescaped HTML injection APIs are
  forbidden, and the production app MUST send a restrictive Content-Security-Policy.
- Request payload sizes MUST be bounded, and all inputs validated server-side.
- Secrets MUST NOT be committed. Configuration MUST come from environment variables with safe
  defaults.
- Performance budgets are those in the active spec's success criteria (for v1: under 100 ms
  perceived action latency, initial list within 1 s, responsive with 500 or more items). A change
  that regresses them MUST NOT be merged.
- Code MUST type-check in strict mode and pass linting with zero errors.

## Development Workflow & Quality Gates

- Work follows the Spec Kit flow: specify → (clarify) → plan → tasks → implement. Each feature lives
  on its own `###-feature-name` branch with its artifacts under `specs/###-feature-name/`.
- The plan MUST pass the Constitution Check before research, and again after design. Violations
  MUST be justified in Complexity Tracking or the design changed.
- Before merge, a change MUST pass: type-check, lint, unit, contract, component and end-to-end
  tests. It MUST also have at least one review that confirms compliance with this constitution.
- Commits SHOULD be small and focused, with messages that describe intent.
- The feature's `quickstart.md` MUST stay runnable and match the implementation.

## Governance

- This constitution overrides conflicting practices, templates and guidance in this repository.
- Amendments are made through `/speckit-constitution` in a reviewed change that includes a Sync
  Impact Report and updates to any affected artifacts.
- Versioning follows semantic versioning:
  - MAJOR: a principle is removed or redefined incompatibly.
  - MINOR: a principle or section is added, or guidance is materially expanded.
  - PATCH: clarifications and wording fixes.
- Compliance is checked in every plan's Constitution Check and in every code review. Unresolved
  violations block merge.

**Version**: 1.0.0 | **Ratified**: 2026-09-27 | **Last Amended**: 2026-09-27
