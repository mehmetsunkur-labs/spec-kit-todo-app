# UI Contract: Personal Todo App

**Feature**: `002-todo-app` | **Plan**: [../plan.md](../plan.md)

This file defines the user-facing interface that tests (React Testing Library and Playwright) rely on. Selectors use accessible roles and names, not CSS classes.

## Screen: Todo list (single page, `/`)

| Element | Role / accessible name | Behavior | Req |
|---|---|---|---|
| Page heading | `heading` level 1, "Todos" | Always visible | FR-001 |
| New task input | `textbox`, label "New task" | Single-line, `maxLength=500`. Enter submits. Keeps focus after a successful add, then is cleared | FR-002, FR-017 |
| Add button | `button`, "Add task" | Submits the form. Doesn't create anything if the input is blank | FR-002, FR-003 |
| Input validation message | text linked by `aria-describedby`, `aria-invalid=true` | Shown for blank input or >500 characters | FR-003 |
| Todo list | `list`, label "Tasks" | Items are ordered newest first | FR-010 |
| Todo item | `listitem` | Contains the checkbox, description, time and delete button | — |
| Completion toggle | `checkbox`, name = the description | Checked = completed. Space toggles it | FR-006, FR-017 |
| Description | plain text | When completed: struck through **and** muted **and** a checked box (not just color). Long words wrap (`overflow-wrap: anywhere`) | FR-008, FR-018 |
| Created time | `<time dateTime=ISO>` | Relative or absolute text, with the full timestamp in `title` | FR-009 |
| Delete button | `button`, "Delete task: {description}" | Removes the item straight away. Focus then moves to the next item, or to the input if the list is empty | FR-007, FR-017 |
| Remaining count | text "{n} of {total} remaining" | Kept up to date | — |

## States

| State | What's shown | Req |
|---|---|---|
| Loading | `status` element with the text "Loading tasks…". The list and empty state are hidden. The input is visible but disabled | FR-014 |
| Empty | "No tasks yet. Add one above to get started." | FR-014, US1-AS1 |
| Load error | `alert`: "Couldn't load your tasks." plus a `button` "Try again" that reloads the list | FR-014, US4-AS2 |
| Action error | Polite `status` region (top of the list, auto-dismisses after about 6 s, and can be closed): "Couldn't save your change. Please try again." The list reverts. For add, the typed text is restored into the input | FR-013, US4-AS3/4 |
| Not found | "This task no longer exists." and the list reloads | Edge case |

## Layout

- Mobile-first, a single column, with max content width 40rem, centered.
- No horizontal scrolling at 320 px wide or wider (FR-016).
- Touch targets are at least 44 × 44 px. Focus outlines are always visible.
- Text and control contrast meets WCAG 2.1 AA. Motion is kept to a minimum (`prefers-reduced-motion` is respected).
