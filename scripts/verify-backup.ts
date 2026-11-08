/**
 * Verificación de la protección de datos de NovaStore.
 * Trabaja SIEMPRE sobre una copia temporal de la base: nunca modifica la tienda real.
 * Uso: npx tsx scripts/verify-backup.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function fail(message: string): never {
  console.error(`FALLO: ${message}`);
  process.exit(1);
}

function ok(message: string) {
  console.log(`OK   ${message}`);
}

function expect(label: string, condition: boolean) {
  if (!condition) fail(label);
  ok(label);
}

async function main() {
  const realDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const realDb = path.join(realDir, 'novastore.db');
  if (!fs.existsSync(realDb)) fail(`no existe base de datos en ${realDir}`);

  // 1. Copia temporal de los datos reales (no se toca el original).
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-proteccion-'));
  fs.copyFileSync(realDb, path.join(workDir, 'novastore.db'));
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(realDb + suffix)) {
      fs.copyFileSync(realDb + suffix, path.join(workDir, 'novastore.db' + suffix));
    }
  }
  process.env.DATA_DIR = workDir;

  const backups = await import('../lib/backup-db');
  const backupLib = await import('../lib/backup');
  const store = await import('../lib/store');
  const { db } = await import('../lib/db');

  const original = backups.currentCounts();
  if (!original) fail('no se pudieron leer los registros actuales');
  ok(`datos de partida: ${original.products} productos, ${original.orders} pedidos, ${original.users} clientes`);

  // 2. Copia de seguridad verificada con integridad SQLite y mismos conteos.
  const info = backups.createBackup('verificacion-proteccion');
  expect('la copia pasa la verificación de integridad', info.healthy);
  expect(
    'la copia contiene exactamente los mismos registros',
    JSON.stringify(info.counts) === JSON.stringify(original)
  );
  ok(`copia disponible: ${info.name} (${backupLib.formatBytes(info.sizeBytes)})`);

  // 3. Exportación JSON completa.
  const exported = backups.exportJson();
  const parsed = JSON.parse(exported.json) as { data: Record<string, unknown[]> };
  expect('la exportación JSON incluye productos', Array.isArray(parsed.data.products));
  expect(
    'la exportación JSON incluye pedidos y clientes',
    Array.isArray(parsed.data.orders) && Array.isArray(parsed.data.users)
  );

  // 4. Archivar un producto no elimina registros ni pedidos.
  const firstProduct = db().prepare('SELECT id FROM products ORDER BY created_at LIMIT 1').get() as
    | { id: string }
    | undefined;
  if (!firstProduct) fail('no hay productos para probar el archivado');
  const activeBefore = Number(
    (db().prepare('SELECT COUNT(*) AS c FROM products WHERE active = 1').get() as { c: number }).c
  );
  const archived = store.archiveProduct(firstProduct.id);
  expect('archivar el producto responde correctamente', archived.ok);
  const totalAfterArchive = Number(
    (db().prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c
  );
  expect('el producto archivado sigue existiendo en la base', totalAfterArchive === original.products);
  const activeAfterArchive = Number(
    (db().prepare('SELECT COUNT(*) AS c FROM products WHERE active = 1').get() as { c: number }).c
  );
  expect('el producto archivado deja de mostrarse en la tienda', activeAfterArchive === activeBefore - 1);

  const restoredProduct = store.restoreProduct(firstProduct.id);
  expect('publicar de nuevo el producto responde correctamente', restoredProduct.ok);
  const activeAfterRestore = Number(
    (db().prepare('SELECT COUNT(*) AS c FROM products WHERE active = 1').get() as { c: number }).c
  );
  expect('el producto vuelve a estar visible', activeAfterRestore === activeBefore);

  // 5. Restaurar una copia devuelve la base a ese estado y guarda la copia previa.
  store.createCategory('Categoria temporal de verificacion', '🧪');
  const modified = backups.currentCounts();
  expect('la modificación temporal se guarda', (modified?.categories ?? 0) === (original.categories ?? 0) + 1);

  const buffer = fs.readFileSync(path.join(workDir, 'backups', info.name));
  const result = backups.restoreFromBuffer(buffer);
  if (!result.ok) fail(`la restauración falló: ${result.error}`);
  const afterRestore = backups.currentCounts();
  expect(
    'la restauración recupera los registros originales',
    (afterRestore?.categories ?? -1) === original.categories &&
      (afterRestore?.products ?? -1) === original.products
  );
  expect(
    'la modificación posterior a la copia desapareció',
    !(db()
      .prepare('SELECT id FROM categories WHERE name = ?')
      .get('Categoria temporal de verificacion') as { id: string } | undefined)
  );
  const safety = backupLib.listBackups().find((item) => item.name === result.safetyBackup);
  expect('la restauración dejó una copia del estado anterior', Boolean(safety?.healthy));

  // 6. Una base antigua se actualiza conservando sus filas y con copia previa.
  const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-legacy-'));
  execFileSync('npx', ['tsx', 'scripts/verify-legacy.ts'], {
    env: { ...process.env, DATA_DIR: legacyDir },
    stdio: 'inherit',
  });
  ok('migración compatible verificada en base antigua');

  fs.rmSync(workDir, { recursive: true, force: true });
  fs.rmSync(legacyDir, { recursive: true, force: true });
  console.log('\nVERIFICACIÓN COMPLETA: los datos existentes se conservan.');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
