import fs from 'node:fs';
import path from 'node:path';

export interface Config {
  port: number;
  databasePath: string;
  logLevel: string;
}

/** Loads `.env` from the working directory if present. Variables already set take precedence. */
export function loadEnvFile(file = '.env'): void {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawPort = env.PORT ?? '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535 (got "${rawPort}")`);
  }

  return {
    port,
    databasePath: path.resolve(process.cwd(), env.DATABASE_PATH ?? './data/todos.db'),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
