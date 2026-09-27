import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.js';

const LATEST_VERSION = 2;

describe('openDatabase', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-conn-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates missing parent directories', () => {
    const dbPath = path.join(dir, 'nested', 'deeper', 'todos.db');
    const db = openDatabase(dbPath);
    db.close();
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('applies migrations once and tracks them in user_version', () => {
    const dbPath = path.join(dir, 'todos.db');

    const first = openDatabase(dbPath);
    expect(first.pragma('user_version', { simple: true })).toBe(LATEST_VERSION);
    first
      .prepare(
        "INSERT INTO todos (id, description, created_at, updated_at) VALUES ('a', 'kept', 'x', 'x')",
      )
      .run();
    first.close();

    // Re-opening must not re-run 001 (which would fail on the existing table).
    const second = openDatabase(dbPath);
    expect(second.pragma('user_version', { simple: true })).toBe(LATEST_VERSION);
    expect(second.prepare('SELECT count(*) AS n FROM todos').get()).toEqual({ n: 1 });
    second.close();
  });

  it('upgrades a database created by an earlier version without losing data', () => {
    const dbPath = path.join(dir, 'todos.db');
    // Simulate a v1 database: only migration 001 applied.
    const old = new Database(dbPath);
    old.exec(
      fs.readFileSync(
        new URL('../../src/db/migrations/001_create_todos.sql', import.meta.url),
        'utf8',
      ),
    );
    old.pragma('user_version = 1');
    old
      .prepare(
        "INSERT INTO todos (id, description, created_at, updated_at) VALUES ('a', 'kept', 'x', 'x')",
      )
      .run();
    old.close();

    const db = openDatabase(dbPath);
    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_VERSION);
    expect(db.prepare('SELECT description FROM todos').all()).toEqual([{ description: 'kept' }]);
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'todos' AND name NOT LIKE 'sqlite_%'",
      )
      .all();
    expect(indexes).toEqual([{ name: 'idx_todos_owner_created_at' }]);
    db.close();
  });

  it('enables WAL journal mode', () => {
    const db = openDatabase(path.join(dir, 'todos.db'));
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.close();
  });

  it('enforces the description CHECK constraint as a last-resort guard', () => {
    const db = openDatabase(path.join(dir, 'todos.db'));
    const insert = db.prepare(
      "INSERT INTO todos (id, description, created_at, updated_at) VALUES (?, ?, 'x', 'x')",
    );
    expect(() => insert.run('blank', '   ')).toThrow(/CHECK/);
    expect(() => insert.run('long', 'a'.repeat(501))).toThrow(/CHECK/);
    db.close();
  });
});
