/**
 * Exporta el catálogo real guardado en la base de datos a un archivo TypeScript
 * versionado en Git (lib/catalog-snapshot.ts).
 *
 * Sirve para que ningún despliegue pueda dejar la tienda sin sus productos: si
 * la base arranca vacía o incompleta, la aplicación repone los productos que
 * falten desde este snapshot (ver lib/catalog-recovery.ts).
 *
 * Uso: npm run snapshot:catalogo
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DB_FILE } from '../lib/paths';

type Row = Record<string, unknown>;

const OUTPUT = path.join(process.cwd(), 'lib', 'catalog-snapshot.ts');

function main() {
  if (!fs.existsSync(DB_FILE)) {
    console.error(`No existe la base de datos en ${DB_FILE}`);
    process.exit(1);
  }

  const conn = new Database(DB_FILE, { readonly: true, fileMustExist: true });

  const categories = (
    conn.prepare('SELECT name, slug, icon, position FROM categories ORDER BY position, name').all() as Row[]
  ).map((row) => ({
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    icon: String(row.icon ?? '✦'),
    position: Number(row.position ?? 0),
  }));

  const rows = conn
    .prepare(
      `SELECT p.id, p.name, p.description, p.price_cents, p.stock, p.unlimited_stock, p.featured, p.image_id, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.created_at, p.name`
    )
    .all() as Row[];

  const imageStmt = conn.prepare('SELECT mime, data FROM uploads WHERE id = ?');

  const products = rows.map((row) => {
    let image: { mime: string; base64: string } | null = null;
    if (row.image_id) {
      const upload = imageStmt.get(String(row.image_id)) as Row | undefined;
      if (upload && upload.data) {
        image = {
          mime: String(upload.mime ?? 'image/svg+xml'),
          base64: Buffer.from(upload.data as Buffer).toString('base64'),
        };
      }
    }
    return {
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      priceCents: Number(row.price_cents ?? 0),
      stock: Number(row.stock ?? 0),
      unlimitedStock: Number(row.unlimited_stock ?? 0) === 1,
      featured: Number(row.featured ?? 0) === 1,
      categorySlug: row.category_slug ? String(row.category_slug) : '',
      image,
    };
  });

  conn.close();

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'data/novastore.db',
    categories,
    products,
  };

  const file = `/**
 * Catálogo real de NovaStore exportado por scripts/snapshot-catalog.ts.
 * Se versiona en Git para que ningún despliegue pueda dejar la tienda sin
 * productos: la aplicación repone los que falten (nunca borra ni sobrescribe).
 *
 * Regenerar con: npm run snapshot:catalogo
 */

export type SnapshotImage = { mime: string; base64: string };

export type SnapshotProduct = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  unlimitedStock?: boolean;
  featured: boolean;
  categorySlug: string;
  image: SnapshotImage | null;
};

export type SnapshotCategory = { name: string; slug: string; icon: string; position: number };

export type CatalogSnapshot = {
  generatedAt: string;
  source: string;
  categories: SnapshotCategory[];
  products: SnapshotProduct[];
};

export const CATALOG_SNAPSHOT: CatalogSnapshot = ${JSON.stringify(payload, null, 2)};
`;

  fs.writeFileSync(OUTPUT, file, 'utf8');
  const withImage = products.filter((product) => product.image).length;
  console.log(
    `Snapshot guardado en lib/catalog-snapshot.ts: ${products.length} productos, ` +
      `${categories.length} categorías, ${withImage} imágenes incluidas.`
  );
}

main();
