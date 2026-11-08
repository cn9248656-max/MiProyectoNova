/**
 * Verifica la recuperación del catálogo de NovaStore.
 *
 * 1. Una base nueva y vacía recibe los 12 productos con precio, descripción,
 *    imagen y categoría.
 * 2. Si a una base existente le faltan productos, se reponen exactamente esos,
 *    sin duplicar nombres y sin tocar clientes, pedidos ni artículos de pedido.
 * 3. Ejecutar la recuperación dos veces no duplica nada.
 *
 * Uso: npm run verify:restore
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from '../lib/db';
import { restoreMissingCatalog } from '../lib/catalog-recovery';
import { CATALOG_SNAPSHOT } from '../lib/catalog-snapshot';

let failures = 0;

function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`OK   ${label}`);
  } else {
    failures += 1;
    console.error(`FALLA ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function count(conn: Database.Database, table: string): number {
  return Number((conn.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c);
}

const expectedProducts = CATALOG_SNAPSHOT.products.length;
const expectedCategories = CATALOG_SNAPSHOT.categories.length;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-restore-'));

console.log(`Snapshot guardado: ${expectedProducts} productos, ${expectedCategories} categorías.`);
check('el catálogo guardado no está vacío', expectedProducts > 0 && expectedCategories > 0);

/* ------------------------------------------------------------------ */
/* Caso 1: base nueva y vacía                                          */
/* ------------------------------------------------------------------ */
const fresh = new Database(path.join(tmp, 'nueva.db'));
migrate(fresh);
check('la base nueva arranca sin productos', count(fresh, 'products') === 0);

const first = restoreMissingCatalog(fresh);
check('recupera todos los productos', first.productsAdded === expectedProducts, `obtenidos ${first.productsAdded}`);
check('recupera todas las categorías', first.categoriesAdded === expectedCategories, `obtenidas ${first.categoriesAdded}`);
check('quedan guardados en la base', count(fresh, 'products') === expectedProducts);
check('todas las imágenes se guardan con contenido', count(fresh, 'uploads') === expectedProducts);

const stored = fresh
  .prepare('SELECT name, description, price_cents, image_id, category_id, active FROM products')
  .all() as Array<{
  name: string;
  description: string;
  price_cents: number;
  image_id: string | null;
  category_id: string;
  active: number;
}>;

check('todos los productos quedan activos', stored.every((row) => row.active === 1));
check('todos conservan imagen', stored.every((row) => Boolean(row.image_id)));
check('todos conservan precio', stored.every((row) => row.price_cents > 0));
check('todos conservan descripción', stored.every((row) => String(row.description).length > 10));
check(
  'todos tienen una categoría existente',
  stored.every((row) => Boolean(fresh.prepare('SELECT 1 FROM categories WHERE id = ?').get(row.category_id)))
);
check(
  'los nombres coinciden con el catálogo guardado',
  expectedProducts === stored.length &&
    CATALOG_SNAPSHOT.products.every((product) => stored.some((row) => row.name === product.name))
);

const secondPass = restoreMissingCatalog(fresh);
check('una segunda pasada no duplica nada', secondPass.productsAdded === 0 && secondPass.categoriesAdded === 0);
fresh.close();

/* ------------------------------------------------------------------ */
/* Caso 2: base con clientes, pedidos y productos perdidos             */
/* ------------------------------------------------------------------ */
const legacy = new Database(path.join(tmp, 'existente.db'));
migrate(legacy);
restoreMissingCatalog(legacy);

const stamp = new Date().toISOString();
legacy
  .prepare(
    `INSERT INTO users (id, email, password_hash, name, role, balance_cents, created_at, updated_at)
     VALUES ('usr_test','cliente@nova.local','hash','Cliente de Prueba','USER',5000,?,?)`
  )
  .run(stamp, stamp);
legacy
  .prepare(
    `INSERT INTO orders (id, code, user_id, subtotal_cents, total_cents, status, payment_method, payment_status, created_at, updated_at)
     VALUES ('ord_test','NV-0001','usr_test',1099,1099,'APPROVED','BALANCE','PAID',?,?)`
  )
  .run(stamp, stamp);
legacy
  .prepare(
    `INSERT INTO order_items (id, order_id, product_id, name, price_cents, quantity)
     VALUES ('oi_test','ord_test',NULL,'Pedido anterior',1099,1)`
  )
  .run();

const lost = ['Netflix Premium 1 mes', 'Office 365 1 año'];
for (const name of lost) legacy.prepare('DELETE FROM products WHERE name = ?').run(name);

check(
  'se simula la pérdida de 2 productos',
  count(legacy, 'products') === expectedProducts - 2,
  `quedan ${count(legacy, 'products')}`
);

const repaired = restoreMissingCatalog(legacy);
check(
  'repone exactamente los productos perdidos',
  repaired.productsAdded === 2 && lost.every((name) => repaired.added.includes(name)),
  `repuestos: ${repaired.added.join(', ') || 'ninguno'}`
);
check('el catálogo vuelve a estar completo', count(legacy, 'products') === expectedProducts);

const names = legacy.prepare('SELECT name FROM products').all() as Array<{ name: string }>;
const uniqueNames = new Set(names.map((row) => row.name));
check('no se duplican productos', uniqueNames.size === names.length, `${names.length} registros`);

check('los clientes existentes siguen intactos', count(legacy, 'users') === 1);
check('los pedidos existentes siguen intactos', count(legacy, 'orders') === 1);
check('los artículos de pedido siguen intactos', count(legacy, 'order_items') === 1);

const recovered = legacy
  .prepare('SELECT name, price_cents, description, image_id, category_id FROM products WHERE name = ?')
  .get('Netflix Premium 1 mes') as
  | { name: string; price_cents: number; description: string; image_id: string | null; category_id: string }
  | undefined;

check('el producto repuesto conserva precio, descripción, imagen y categoría', Boolean(
  recovered &&
    recovered.price_cents === 599 &&
    recovered.description.length > 10 &&
    recovered.image_id &&
    recovered.category_id
));
legacy.close();

/* ------------------------------------------------------------------ */
fs.rmSync(tmp, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\nVERIFICACIÓN FALLIDA: ${failures} comprobaciones no pasaron.`);
  process.exit(1);
}
console.log('\nVERIFICACIÓN COMPLETA: el catálogo se recupera sin borrar ni duplicar datos.');
