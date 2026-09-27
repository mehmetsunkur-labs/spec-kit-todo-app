CREATE TABLE todos (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL DEFAULT 'local',
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  completed   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX idx_todos_owner_created ON todos (owner_id, created_at DESC, id DESC);
