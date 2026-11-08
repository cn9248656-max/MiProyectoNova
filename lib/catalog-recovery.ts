import crypto from 'node:crypto';
import { CATALOG_SNAPSHOT, type SnapshotProduct } from './catalog-snapshot';
import type { DB } from './db';

/**
 * Recuperación no destructiva del catálogo.
 *
 * Reglas:
 * - Nunca borra ni actualiza productos, pedidos, clientes, comprobantes o mensajes.
 * - Solo AGREGA lo que falta: categorías por slug y productos por id o nombre.
 * - Un producto archivado (active = 0) sigue existiendo: no se duplica ni se republica.
 * - Las imágenes del snapshot se vuelven a guardar en la tabla uploads para que
 *   el producto recuperado conserve su imagen original.
 */

export type CatalogRestoreResult = {
  categoriesAdded: number;
  productsAdded: number;
  added: string[];
};

const RESTORE_KEY = 'catalog_snapshot_restored_at';

function newId(prefix: string): string {
  return prefix + crypto.randomBytes(9).toString('hex');
}

function stamp(): string {
  return new Date().toISOString();
}

/** Compara nombres ignorando mayúsculas, acentos y espacios extra. */
export function normalizeProductName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Cuántos productos del catálogo guardado no están hoy en la base. */
export function missingCatalogProducts(conn: DB): SnapshotProduct[] {
  const rows = conn.prepare('SELECT id, name FROM products').all() as Array<{ id: string; name: string }>;
  const ids = new Set(rows.map((row) => row.id));
  const names = new Set(rows.map((row) => normalizeProductName(row.name)));
  return CATALOG_SNAPSHOT.products.filter(
    (product) => !ids.has(product.id) && !names.has(normalizeProductName(product.name))
  );
}

/**
 * Repone los productos y categorías del catálogo guardado que no existan.
 * `dryRun` calcula el resultado sin escribir nada.
 */
export function restoreMissingCatalog(conn: DB, options: { dryRun?: boolean } = {}): CatalogRestoreResult {
  const result: CatalogRestoreResult = { categoriesAdded: 0, productsAdded: 0, added: [] };
  const dryRun = options.dryRun === true;

  // --- Categorías: se buscan por slug, nunca se modifican las existentes ---
  const categories = new Map<string, string>();
  for (const row of conn.prepare('SELECT id, slug FROM categories').all() as Array<{ id: string; slug: string }>) {
    categories.set(row.slug, row.id);
  }

  const insertCategory = conn.prepare(
    'INSERT INTO categories (id, name, slug, icon, position, created_at) VALUES (?,?,?,?,?,?)'
  );

  for (const category of CATALOG_SNAPSHOT.categories) {
    if (!category.slug || categories.has(category.slug)) continue;
    const categoryId = newId('cat_');
    if (!dryRun) {
      insertCategory.run(categoryId, category.name, category.slug, category.icon, category.position, stamp());
    }
    categories.set(category.slug, categoryId);
    result.categoriesAdded += 1;
  }

  // --- Productos: solo los que no existen por id ni por nombre ---
  const missing = missingCatalogProducts(conn);
  if (missing.length === 0) return result;

  const fallbackCategory = categories.values().next().value as string | undefined;

  const insertUpload = conn.prepare(
    'INSERT INTO uploads (id, mime, size, data, created_at) VALUES (?,?,?,?,?)'
  );
  const insertProduct = conn.prepare(
    `INSERT INTO products
       (id, name, description, price_cents, category_id, image_id, stock, active, featured, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );

  for (const product of missing) {
    const categoryId = categories.get(product.categorySlug) ?? fallbackCategory;
    if (!categoryId) continue; // sin categoría válida no se puede guardar el producto

    let imageId: string | null = null;
    if (!dryRun && product.image) {
      imageId = newId('img_');
      const data = Buffer.from(product.image.base64, 'base64');
      insertUpload.run(imageId, product.image.mime, data.length, data, stamp());
    }

    if (!dryRun) {
      const now = stamp();
      insertProduct.run(
        product.id || newId('prod_'),
        product.name,
        product.description,
        product.priceCents,
        categoryId,
        imageId,
        product.stock,
        1,
        product.featured ? 1 : 0,
        now,
        now
      );
    }
    result.productsAdded += 1;
    result.added.push(product.name);
  }

  return result;
}

/** Se ejecuta al abrir la base: nunca bloquea el arranque si algo falla. */
export function restoreCatalogOnBoot(conn: DB): CatalogRestoreResult | null {
  try {
    const result = restoreMissingCatalog(conn);
    if (result.productsAdded > 0 || result.categoriesAdded > 0) {
      console.log(
        `[nova] Catálogo recuperado desde el snapshot: ${result.productsAdded} productos y ` +
          `${result.categoriesAdded} categorías. Productos repuestos: ${result.added.join(', ')}`
      );
      conn
        .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)')
        .run(RESTORE_KEY, stamp());
    }
    return result;
  } catch (error) {
    console.error('[nova] No se pudo comprobar el catálogo guardado:', error);
    return null;
  }
}

/** Información para el panel de administración. */
export function catalogSnapshotInfo(conn: DB): {
  snapshotProducts: number;
  snapshotCategories: number;
  missing: string[];
  lastRestore: string | null;
} {
  const missing = missingCatalogProducts(conn).map((product) => product.name);
  const row = conn.prepare('SELECT value FROM settings WHERE key = ?').get(RESTORE_KEY) as
    | { value: string }
    | undefined;
  return {
    snapshotProducts: CATALOG_SNAPSHOT.products.length,
    snapshotCategories: CATALOG_SNAPSHOT.categories.length,
    missing,
    lastRestore: row?.value ?? null,
  };
}
