/**
 * Crea una copia de seguridad completa de la tienda sin modificar los datos.
 * Uso: npm run backup -- "motivo de la copia"
 */
import { createBackup } from '../lib/backup-db';
import { formatBytes } from '../lib/backup';

try {
  const reason = process.argv.slice(2).join(' ') || 'manual';
  const info = createBackup(reason);
  console.log(`Copia creada: ${info.name}`);
  console.log(`Tamaño: ${formatBytes(info.sizeBytes)}`);
  console.log(`Integridad SQLite: ${info.healthy ? 'correcta' : 'REVISAR'}`);
  console.log('Registros:', info.counts);
  console.log(`Guardada en: data/backups/${info.name}`);
} catch (error) {
  console.error('FALLO:', error instanceof Error ? error.message : error);
  process.exit(1);
}
