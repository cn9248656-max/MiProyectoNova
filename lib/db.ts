import fs from 'node:fs';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { DATA_DIR, DB_FILE } from './paths';
import { createSnapshot, listBackups } from './backup';
import { restoreCatalogOnBoot } from './catalog-recovery';

export type DB = Database.Database;

export { DATA_DIR, DB_FILE };

declare global {
  // eslint-disable-next-line no-var
  var __novaDb: DB | undefined;
}

/**
 * Única conexión SQLite del proceso. Los datos viven en disco (DATA_DIR),
 * nunca en el navegador: cualquier dispositivo que abra la tienda ve lo mismo.
 */
export function db(): DB {
  if (global.__novaDb) return global.__novaDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const existed = fs.existsSync(DB_FILE);
  const conn = new Database(DB_FILE);
  conn.pragma('journal_mode = WAL');
  conn.pragma('synchronous = FULL');
  conn.pragma('foreign_keys = ON');
  conn.pragma('busy_timeout = 8000');
  if (existed) protectBeforeMigration(conn);
  migrate(conn);
  seed(conn);
  global.__novaDb = conn;
  // Repone los productos del catálogo guardado que falten. Solo agrega: nunca
  // borra, reemplaza ni sobrescribe datos existentes.
  try {
    restoreCatalogOnBoot(conn);
  } catch (error) {
    console.error('[nova] La recuperación del catálogo no se pudo completar:', error);
  }
  maybeAutoBackup(conn);
  return conn;
}

/** Copia automática de la tienda como máximo cada 6 horas. */
const AUTO_BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Crea una copia de seguridad automática si la última tiene más de 6 horas.
 * Se omite durante la compilación y jamás interrumpe el arranque si falla.
 */
function maybeAutoBackup(conn: DB) {
  if (process.env.NOVA_AUTO_BACKUP === '0') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  try {
    const total = Number((conn.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c);
    if (total === 0) return;
    const last = listBackups()[0];
    if (last && Date.now() - new Date(last.createdAt).getTime() < AUTO_BACKUP_INTERVAL_MS) return;
    const info = createSnapshot('automatica');
    console.log(`[nova] Copia automática creada: ${info.name} (${info.counts.products} productos).`);
  } catch (error) {
    console.error('[nova] La copia automática no se pudo crear:', error);
  }
}

/** Cierra la conexión compartida. Solo se usa al restaurar una copia de seguridad. */
export function closeDb(): void {
  const conn = global.__novaDb;
  if (!conn) return;
  try {
    conn.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    /* el checkpoint es una optimización: el cierre continúa igual */
  }
  conn.close();
  global.__novaDb = undefined;
}

const EXPECTED_TABLES = [
  'users',
  'categories',
  'uploads',
  'products',
  'cart_items',
  'orders',
  'order_items',
  'topups',
  'wallet_transactions',
  'settings',
  'product_requests',
  'notifications',
  'conversations',
  'messages',
];

const EXPECTED_COLUMNS: Array<[string, string]> = [['orders', 'customer_data']];

/** Cambios de esquema pendientes sobre una base ya existente (solo aditivos). */
function pendingChanges(conn: DB): string[] {
  const pending: string[] = [];
  const tables = new Set(
    (conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map(
      (row) => row.name
    )
  );
  for (const table of EXPECTED_TABLES) {
    if (!tables.has(table)) pending.push(`tabla ${table}`);
  }
  for (const [table, column] of EXPECTED_COLUMNS) {
    if (!tables.has(table)) continue;
    const columns = conn.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) pending.push(`columna ${table}.${column}`);
  }
  return pending;
}

/**
 * Si hay que actualizar el esquema, primero se guarda una copia completa.
 * Si la copia fallara, la actualización de esquema se detiene: los datos
 * existentes nunca se tocan sin respaldo.
 */
function protectBeforeMigration(conn: DB) {
  const pending = pendingChanges(conn);
  if (pending.length === 0) return;
  try {
    const info = createSnapshot('pre-migracion');
    console.log(`[nova] Copia previa a la migración creada: ${info.name} (${pending.join(', ')})`);
  } catch (error) {
    console.error('[nova] No se pudo crear la copia previa a la migración:', error);
    throw new Error(
      'Se canceló la actualización del esquema porque no se pudo crear la copia de seguridad previa.'
    );
  }
}

function migrate(conn: DB) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'USER',
      balance_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT '✦',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id),
      image_id TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id),
      subtotal_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PENDING',
      reference TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      quantity INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'AGORA',
      reference TEXT,
      receipt_id TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      admin_note TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      amount_cents INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      order_id TEXT,
      topup_id TEXT,
      balance_after INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      product_id TEXT,
      product_name TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_message_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      body TEXT NOT NULL,
      read_by_user INTEGER NOT NULL DEFAULT 0,
      read_by_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

  `);

  // Columnas que pudieron faltar en bases antiguas: se agregan antes de crear índices.
  ensureColumn(conn, 'products', 'description', 'TEXT');
  ensureColumn(conn, 'products', 'category_id', 'TEXT');
  ensureColumn(conn, 'products', 'price', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(conn, 'products', 'stock', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(conn, 'products', 'image_upload_id', 'TEXT');
  ensureColumn(conn, 'products', 'active', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(conn, 'products', 'featured', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(conn, 'products', 'created_at', 'TEXT');
  ensureColumn(conn, 'products', 'updated_at', 'TEXT');
  // Datos de entrega del cliente (ID de Free Fire y otros datos) por pedido.
  ensureColumn(conn, 'orders', 'customer_data', 'TEXT');

  // Los índices son optimizaciones: si una tabla antigua no tiene la columna,
  // el índice se omite y la actualización continúa sin perder registros.
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)',
    'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_topups_user ON topups(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_topups_status ON topups(status)',
    'CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)',
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_last ON conversations(last_message_at)',
  ];
  for (const statement of indexes) {
    try {
      conn.exec(statement);
    } catch (error) {
      console.warn('[nova] Índice omitido durante la migración:', statement, error);
    }
  }
}

/** Migración no destructiva: agrega la columna sólo si la base ya existente no la tiene. */
function ensureColumn(conn: DB, table: string, column: string, ddl: string) {
  const columns = conn.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((item) => item.name === column)) return;
  conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

export function id(prefix = ''): string {
  return prefix + crypto.randomBytes(9).toString('hex');
}

export function now(): string {
  return new Date().toISOString();
}

/** SVG de portada generado en el servidor: no depende de servicios externos. */
export function coverSvg(title: string, from: string, to: string, glyph: string): string {
  const safe = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const words = title.split(' ').slice(0, 3).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.75" cy="0.2" r="0.8">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="900" height="640" fill="url(#g)"/>
  <rect width="900" height="640" fill="url(#glow)"/>
  <circle cx="760" cy="110" r="170" fill="#ffffff" opacity="0.08"/>
  <circle cx="120" cy="560" r="210" fill="#000000" opacity="0.18"/>
  <text x="60" y="300" font-family="Segoe UI, Arial, sans-serif" font-size="120" opacity="0.9">${glyph}</text>
  <text x="60" y="420" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="700" fill="#ffffff">${safe}</text>
  <text x="60" y="470" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#ffffff" opacity="0.75">${words}</text>
  <text x="60" y="580" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff" opacity="0.85">NOVASTORE</text>
</svg>`;
}

