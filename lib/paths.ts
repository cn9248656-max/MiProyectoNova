import path from 'node:path';

/**
 * Rutas de almacenamiento. La base de datos, las imágenes y los comprobantes
 * viven en disco (DATA_DIR) y las copias de seguridad en DATA_DIR/backups.
 * Nunca se guarda información crítica solo en el navegador.
 */
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const DB_FILE = path.join(DATA_DIR, 'novastore.db');
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');
