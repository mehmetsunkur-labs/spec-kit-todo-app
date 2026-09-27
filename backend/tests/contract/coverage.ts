import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Shared between test workers and the global teardown that checks it (Constitution III, T075). */
export const COVERAGE_FILE = fileURLToPath(
  new URL('../../node_modules/.cache/contract-coverage.jsonl', import.meta.url),
);

/** Records that a contract test asserted `status` for `METHOD path` (path as written in openapi.yaml). */
export function covered(method: string, apiPath: string, status: number): void {
  fs.mkdirSync(path.dirname(COVERAGE_FILE), { recursive: true });
  fs.appendFileSync(
    COVERAGE_FILE,
    `${JSON.stringify(`${method.toUpperCase()} ${apiPath} ${status}`)}\n`,
  );
}
