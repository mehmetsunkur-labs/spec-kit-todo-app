import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, loadEnvFile } from '../../src/config.js';

describe('loadConfig', () => {
  it('uses the documented defaults', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      databasePath: path.resolve(process.cwd(), './data/todos.db'),
      logLevel: 'info',
    });
  });

  it('reads PORT, DATABASE_PATH and LOG_LEVEL', () => {
    expect(loadConfig({ PORT: '8080', DATABASE_PATH: '/tmp/x.db', LOG_LEVEL: 'warn' })).toEqual({
      port: 8080,
      databasePath: '/tmp/x.db',
      logLevel: 'warn',
    });
  });

  it.each(['0', '70000', 'abc', '3.5'])('rejects PORT=%s', (PORT) => {
    expect(() => loadConfig({ PORT })).toThrow(/PORT must be an integer/);
  });
});

describe('loadEnvFile', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-env-'));
  const file = path.join(dir, '.env');

  afterEach(() => {
    delete process.env.TODO_TEST_FROM_FILE;
    delete process.env.TODO_TEST_PRESET;
  });

  it('does nothing when the file is missing', () => {
    expect(() => loadEnvFile(path.join(dir, 'missing.env'))).not.toThrow();
  });

  it('loads variables without overriding ones already set', () => {
    fs.writeFileSync(file, 'TODO_TEST_FROM_FILE=file\nTODO_TEST_PRESET=file\n');
    process.env.TODO_TEST_PRESET = 'environment';
    loadEnvFile(file);
    expect(process.env.TODO_TEST_FROM_FILE).toBe('file');
    expect(process.env.TODO_TEST_PRESET).toBe('environment');
  });
});
