import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { FastifyInstance } from 'fastify';
import { expect } from 'vitest';
import { parse } from 'yaml';
import { buildApp } from '../src/app.js';
import { openDatabase, type Database } from '../src/db/connection.js';

const OPENAPI_PATH = fileURLToPath(
  new URL('../../specs/002-todo-app/contracts/openapi.yaml', import.meta.url),
);

export interface TestApp {
  app: FastifyInstance;
  db: Database;
  dbPath: string;
  /** Closes the app and database and removes the temporary directory. */
  close(): Promise<void>;
}

async function start(dbPath: string, dir: string, removeDir: boolean): Promise<TestApp> {
  const db = openDatabase(dbPath);
  const app = buildApp({ db, logger: false });
  await app.ready();
  return {
    app,
    db,
    dbPath,
    async close() {
      await app.close();
      db.close();
      if (removeDir) fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function createTestApp(): Promise<TestApp> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-test-'));
  return start(path.join(dir, 'todos.db'), dir, true);
}

/** Starts a fresh app against an existing database file, simulating a server restart. */
export async function reopenTestApp(dbPath: string): Promise<TestApp> {
  return start(dbPath, path.dirname(dbPath), true);
}

let openApi: Record<string, unknown> | undefined;

export function loadOpenApi(): Record<string, unknown> {
  openApi ??= parse(fs.readFileSync(OPENAPI_PATH, 'utf8')) as Record<string, unknown>;
  return openApi;
}

let ajv: Ajv2020 | undefined;

function getAjv(): Ajv2020 {
  if (!ajv) {
    ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats.default(ajv);
    const doc = loadOpenApi();
    ajv.addSchema({ $id: 'openapi.json', components: doc.components });
  }
  return ajv;
}

/** Asserts that `body` matches `components.schemas[schemaName]` in the OpenAPI contract. */
export function expectMatchesSchema(body: unknown, schemaName: string): void {
  const validate = getAjv().getSchema(`openapi.json#/components/schemas/${schemaName}`);
  if (!validate) throw new Error(`Unknown schema ${schemaName}`);
  const valid = validate(body);
  expect(
    validate.errors ?? [],
    `body does not match ${schemaName}: ${JSON.stringify(body)}`,
  ).toEqual([]);
  expect(valid).toBe(true);
}
