/**
 * Motor de sincronización NovaStore ⇄ Supabase.
 *
 * Estrategia:
 *   - La base SQLite local sigue siendo la caché rápida de lectura.
 *   - Cada escritura local marca su tabla como "pendiente" mediante triggers.
 *   - Un bucle cada 2 s envía a Supabase solo lo pendiente (upserts y borrados).
 *   - Al arrancar un contenedor nuevo se RESTAURA todo desde Supabase antes de
 *     sembrar datos de demostración, de modo que publicar o reiniciar no borra
 *     usuarios, conversaciones, configuraciones, pedidos ni comprobantes.
 *   - Al apagar (SIGTERM) se fuerza un último envío.
 */

import type { Database as BetterSqlite3 } from 'better-sqlite3';
import { SYNC_TABLES, SYNC_ORDER } from './supabase-schema';
import {
  deleteOp,
  runOps,
  runOpsSync,
  selectOp,
  syncEnabled,
  syncStatus,
  upsertOp,
  type RemoteOp,
  type RemoteResult,
} from './supabase-db';

type Conn = BetterSqlite3;

export interface SyncReport {
  ok: boolean;
  tables: Record<string, number>;
  errors: string[];
}

interface PendingRow {
  table: string;
  markedAt: string;
}

interface PendingDelete extends PendingRow {
  key: string;
}

interface Pending {
  dirty: PendingRow[];
  deletes: PendingDelete[];
}

const PUSH_INTERVAL_MS = 2000;
const DEFAULT_CHUNK = 200;
const CHUNK_BY_TABLE: Record<string, number> = { uploads: 20 };

function chunkSize(table: string): number {
  return CHUNK_BY_TABLE[table] ?? DEFAULT_CHUNK;
}

function nowStamp(): string {
  return new Date().toISOString();
}

/** Crea las tablas y triggers de control. Nunca toca datos de negocio. */
export function ensureSyncSchema(conn: Conn): void {
  conn.exec(`
    create table if not exists sync_dirty (
      table_name text primary key,
      marked_at  text not null
    );
    create table if not exists sync_deleted (
      table_name text not null,
      row_key    text not null,
      marked_at  text not null,
      primary key (table_name, row_key)
    );
  `);

  const existingTables = new Set(
    (conn.prepare("select name from sqlite_master where type = 'table'").all() as Array<{ name: string }>).map(
      (row) => row.name
    )
  );
  const existingTriggers = new Set(
    (conn.prepare("select name from sqlite_master where type = 'trigger'").all() as Array<{ name: string }>).map(
      (row) => row.name
    )
  );

  for (const [table, spec] of Object.entries(SYNC_TABLES)) {
    // Una tabla que aún no existe (p. ej. soporte antes de su primer uso) no
    // puede tener triggers: se omite y se activará en cuanto exista.
    if (!existingTables.has(table)) continue;
    const pk = spec.pk.replace(/"/g, '""');
    conn.exec(`
      create trigger if not exists ${table}_sync_ins after insert on "${table}" begin
        insert into sync_dirty (table_name, marked_at) values ('${table}', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        on conflict (table_name) do update set marked_at = excluded.marked_at;
      end;
      create trigger if not exists ${table}_sync_upd after update on "${table}" begin
        insert into sync_dirty (table_name, marked_at) values ('${table}', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        on conflict (table_name) do update set marked_at = excluded.marked_at;
      end;
      create trigger if not exists ${table}_sync_del after delete on "${table}" begin
        insert into sync_deleted (table_name, row_key, marked_at)
        values ('${table}', cast(old."${pk}" as text), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        on conflict (table_name, row_key) do update set marked_at = excluded.marked_at;
        insert into sync_dirty (table_name, marked_at) values ('${table}', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        on conflict (table_name) do update set marked_at = excluded.marked_at;
      end;
    `);

    // Si la tabla se acaba de activar, se sube completa una vez: así ninguna
    // fila creada antes del trigger queda fuera de Supabase.
    if (!existingTriggers.has(`${table}_sync_ins`)) {
      conn
        .prepare(
          `insert into sync_dirty (table_name, marked_at)
           values (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           on conflict (table_name) do update set marked_at = excluded.marked_at`
        )
        .run(table);
    }
  }
}

const columnCache = new Map<string, string[]>();

/** Columnas que existen de verdad en la tabla local (nunca inventa ninguna). */
function realColumns(conn: Conn, table: string): string[] {
  const cached = columnCache.get(table);
  if (cached) return cached;
  try {
    const names = (conn.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(
      (row) => row.name
    );
    if (names.length > 0) columnCache.set(table, names);
    return names;
  } catch {
    return [];
  }
}

function specColumns(conn: Conn, table: string): Array<{ name: string; hex?: boolean }> {
  const real = new Set(realColumns(conn, table));
  return SYNC_TABLES[table].columns.filter((column) => real.has(column.name));
}

function readRows(conn: Conn, table: string): Array<Record<string, unknown>> {
  const columns = specColumns(conn, table);
  if (columns.length === 0) return [];
  const columnList = columns.map((column) => `"${column.name}"`).join(', ');
  const rows = conn.prepare(`select ${columnList} from "${table}"`).all() as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const payload: Record<string, unknown> = {};
    for (const column of columns) {
      const value = row[column.name];
      if (value === null || value === undefined) {
        payload[column.name] = null;
      } else if (column.hex) {
        payload[column.name] = Buffer.isBuffer(value) ? value.toString('hex') : String(value);
      } else if (typeof value === 'bigint') {
        payload[column.name] = Number(value);
      } else {
        payload[column.name] = value;
      }
    }
    return payload;
  });
}

