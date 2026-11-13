/**
 * Esquema del sistema de recargas Sip.
 *
 * IMPORTANTE: todos los cambios son ADITIVOS. Nunca se elimina ni se renombra
 * una columna o tabla existente, de modo que los productos, pedidos, clientes,
 * comprobantes y conversaciones que ya están guardados se conservan intactos.
 *
 * - `topups` recibe columnas nuevas (código único, método de origen, operación).
 * - `sip_transactions` guarda cada dinero realmente recibido en la cuenta Sip.
 *   El índice único sobre `operation_number` impide registrar dos veces la misma
 *   transferencia, y el índice único sobre `applied_topup_id` impide que una
 *   misma operación acredite saldo a dos clientes.
 */

type Conn = {
  exec(sql: string): unknown;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
};

function columnNames(conn: Conn, table: string): string[] {
  const rows = conn.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function addColumn(conn: Conn, table: string, column: string, ddl: string): void {
  if (columnNames(conn, table).includes(column)) return;
  conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

export function ensureSipSchema(conn: Conn): void {
  addColumn(conn, 'topups', 'sip_code', 'TEXT');
  addColumn(conn, 'topups', 'sip_method', 'TEXT');
  addColumn(conn, 'topups', 'sip_operation', 'TEXT');
  addColumn(conn, 'topups', 'sip_transaction_id', 'TEXT');
  addColumn(conn, 'topups', 'credited_at', 'TEXT');

  conn.exec(`
    CREATE TABLE IF NOT EXISTS sip_transactions (
      id TEXT PRIMARY KEY,
      operation_number TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      reference_code TEXT,
      sender_name TEXT,
      sender_phone TEXT,
      note TEXT,
      source TEXT NOT NULL DEFAULT 'WEBHOOK',
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      applied_topup_id TEXT,
      user_id TEXT,
      raw_payload TEXT,
      received_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      applied_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS sip_transactions_operation_idx
      ON sip_transactions (operation_number);

    CREATE UNIQUE INDEX IF NOT EXISTS sip_transactions_applied_idx
      ON sip_transactions (applied_topup_id) WHERE applied_topup_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS topups_sip_code_idx
      ON topups (sip_code) WHERE sip_code IS NOT NULL;
  `);
}
