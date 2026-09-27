import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { COVERAGE_FILE } from './coverage.js';

const OPENAPI_PATH = fileURLToPath(
  new URL('../../../specs/002-todo-app/contracts/openapi.yaml', import.meta.url),
);

interface OpenApi {
  paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
}

/** Every `METHOD path status` documented in openapi.yaml. */
function documentedResponses(): string[] {
  const doc = parse(fs.readFileSync(OPENAPI_PATH, 'utf8')) as OpenApi;
  return Object.entries(doc.paths).flatMap(([apiPath, operations]) =>
    Object.entries(operations)
      .filter(([method]) => ['get', 'post', 'patch', 'put', 'delete'].includes(method))
      .flatMap(([method, op]) =>
        Object.keys(op.responses ?? {}).map(
          (status) => `${method.toUpperCase()} ${apiPath} ${status}`,
        ),
      ),
  );
}

/**
 * Vitest global setup/teardown (Constitution III, T075). Clears recorded coverage before the run,
 * then fails the run if any documented response was never asserted by a contract test.
 * Only enforced when CHECK_CONTRACT_COVERAGE=1 (the full `npm test` run), so running a single
 * test file does not fail for coverage it was never meant to provide.
 */
export function setup(): void {
  fs.rmSync(COVERAGE_FILE, { force: true });
}

// 500 responses are documented for every operation but cannot be triggered through the public
// API without breaking the database; the error handler's 500 path is covered by errors.test.ts.
const EXEMPT = new Set(['500']);

export function teardown(): void {
  if (process.env.CHECK_CONTRACT_COVERAGE !== '1') return;

  const recorded = new Set(
    fs.existsSync(COVERAGE_FILE)
      ? fs
          .readFileSync(COVERAGE_FILE, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as string)
      : [],
  );
  const missing = documentedResponses().filter(
    (key) => !recorded.has(key) && !EXEMPT.has(key.split(' ').at(-1)!),
  );
  if (missing.length > 0) {
    throw new Error(
      `Contract coverage: no test asserts these documented responses:\n  ${missing.join('\n  ')}`,
    );
  }
  console.log(`Contract coverage: all ${recorded.size} documented responses are tested.`);
}
