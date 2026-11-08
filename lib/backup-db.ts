import fs from 'node:fs';
import path from 'node:path';
import { db, closeDb } from './db';
import { BACKUP_DIR, DB_FILE } from './paths';
import {
  DATA_TABLES,
  createSnapshot,
  readCounts,
  validateBackupFile,
  type BackupInfo,
  type TableCounts,
} from './backup';

/** Crea una copia consistente de toda la tienda (productos, pedidos, clientes, comprobantes). */
export function createBackup(reason = 'manual'): BackupInfo {
  return createSnapshot(reason);
}

/** Registros actuales de la base real, para comprobar que nada se perdió. */
export function currentCounts(): TableCounts | null {
  return readCounts(DB_FILE);
}

/**
 * Exportación legible en JSON. Las imágenes y comprobantes binarios se incluyen
 * en la copia .db; aquí se listan sus metadatos para revisarlos con facilidad.
 */
export function exportJson(): { filename: string; json: string } {
  const conn = db();
  const payload: Record<string, unknown> = {
    store: 'NovaStore',
    exportedAt: new Date().toISOString(),
    counts: currentCounts(),
    data: {},
  };
  const data = payload.data as Record<string, unknown[]>;

  for (const table of DATA_TABLES) {
    if (table === 'uploads') {
      data.uploads = conn
        .prepare('SELECT id, mime, size, created_at FROM uploads ORDER BY created_at')
        .all();
      continue;
    }
    data[table] = conn.prepare(`SELECT * FROM ${table}`).all();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    filename: `novastore-export-${stamp}.json`,
    json: JSON.stringify(payload, null, 2),
  };
}

/**
 * Restaura una copia subida por el administrador.
 * Antes de reemplazar nada guarda una copia del estado actual; si esa copia
 * falla, la restauración se cancela para no perder información.
 */
export function restoreFromBuffer(buffer: Buffer): {
  ok: boolean;
  error?: string;
  safetyBackup?: string;
  counts?: TableCounts;
} {
  if (buffer.length === 0) return { ok: false, error: 'El archivo de copia está vacío.' };
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const temp = path.join(BACKUP_DIR, `.restore-${Date.now()}.db`);

  try {
    fs.writeFileSync(temp, buffer);
    const validation = validateBackupFile(temp);
    if (!validation.ok) return { ok: false, error: validation.error };

    let safetyBackup: string;
    try {
      safetyBackup = createSnapshot('antes-de-restaurar').name;
    } catch {
      return {
        ok: false,
        error: 'No se pudo crear la copia de seguridad previa. La restauración se canceló sin cambios.',
      };
    }

    closeDb();
    for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
      if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    }
    fs.copyFileSync(temp, DB_FILE);

    const conn = db(); // reabre y aplica solo migraciones aditivas
    const counts = currentCounts();
    const products = Number(
      (conn.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c
    );
    return { ok: true, safetyBackup, counts };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo restaurar la copia.',
    };
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
  }
}
