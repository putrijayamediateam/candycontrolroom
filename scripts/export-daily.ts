import { writeFileSync } from 'node:fs';
import { createPool } from '../src/server/db/pool.js';
import { dailyPrList, toCsv } from '../src/server/core/reports.js';
import { myDate } from '../src/shared/time.js';
const db = createPool(); const day = process.argv[2] ?? myDate();
const rows = await dailyPrList(db, day);
const out = process.argv[3] ?? `daily-pr-${day}.csv`;
writeFileSync(out, toCsv(rows)); console.log(`${rows.length} rows -> ${out}`); await db.end();
