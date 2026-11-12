import type { DB } from './db';

/**
 * Migración compatible y no destructiva para la integración PEAKERR.
 * Solo crea tablas nuevas (IF NOT EXISTS) y agrega columnas que falten.
 * Nunca borra, renombra ni reescribe datos existentes.
 */

function columns(conn: DB, table: string): Set<string> {
  try {
    const rows = conn.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return new Set(rows.map((row) => row.name));
  } catch {
    return new Set();
  }
}

function addColumn(conn: DB, table: string, column: string, definition: string): void {
  const existing = columns(conn, table);
  if (existing.size === 0) return; // la tabla aún no existe: se creará en su propio módulo
  if (existing.has(column)) return;
  conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function ensureProviderSchema(conn: DB): void {
  /* --- Productos: vínculo con el proveedor y precios separados ---------- */
  addColumn(conn, 'products', 'provider', "TEXT NOT NULL DEFAULT ''");
  addColumn(conn, 'products', 'provider_service_id', 'TEXT');
  addColumn(conn, 'products', 'provider_service_name', 'TEXT');
  addColumn(conn, 'products', 'provider_cost_cents', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(conn, 'products', 'provider_price_mode', "TEXT NOT NULL DEFAULT 'UNIT'");
  addColumn(conn, 'products', 'provider_min', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(conn, 'products', 'provider_max', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(conn, 'products', 'provider_sync_cost', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(conn, 'products', 'offer_price_cents', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(conn, 'products', 'offer_ends_at', 'TEXT');
  addColumn(conn, 'products', 'featured', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(conn, 'products', 'updated_at', 'TEXT');

  /* --- Pedidos: estado del proveedor ----------------------------------- */
  addColumn(conn, 'orders', 'provider_status', 'TEXT');

  /* --- Servicios importados del proveedor ------------------------------ */
  conn.exec(`
    CREATE TABLE IF NOT EXISTS provider_services (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'PEAKERR',
      service_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      rate_cents INTEGER NOT NULL DEFAULT 0,
      min INTEGER NOT NULL DEFAULT 0,
      max INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      synced_at TEXT NOT NULL
    );
  `);
  conn.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_services_unique ON provider_services(provider, service_id);');

  /* --- Pedidos enviados al proveedor ----------------------------------- */
  conn.exec(`
    CREATE TABLE IF NOT EXISTS provider_orders (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'PEAKERR',
      order_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 0,
      charge_cents INTEGER NOT NULL DEFAULT 0,
      cost_cents INTEGER NOT NULL DEFAULT 0,
      profit_cents INTEGER NOT NULL DEFAULT 0,
      provider_order_id TEXT,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      start_count INTEGER,
      remains INTEGER,
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  // Un pedido de la tienda sólo puede enviarse una vez al proveedor.
  conn.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_orders_item ON provider_orders(order_item_id);');
  conn.exec('CREATE INDEX IF NOT EXISTS idx_provider_orders_order ON provider_orders(order_id);');
  conn.exec('CREATE INDEX IF NOT EXISTS idx_provider_orders_external ON provider_orders(provider_order_id);');

  /* --- Registro de actividad y errores --------------------------------- */
  conn.exec(`
    CREATE TABLE IF NOT EXISTS provider_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL DEFAULT 'info',
      action TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);
  conn.exec('CREATE INDEX IF NOT EXISTS idx_provider_logs_created ON provider_logs(created_at);');
}
