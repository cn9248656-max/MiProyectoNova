import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { BACKUP_DIR, DB_FILE } from './paths';

/** Copias que se conservan automáticamente (las más antiguas se descartan). */
export const MAX_BACKUPS = 30;

/** Tablas que forman la tienda: productos, pedidos, clientes, recargas, comprobantes, chat. */
export const DATA_TABLES = [
  'products',
  'categories',
  'uploads',
  'users',
  'orders',
  'order_items',
  'cart_items',
  'topups',
  'wallet_transactions',
  'conversations',
  'messages',
  'product_requests',
  'notifications',
  'settings',
] as const;

/** Tablas imprescindibles para considerar una copia válida de NovaStore. */
export const REQUIRED_TABLES = ['products', 'orders', 'users', 'topups', 'settings'] as const;

export type TableCounts = Record<string, number>;

export type BackupInfo = {
  name: string;
  sizeBytes: number;
  createdAt: string;
  reason: string;
  counts: TableCounts | null;
  healthy: boolean;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function slugReason(reason: string): string {
  const clean = (reason || 'manual')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return clean || 'manual';
}

export function backupName(reason: string, date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `novastore-${stamp}-${slugReason(reason)}.db`;
}

/** Cuenta registros de cada tabla sin modificar el archivo. */
export function readCounts(file: string): TableCounts | null {
  if (!fs.existsSync(file)) return null;
  let conn: Database.Database | null = null;
  try {
    conn = new Database(file, { readonly: true, fileMustExist: true });
    const counts: TableCounts = {};
    for (const table of DATA_TABLES) {
      try {
        const row = conn.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
        counts[table] = Number(row.c);
      } catch {
        counts[table] = 0;
      }
    }
    return counts;
  } catch {
    return null;
  } finally {
    conn?.close();
  }
}

export function integrityOk(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  let conn: Database.Database | null = null;
  try {
    conn = new Database(file, { readonly: true, fileMustExist: true });
    const row = conn.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
    return row?.integrity_check === 'ok';
  } catch {
    return false;
  } finally {
    conn?.close();
  }
}

export function describeBackup(file: string): BackupInfo | null {
  try {
    const stat = fs.statSync(file);
    const name = path.basename(file);
    const match = name.match(/^novastore-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(.*)\.db$/);
    const createdAt = match
      ? new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6])
        ).toISOString()
      : stat.mtime.toISOString();
    return {
      name,
      sizeBytes: stat.size,
      createdAt,
      reason: match ? match[7].replace(/-/g, ' ') : 'manual',
      counts: readCounts(file),
      healthy: integrityOk(file),
    };
  } catch {
    return null;
  }
}

export function listBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => /^novastore-.*\.db$/.test(name))
    .map((name) => describeBackup(path.join(BACKUP_DIR, name)))
    .filter((info): info is BackupInfo => Boolean(info))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Mantiene las copias más recientes y descarta las más antiguas (solo copias). */
export function pruneBackups(keep = MAX_BACKUPS): number {
  const backups = listBackups();
  let removed = 0;
  for (const backup of backups.slice(keep)) {
    try {
      fs.rmSync(path.join(BACKUP_DIR, backup.name), { force: true });
      removed += 1;
    } catch {
      /* una copia no se pudo borrar: no afecta a los datos de la tienda */
    }
  }
  return removed;
}

/**
 * Copia consistente del archivo SQLite mediante VACUUM INTO: incluye los datos
 * confirmados que aún están en el WAL y no bloquea la tienda.
 */
export function createSnapshot(reason: string, sourceFile = DB_FILE): BackupInfo {
  if (!fs.existsSync(sourceFile)) {
    throw new Error('Todavía no existe una base de datos para copiar.');
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const target = path.join(BACKUP_DIR, backupName(reason));

  const conn = new Database(sourceFile);
  try {
    conn.pragma('busy_timeout = 8000');
    const escaped = target.replace(/'/g, "''");
    conn.exec(`VACUUM INTO '${escaped}'`);
  } finally {
    conn.close();
  }

  const info = describeBackup(target);
  if (!info || !info.healthy) {
    throw new Error('La copia se creó pero no pasó la verificación de integridad.');
  }
  pruneBackups();
  return info;
}

/** Valida un archivo de copia antes de restaurarlo. No toca la base actual. */
export function validateBackupFile(file: string): { ok: boolean; error?: string; counts?: TableCounts } {
  if (!fs.existsSync(file)) return { ok: false, error: 'El archivo de copia no existe.' };
  if (!integrityOk(file)) return { ok: false, error: 'El archivo está dañado o no es una base de datos SQLite válida.' };
  const counts = readCounts(file);
  if (!counts) return { ok: false, error: 'No se pudo leer el contenido de la copia.' };
  for (const table of REQUIRED_TABLES) {
    if (!(table in counts)) return { ok: false, error: `La copia no contiene la tabla "${table}".` };
  }
  return { ok: true, counts };
}
