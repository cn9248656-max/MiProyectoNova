/**
 * Comprueba que una base antigua (esquema incompleto) se actualiza conservando
 * TODAS las filas y generando una copia previa a la migración.
 * Uso: DATA_DIR=<carpeta temporal> tsx scripts/verify-legacy.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

function fail(message: string): never {
  console.error(`FALLO: ${message}`);
  process.exit(1);
}

function ok(message: string) {
  console.log(`OK   ${message}`);
}

async function main() {
  const dir = process.env.DATA_DIR;
  if (!dir) fail('falta DATA_DIR');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'novastore.db');

  // Base "antigua": solo productos con datos reales del cliente.
  const legacy = new Database(file);
  legacy.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO products (id, name, price) VALUES ('prod_real_1', 'Producto real del cliente', 1500);
    INSERT INTO products (id, name, price) VALUES ('prod_real_2', 'Segundo producto real', 2500);
  `);
  legacy.close();

  // Abrir la app dispara migración + seed.
  const { db } = await import('../lib/db');
  const { listBackups } = await import('../lib/backup');
  const conn = db();

  const rows = conn.prepare('SELECT id, name, price FROM products ORDER BY id').all() as Array<{
    id: string;
    name: string;
    price: number;
  }>;
  if (rows.length !== 2) fail(`se esperaban 2 productos reales y hay ${rows.length}`);
  if (rows[0].name !== 'Producto real del cliente') fail('el nombre del producto cambió');
  if (rows[0].price !== 1500) fail('el precio del producto cambió');
  ok('las 2 filas reales siguen intactas tras la migración (no se sembró catálogo demo)');

  const columns = conn.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'active')) fail('no se agregó la columna active');
  ok(`esquema actualizado de forma aditiva (${columns.length} columnas, ninguna eliminada)`);

  const tables = conn
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  ok(`tablas disponibles: ${tables.length}`);

  const backups = listBackups();
  const preMigration = backups.find((backup) => backup.name.includes('pre-migracion'));
  if (!preMigration) fail('no se creó la copia previa a la migración');
  if (!preMigration.healthy) fail('la copia previa a la migración no es válida');
  if (preMigration.counts?.products !== 2) fail('la copia previa no contiene los 2 productos');
  ok(`copia previa a la migración verificada: ${preMigration.name}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
