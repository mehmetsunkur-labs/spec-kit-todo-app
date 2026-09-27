import { buildApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';
import { openDatabase } from './db/connection.js';

loadEnvFile();
const config = loadConfig();
const db = openDatabase(config.databasePath);
const app = buildApp({ db, logger: { level: config.logLevel } });

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down');
  await app.close();
  db.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  db.close();
  process.exit(1);
}
