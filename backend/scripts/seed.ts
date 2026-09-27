// Usage: npm run seed -w backend -- [count=500]
import { loadConfig, loadEnvFile } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { getOwnerId } from '../src/todos/owner.js';
import { createSqliteTodoRepository } from '../src/todos/repository.js';

const count = Number(process.argv[2] ?? 500);
if (!Number.isInteger(count) || count < 1) {
  console.error(`Count must be a positive integer (got "${process.argv[2]}")`);
  process.exit(1);
}

loadEnvFile();
const { databasePath } = loadConfig();
const db = openDatabase(databasePath);
const repo = createSqliteTodoRepository(db);
// The seed runs outside a request, so use the same owner the API uses in v1.
const ownerId = getOwnerId(undefined as never);

db.transaction(() => {
  for (let n = 1; n <= count; n++) repo.create(ownerId, `Task #${n}`);
})();
db.close();

console.log(`Seeded ${count} todos into ${databasePath}`);
