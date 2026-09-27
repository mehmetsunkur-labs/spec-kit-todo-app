-- Ties on created_at are broken by insertion order (rowid), not by the random UUID id,
-- so todos created in the same millisecond still list newest first (FR-010).
-- Every index entry already ends with the rowid, so (owner_id, created_at) serves
-- ORDER BY created_at DESC, rowid DESC with a reverse index scan.
DROP INDEX idx_todos_owner_created;
CREATE INDEX idx_todos_owner_created_at ON todos (owner_id, created_at);
