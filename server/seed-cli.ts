import fs from 'node:fs';
import { openDb } from './db.ts';
import { ensureSeeded } from './seed.ts';

// `npm run seed -- --reset` wipes the database file and re-creates the demo data.
const file = process.env.BENCHIQ_DB ?? 'data/benchiq.db';
if (process.argv.includes('--reset')) {
  for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
  console.log(`Removed ${file}`);
}
const db = openDb(file);
ensureSeeded(db);
console.log('Seed complete. Demo login: coach@benchiq.app / hockey123');
