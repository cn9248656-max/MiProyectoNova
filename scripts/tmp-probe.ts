import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from '../lib/db';
import { ensureSyncSchema, pushPending } from '../lib/supabase-sync';

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));
  const conn = new Database(path.join(dir, 'x.db'));
  conn.pragma('journal_mode = WAL');
  migrate(conn);
  ensureSyncSchema(conn);
  const stamp = new Date().toISOString();
  const steps: Array<[string, () => unknown]> = [
    ['categories', () => conn.prepare('insert into categories (id, name, slug, icon, position, created_at) values (?, ?, ?, ?, ?, ?)').run('verify-cat','C','verify-cat','x',99,stamp)],
    ['uploads', () => conn.prepare('insert into uploads (id, mime, size, data, created_at) values (?, ?, ?, ?, ?)').run('verify-upload','image/png',4,Buffer.from([137,80,78,71]),stamp)],
    ['settings', () => conn.prepare('insert into settings (key, value) values (?, ?)').run('verify-flag','ok')],
    ['support_tickets', () => conn.prepare('insert into support_tickets (id, code, user_id, subject, category, status, created_at, updated_at, last_message_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('verify-ticket','SUP-VERIFY','verify-user','S','QUESTION','PENDING',stamp,stamp,stamp)],
  ];
  for (const [name, fn] of steps) {
    try { fn(); console.log('OK', name); } catch (e) { console.log('FALLO', name, (e as Error).message); }
  }
  try {
    const r = await pushPending(conn);
    console.log('push', JSON.stringify(r).slice(0, 600));
  } catch (e) { console.log('FALLO push stack:', (e as Error).stack?.slice(0, 1500)); }
}
main();
