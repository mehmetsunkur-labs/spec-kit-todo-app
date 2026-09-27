import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export type { Database } from 'better-sqlite3';

// Resolves to src/db/migrations in dev/tests and dist/db/migrations after `npm run build`.
const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));
const MIGRATION_FILE = /^(\d{3})_.+\.sql$/;

export function openDatabase(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number;

  const pending = fs
    .readdirSync(MIGRATIONS_DIR)
    .map((file) => ({ file, match: MIGRATION_FILE.exec(file) }))
    .filter((m): m is { file: string; match: RegExpExecArray } => m.match !== null)
    .map(({ file, match }) => ({ file, version: Number(match[1]) }))
    .filter(({ version }) => version > current)
    .sort((a, b) => a.version - b.version);

  for (const { file, version } of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    })();
  }
}