function insertUpload(conn: DB, mime: string, data: Buffer): string {
  const uploadId = id('img_');
  conn
    .prepare('INSERT INTO uploads (id, mime, size, data, created_at) VALUES (?,?,?,?,?)')
    .run(uploadId, mime, data.length, data, now());
  return uploadId;
}

function seed(conn: DB) {
  const setDefault = (key: string, value: string) => {
    conn.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)').run(key, value);
  };

  setDefault('store_name', 'NovaStore');
  setDefault('currency_symbol', '$');
  setDefault('agora_alias', 'NovaStore');
  setDefault('agora_phone', '+58 412 000 0000');
  setDefault('agora_holder', 'NovaStore C.A.');
  setDefault('agora_note', 'Pago móvil / transferencia Agora. Envía el monto exacto e indica tu correo en el concepto.');
  setDefault('maintenance', '0');
  setDefault('maintenance_message', 'Estamos mejorando NovaStore. Volvemos en unos minutos.');
  setDefault('session_secret', crypto.randomBytes(32).toString('hex'));

  const seeded = conn.prepare("SELECT value FROM settings WHERE key = 'seeded_catalog'").get() as
    | { value: string }
    | undefined;
  const existingProducts = Number(
    (conn.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c
  );
  // Nunca se agregan productos de demostración si la tienda ya tiene catálogo real.
  if (seeded || existingProducts > 0) {
    if (!seeded) setDefault('seeded_catalog', now());
    return;
  }

  const categories = [
    { name: 'Juegos', slug: 'juegos', icon: '🎮', position: 1 },
    { name: 'Streaming', slug: 'streaming', icon: '🎬', position: 2 },
    { name: 'Software', slug: 'software', icon: '💻', position: 3 },
    { name: 'Servicios digitales', slug: 'servicios-digitales', icon: '⚡', position: 4 },
    { name: 'Números virtuales', slug: 'numeros-virtuales', icon: '📱', position: 5 },
  ];

  const catStmt = conn.prepare(
    'INSERT INTO categories (id, name, slug, icon, position, created_at) VALUES (?,?,?,?,?,?)'
  );
  const catIds: Record<string, string> = {};
  for (const c of categories) {
    const cid = id('cat_');
    catIds[c.slug] = cid;
    catStmt.run(cid, c.name, c.slug, c.icon, c.position, now());
  }

  const products: Array<{
    name: string;
    description: string;
    price: number;
    cat: string;
    stock: number;
    featured: boolean;
    from: string;
    to: string;
    glyph: string;
  }> = [
    {
      name: 'PlayStation Network $10',
      description: 'Tarjeta digital PSN de 10 USD para comprar juegos, DLC y suscripciones en tu cuenta de PlayStation.',
      price: 1099,
      cat: 'juegos',
      stock: 25,
      featured: true,
      from: '#1e1b4b',
      to: '#4c1d95',
      glyph: '🎮',
    },
    {
      name: 'Steam Wallet $20',
      description: 'Código Steam Wallet de 20 USD. Se entrega al aprobar el pedido, listo para canjear en tu cuenta.',
      price: 2199,
      cat: 'juegos',
      stock: 18,
      featured: false,
      from: '#0f172a',
      to: '#312e81',
      glyph: '🕹️',
    },
    {
      name: 'Robux 1.700',
      description: 'Paquete de 1.700 Robux para tu cuenta de Roblox. Entrega inmediata tras la confirmación.',
      price: 1999,
      cat: 'juegos',
      stock: 40,
      featured: false,
      from: '#2e1065',
      to: '#7c3aed',
      glyph: '🧩',
    },
    {
      name: 'Netflix Premium 1 mes',
      description: 'Acceso a Netflix Premium 4K por 30 días en un perfil privado. Incluye garantía durante todo el periodo.',
      price: 599,
      cat: 'streaming',
      stock: 30,
      featured: true,
      from: '#450a0a',
      to: '#7f1d1d',
      glyph: '🎬',
    },
    {
      name: 'Disney+ 1 mes',
      description: 'Suscripción Disney+ por un mes con catálogo completo de películas y series.',
      price: 449,
      cat: 'streaming',
      stock: 22,
      featured: false,
      from: '#0c1a3a',
      to: '#1e3a8a',
      glyph: '🏰',
    },
    {
      name: 'Spotify Premium 3 meses',
      description: 'Música sin anuncios, descargas offline y calidad alta durante 3 meses en tu propia cuenta.',
      price: 899,
      cat: 'streaming',
      stock: 26,
      featured: false,
      from: '#052e16',
      to: '#166534',
      glyph: '🎧',
    },
    {
      name: 'Office 365 1 año',
      description: 'Licencia Microsoft 365 Personal por 12 meses: Word, Excel, PowerPoint y 1 TB en OneDrive.',
      price: 2499,
      cat: 'software',
      stock: 12,
      featured: true,
      from: '#1e293b',
      to: '#0e7490',
      glyph: '💻',
    },
    {
      name: 'Antivirus Premium 1 año',
      description: 'Protección completa para 3 dispositivos durante un año, con licencia original.',
      price: 1299,
      cat: 'software',
      stock: 15,
      featured: false,
      from: '#111827',
      to: '#4338ca',
      glyph: '🛡️',
    },
    {
      name: 'Diseño de logo profesional',
      description: 'Diseño personalizado de logo con tres propuestas y archivos vectoriales listos para usar.',
      price: 1899,
      cat: 'servicios-digitales',
      stock: 10,
      featured: false,
      from: '#4a044e',
      to: '#a21caf',
      glyph: '🎨',
    },
    {
      name: 'Recarga de seguidores 1K',
      description: 'Servicio de crecimiento para redes sociales con entrega gradual y soporte durante el proceso.',
      price: 799,
      cat: 'servicios-digitales',
      stock: 35,
      featured: false,
      from: '#3b0764',
      to: '#6d28d9',
      glyph: '📈',
    },
    {
      name: 'Número virtual USA',
      description: 'Número virtual de Estados Unidos para recibir SMS de verificación. Activación inmediata.',
      price: 349,
      cat: 'numeros-virtuales',
      stock: 50,
      featured: true,
      from: '#082f49',
      to: '#0e7490',
      glyph: '📱',
    },
    {
      name: 'Número virtual WhatsApp',
      description: 'Número virtual verificado para WhatsApp, ideal para negocios y atención al cliente.',
      price: 499,
      cat: 'numeros-virtuales',
      stock: 28,
      featured: false,
      from: '#134e4a',
      to: '#0f766e',
      glyph: '💬',
    },
  ];

  const prodStmt = conn.prepare(
    `INSERT INTO products (id, name, description, price_cents, category_id, image_id, stock, active, featured, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );

  for (const p of products) {
    const imageId = insertUpload(conn, 'image/svg+xml', Buffer.from(coverSvg(p.name, p.from, p.to, p.glyph)));
    const stamp = now();
    prodStmt.run(
      id('prod_'),
      p.name,
      p.description,
      p.price,
      catIds[p.cat],
      imageId,
      p.stock,
      1,
      p.featured ? 1 : 0,
      stamp,
      stamp
    );
  }

  setDefault('seeded_catalog', now());
}