function normalizeValue(column: { hex?: boolean }, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (column.hex) {
    if (typeof value === 'string') return Buffer.from(value, 'hex');
    return value;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function applyRows(conn: Conn, table: string, rows: Array<Record<string, unknown>>): number {
  if (rows.length === 0) return 0;
  const spec = SYNC_TABLES[table];
  const columns = specColumns(conn, table);
  if (columns.length === 0) return 0;
  const quoted = columns.map((column) => `"${column.name}"`).join(', ');
  const placeholders = columns.map((_, index) => `@v${index}`).join(', ');
  const updates = columns
    .filter((column) => column.name !== spec.pk)
    .map((column) => `"${column.name}" = excluded."${column.name}"`)
    .join(', ');
  const sql = `insert into "${table}" (${quoted}) values (${placeholders}) on conflict ("${spec.pk}") do update set ${updates}`;
  const statement = conn.prepare(sql);

  let applied = 0;
  const run = conn.transaction((batch: Array<Record<string, unknown>>) => {
    for (const row of batch) {
      const values: Record<string, unknown> = {};
      columns.forEach((column, index) => {
        values[`v${index}`] = normalizeValue(column, row[column.name]);
      });
      try {
        statement.run(values);
        applied += 1;
      } catch {
        // Una fila incompatible no debe impedir restaurar el resto.
      }
    }
  });
  run(rows);
  return applied;
}

function collectPending(conn: Conn): Pending {
  const dirty = conn
    .prepare('select table_name as table, marked_at as markedAt from sync_dirty')
    .all() as PendingRow[];
  const deletes = conn
    .prepare('select table_name as table, row_key as key, marked_at as markedAt from sync_deleted')
    .all() as PendingDelete[];
  return {
    dirty: dirty.filter((row) => Boolean(SYNC_TABLES[row.table])),
    deletes: deletes.filter((row) => Boolean(SYNC_TABLES[row.table])),
  };
}

function clearPending(conn: Conn, pending: Pending): void {
  const dirtyStmt = conn.prepare('delete from sync_dirty where table_name = ? and marked_at <= ?');
  const deleteStmt = conn.prepare('delete from sync_deleted where table_name = ? and row_key = ? and marked_at <= ?');
  const run = conn.transaction(() => {
    for (const row of pending.dirty) dirtyStmt.run(row.table, row.markedAt);
    for (const row of pending.deletes) deleteStmt.run(row.table, row.key, row.markedAt);
  });
  run();
}

function clearAllMarkers(conn: Conn): void {
  conn.exec('delete from sync_dirty; delete from sync_deleted;');
}

function buildPushOps(conn: Conn, pending: Pending): { ops: RemoteOp[]; tables: string[] } {
  const ops: RemoteOp[] = [];
  const tables = new Set<string>();

  const deletesByTable = new Map<string, string[]>();
  for (const row of pending.deletes) {
    const list = deletesByTable.get(row.table) ?? [];
    list.push(row.key);
    deletesByTable.set(row.table, list);
  }
  for (const [table, keys] of deletesByTable) {
    for (let index = 0; index < keys.length; index += DEFAULT_CHUNK) {
      ops.push(deleteOp(table, keys.slice(index, index + DEFAULT_CHUNK)));
    }
    tables.add(table);
  }

  const dirtyTables = new Set(pending.dirty.map((row) => row.table));
  for (const table of SYNC_ORDER) {
    if (!dirtyTables.has(table)) continue;
    const rows = readRows(conn, table);
    const size = chunkSize(table);
    for (let index = 0; index < rows.length; index += size) {
      ops.push(upsertOp(table, rows.slice(index, index + size)));
    }
    tables.add(table);
  }

  return { ops, tables: [...tables] };
}

function describeFailure(result: RemoteResult): string {
  const data = result.data as { message?: string; hint?: string } | string | null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (data && typeof data === 'object' && data.message) return String(data.message).slice(0, 200);
  return result.error ?? `HTTP ${result.status}`;
}

/** Envía a Supabase todo lo pendiente (versión asíncrona, para el bucle). */
export async function pushPending(conn: Conn): Promise<SyncReport> {
  const report: SyncReport = { ok: true, tables: {}, errors: [] };
  if (!syncEnabled()) {
    report.ok = false;
    report.errors.push('sincronización no configurada');
    return report;
  }

  // Detecta tablas creadas después del arranque (por ejemplo soporte).
  ensureSyncSchema(conn);

  const pending = collectPending(conn);
  if (pending.dirty.length === 0 && pending.deletes.length === 0) return report;

  const { ops, tables } = buildPushOps(conn, pending);
  const results = await runOps(ops);

  let failed = false;
  results.forEach((result) => {
    if (!result.ok) {
      failed = true;
      report.errors.push(describeFailure(result));
    }
  });

  if (!failed) {
    for (const table of tables) {
      report.tables[table] = readRows(conn, table).length;
    }
    clearPending(conn, pending);
  } else {
    report.ok = false;
  }
  return report;
}

/** Envía lo pendiente de forma bloqueante (apagado del servidor). */
export function pushPendingSync(conn: Conn): SyncReport {
  const report: SyncReport = { ok: true, tables: {}, errors: [] };
  if (!syncEnabled()) return report;

  const pending = collectPending(conn);
  if (pending.dirty.length === 0 && pending.deletes.length === 0) return report;

  const { ops, tables } = buildPushOps(conn, pending);
  const results = runOpsSync(ops, 8000);

  let failed = false;
  results.forEach((result) => {
    if (!result.ok) {
      failed = true;
      report.errors.push(describeFailure(result));
    }
  });

  if (!failed) {
    for (const table of tables) report.tables[table] = 1;
    clearPending(conn, pending);
  } else {
    report.ok = false;
  }
  return report;
}

/**
 * Restaura desde Supabase. Se llama al arrancar, antes de sembrar datos demo:
 * si el remoto tiene información, la local queda igual que la remota.
 */
export function pullAllSync(conn: Conn): SyncReport {
  const report: SyncReport = { ok: true, tables: {}, errors: [] };
  if (!syncEnabled()) {
    report.ok = false;
    report.errors.push('sincronización no configurada');
    return report;
  }

  const ops = SYNC_ORDER.map((table) => selectOp(table));
  const results = runOpsSync(ops, 25000);

  let anyOk = false;
  results.forEach((result, index) => {
    const table = SYNC_ORDER[index];
    if (!result.ok) {
      report.ok = false;
      report.errors.push(`${table}: ${describeFailure(result)}`);
      return;
    }
    anyOk = true;
    const rows = Array.isArray(result.data) ? (result.data as Array<Record<string, unknown>>) : [];
    report.tables[table] = applyRows(conn, table, rows);
  });

  if (anyOk) clearAllMarkers(conn);
  return report;
}

/** Estado para diagnóstico (no expone claves). */
export function syncSummary(conn: Conn): {
  enabled: boolean;
  mode: string;
  url: string | null;
  pendingTables: string[];
  pendingDeletes: number;
  lastPush: string | null;
  lastError: string | null;
} {
  const status = syncStatus();
  let pendingTables: string[] = [];
  let pendingDeletes = 0;
  try {
    pendingTables = (conn.prepare('select table_name from sync_dirty').all() as Array<{ table_name: string }>).map(
      (row) => row.table_name
    );
    pendingDeletes = (conn.prepare('select count(*) as total from sync_deleted').get() as { total: number }).total;
  } catch {
    pendingTables = [];
    pendingDeletes = 0;
  }
  return {
    enabled: status.enabled,
    mode: status.mode,
    url: status.url,
    pendingTables,
    pendingDeletes,
    lastPush: lastPushAt,
    lastError: lastError,
  };
}

let lastPushAt: string | null = null;
let lastError: string | null = null;
let timer: NodeJS.Timeout | null = null;
let running = false;

/** Arranca el bucle de envío periódico. Idempotente. */
export function startSyncLoop(conn: Conn): void {
  if (timer || !syncEnabled()) return;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    void pushPending(conn)
      .then((report) => {
        if (report.ok && Object.keys(report.tables).length > 0) {
          lastPushAt = nowStamp();
          lastError = null;
        } else if (!report.ok) {
          lastError = report.errors.join(' · ').slice(0, 400);
        }
      })
      .catch((error: unknown) => {
        lastError = String((error as Error)?.message ?? error).slice(0, 400);
      })
      .finally(() => {
        running = false;
      });
  }, PUSH_INTERVAL_MS);
  timer.unref?.();
}

export function stopSyncLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
