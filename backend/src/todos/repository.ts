import type { Todo } from '@todo/shared';
import type { Database } from '../db/connection.js';

/** Storage boundary for todos. Feature code depends only on this interface (FR-019). */
export interface TodoRepository {
  /** All of the owner's todos, newest first. */
  list(ownerId: string): Todo[];
  /** `description` must already be validated. */
  create(ownerId: string, description: string): Todo;
  /** Returns null when the todo does not exist for this owner. */
  setCompleted(ownerId: string, id: string, completed: boolean): Todo | null;
  /** Returns false when the todo does not exist for this owner. */
  delete(ownerId: string, id: string): boolean;
}

interface TodoRow {
  id: string;
  description: string;
  completed: 0 | 1;
  created_at: string;
  updated_at: string;
}

function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    description: row.description,
    completed: row.completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSqliteTodoRepository(db: Database): TodoRepository {
  const listStmt = db.prepare<[string], TodoRow>(
    `SELECT id, description, completed, created_at, updated_at
       FROM todos
      WHERE owner_id = ?
      ORDER BY created_at DESC, rowid DESC`,
  );
  const insertStmt = db.prepare<[string, string, string, string, string]>(
    `INSERT INTO todos (id, owner_id, description, completed, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
  );
  const getStmt = db.prepare<[string, string], TodoRow>(
    `SELECT id, description, completed, created_at, updated_at
       FROM todos
      WHERE owner_id = ? AND id = ?`,
  );
  const setCompletedStmt = db.prepare<[number, string, string, string]>(
    'UPDATE todos SET completed = ?, updated_at = ? WHERE owner_id = ? AND id = ?',
  );
  const deleteStmt = db.prepare<[string, string]>(
    'DELETE FROM todos WHERE owner_id = ? AND id = ?',
  );

  return {
    list(ownerId) {
      return listStmt.all(ownerId).map(toTodo);
    },

    create(ownerId, description) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      insertStmt.run(id, ownerId, description, now, now);
      return { id, description, completed: false, createdAt: now, updatedAt: now };
    },

    setCompleted(ownerId, id, completed) {
      const { changes } = setCompletedStmt.run(
        completed ? 1 : 0,
        new Date().toISOString(),
        ownerId,
        id,
      );
      if (changes === 0) return null;
      const row = getStmt.get(ownerId, id);
      return row ? toTodo(row) : null;
    },

    delete(ownerId, id) {
      return deleteStmt.run(ownerId, id).changes > 0;
    },
  };
}
