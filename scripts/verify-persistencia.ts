/**
 * Verificación de la persistencia real en Supabase.
 *
 * Ejecutar:  npx tsx scripts/verify-persistencia.ts
 *
 * Qué comprueba:
 *   1. Que la conexión del servidor esté configurada por variables de entorno.
 *   2. Que el mapa de sincronización coincida con el esquema local real.
 *   3. Escritura: los datos de prueba llegan a Supabase.
 *   4. Reinicio simulado: una base vacía recupera TODO desde Supabase.
 *   5. Actualización: el dato nuevo gana al antiguo (no se sobrescribe).
 *   6. Borrado: lo eliminado no reaparece.
 *   7. Limpieza: los registros de prueba se eliminan de Supabase al terminar.
 *
 * Nunca toca data/novastore.db ni los datos reales de la tienda: cada base de
 * prueba vive en un directorio temporal y usa el prefijo «verify-».
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate, type DB } from '../lib/db';
import { SYNC_TABLES } from '../lib/supabase-schema';
import { deleteOp, runOpsSync, selectOp, syncStatus } from '../lib/supabase-db';
import { ensureSyncSchema, pullAllSync, pushPending } from '../lib/supabase-sync';

const PREFIX = 'verify-';
const lines: string[] = [];
let failures = 0;
const dirs: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  lines.push(`${ok ? 'OK  ' : 'FALLO'} · ${name}${detail ? ` → ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function openDb(tag: string): DB {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `nova-persist-${tag}-`));
  dirs.push(dir);
  const conn = new Database(path.join(dir, 'novastore.db'));
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  migrate(conn);
  ensureSyncSchema(conn);
  return conn;
}

function remoteRows(table: string): Array<Record<string, unknown>> {
  const [result] = runOpsSync([selectOp(table)]);
  if (!result || !result.ok) {
    throw new Error(`nova_select ${table} falló: ${JSON.stringify(result?.data ?? result?.error)}`);
  }
  return Array.isArray(result.data) ? (result.data as Array<Record<string, unknown>>) : [];
}

function remoteCount(table: string): number {
  const field = table === 'settings' ? 'key' : 'id';
  return remoteRows(table).filter((row) => String(row[field] ?? '').startsWith(PREFIX)).length;
}

type Row = Record<string, unknown>;

async function main(): Promise<void> {
  const status = syncStatus();
  check('Conexión de servidor configurada por variables de entorno', status.enabled, `modo ${status.mode}`);
  if (!status.enabled) {
    lines.push('Añade SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SYNC_SECRET para ejecutar la prueba real.');
    return;
  }

  // 1. Esquema local (creado por migrate) contra el mapa de sincronización.
  const schemaProbe = openDb('schema');
  let schemaOk = true;
  const schemaIssues: string[] = [];
  for (const [table, spec] of Object.entries(SYNC_TABLES)) {
    const real = new Set(
      (schemaProbe.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map((row) => row.name)
    );
    if (real.size === 0) {
      schemaOk = false;
      schemaIssues.push(`${table}: tabla ausente`);
      continue;
    }
    const missing = spec.columns.filter((column) => !real.has(column.name)).map((column) => column.name);
    if (missing.length > 0) {
      schemaOk = false;
      schemaIssues.push(`${table}: ${missing.join(', ')}`);
    }
  }
  check('El mapa de sincronización coincide con el esquema real', schemaOk, schemaIssues.join(' | '));

  // 2. Datos de prueba en una base temporal.
  const A = openDb('a');
  const stamp = new Date().toISOString();

  A.prepare('insert into categories (id, name, slug, icon, position, created_at) values (?, ?, ?, ?, ?, ?)').run(
    `${PREFIX}cat`,
    'Categoría de verificación',
    'verify-cat',
    '✓',
    99,
    stamp
  );
  A.prepare('insert into uploads (id, mime, size, data, created_at) values (?, ?, ?, ?, ?)').run(
    `${PREFIX}upload`,
    'image/png',
    4,
    Buffer.from([137, 80, 78, 71]),
    stamp
  );
  A.prepare(
    `insert into products
      (id, name, description, price_cents, category_id, image_id, stock, unlimited_stock, active, featured, created_at, updated_at, price, image_upload_id)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `${PREFIX}prod`,
    'Producto de verificación',
    'Comprueba que el catálogo sobrevive a un despliegue',
    250000,
    `${PREFIX}cat`,
    `${PREFIX}upload`,
    4,
    0,
    1,
    0,
    stamp,
    stamp,
    250000,
    `${PREFIX}upload`
  );
  A.prepare(
    `insert into users (id, email, password_hash, name, phone, role, balance_cents, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(`${PREFIX}user`, 'verify@novastore.test', 'hash-de-prueba', 'Cliente Verificación', '+580000000000', 'USER', 150000, stamp, stamp);
  A.prepare(
    `insert into orders
      (id, code, user_id, subtotal_cents, total_cents, status, payment_method, payment_status, reference, note, created_at, updated_at, customer_data)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `${PREFIX}order`,
    'VERIFY-1',
    `${PREFIX}user`,
    250000,
    250000,
    'PENDING',
    'WALLET',
    'PAID',
    'ref-verify',
    null,
    stamp,
    stamp,
    JSON.stringify({ freeFireId: '123456789' })
  );
  A.prepare('insert into order_items (id, order_id, product_id, name, price_cents, quantity) values (?, ?, ?, ?, ?, ?)').run(
    `${PREFIX}item`,
    `${PREFIX}order`,
    `${PREFIX}prod`,
    'Producto de verificación',
    250000,
    1
  );
  A.prepare('insert into conversations (id, user_id, created_at, updated_at, last_message_at) values (?, ?, ?, ?, ?)').run(
    `${PREFIX}conv`,
    `${PREFIX}user`,
    stamp,
    stamp,
    stamp
  );
  A.prepare(
    'insert into messages (id, conversation_id, sender_role, sender_id, body, read_by_user, read_by_admin, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(`${PREFIX}msg`, `${PREFIX}conv`, 'USER', `${PREFIX}user`, 'Mensaje de verificación', 1, 0, stamp);
  A.prepare('insert into settings (key, value) values (?, ?)').run(`${PREFIX}flag`, 'guardado-ok');
  A.prepare(
    `insert into support_tickets (id, code, user_id, subject, category, status, created_at, updated_at, last_message_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(`${PREFIX}ticket`, 'SUP-VERIFY', `${PREFIX}user`, 'Consulta de verificación', 'QUESTION', 'PENDING', stamp, stamp, stamp);
  A.prepare(
    `insert into support_messages (id, ticket_id, sender_role, sender_id, body, read_by_user, read_by_admin, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(`${PREFIX}smsg`, `${PREFIX}ticket`, 'USER', `${PREFIX}user`, 'Mensaje de soporte', 1, 0, stamp);

  // 3. Envío a Supabase.
  const push = await pushPending(A);
  check('Envío de los datos a Supabase', push.ok, push.errors.join(' · '));

  const tables = [
    'users',
    'categories',
    'uploads',
    'products',
    'orders',
    'order_items',
    'conversations',
    'messages',
    'settings',
    'support_tickets',
    'support_messages',
  ];
  for (const table of tables) {
    let count = 0;
    try {
      count = remoteCount(table);
    } catch (error) {
      check(`Supabase guardó ${table}`, false, (error as Error).message.slice(0, 160));
      continue;
    }
    check(`Supabase guardó ${table}`, count > 0, `${count} registro(s)`);
  }

  // 4. Reinicio simulado: contenedor nuevo = base vacía + restauración.
  const B = openDb('b');
  const pull = pullAllSync(B);
  check('Restauración automática desde Supabase', pull.ok, pull.errors.slice(0, 2).join(' · '));

  const user = B.prepare('select * from users where id = ?').get(`${PREFIX}user`) as Row | undefined;
  check(
    'El usuario vuelve con su email y saldo',
    user?.email === 'verify@novastore.test' && Number(user?.balance_cents) === 150000,
    `saldo ${String(user?.balance_cents)}`
  );
  check('La contraseña sigue guardada para volver a entrar', String(user?.password_hash ?? '') === 'hash-de-prueba');

  const product = B.prepare('select * from products where id = ?').get(`${PREFIX}prod`) as Row | undefined;
  check(
    'El producto vuelve con precio y stock',
    Number(product?.price_cents) === 250000 && Number(product?.stock) === 4,
    `precio ${String(product?.price_cents)} · stock ${String(product?.stock)}`
  );

  const upload = B.prepare('select data from uploads where id = ?').get(`${PREFIX}upload`) as { data: Buffer } | undefined;
  check(
    'La imagen vuelve como binario idéntico',
    Boolean(upload?.data) && Buffer.compare(upload.data, Buffer.from([137, 80, 78, 71])) === 0
  );

  const order = B.prepare('select * from orders where id = ?').get(`${PREFIX}order`) as Row | undefined;
  let freeFire = '';
  try {
    freeFire = String((JSON.parse(String(order?.customer_data ?? '{}')) as Row).freeFireId ?? '');
  } catch {
    freeFire = '';
  }
  check('El pedido vuelve con los datos del cliente', freeFire === '123456789', `Free Fire ${freeFire}`);

  const item = B.prepare('select * from order_items where id = ?').get(`${PREFIX}item`) as Row | undefined;
  check('El detalle del pedido vuelve', Number(item?.quantity) === 1);

  const message = B.prepare('select * from messages where id = ?').get(`${PREFIX}msg`) as Row | undefined;
  check('La conversación vuelve completa', String(message?.body ?? '') === 'Mensaje de verificación');

  const ticket = B.prepare('select * from support_tickets where id = ?').get(`${PREFIX}ticket`) as Row | undefined;
  const supportMessage = B.prepare('select * from support_messages where id = ?').get(`${PREFIX}smsg`) as Row | undefined;
  check('El ticket de soporte vuelve', String(ticket?.subject ?? '') === 'Consulta de verificación');
  check('El mensaje de soporte vuelve', String(supportMessage?.body ?? '') === 'Mensaje de soporte');

  const setting = B.prepare('select value from settings where key = ?').get(`${PREFIX}flag`) as { value: string } | undefined;
  check('La configuración vuelve', String(setting?.value ?? '') === 'guardado-ok');

  // 5. Actualización: el dato nuevo debe ganar al antiguo.
  A.prepare('update products set stock = 7, updated_at = ? where id = ?').run(new Date().toISOString(), `${PREFIX}prod`);
  const pushUpdate = await pushPending(A);
  check('Envío de una actualización', pushUpdate.ok, pushUpdate.errors.join(' · '));
  const C = openDb('c');
  pullAllSync(C);
  const updated = C.prepare('select stock from products where id = ?').get(`${PREFIX}prod`) as { stock: number } | undefined;
  check('La actualización nueva no la sobrescribe el dato antiguo', Number(updated?.stock) === 7, `stock ${String(updated?.stock)}`);

  // 6. Borrado: lo eliminado no debe reaparecer.
  A.prepare('delete from products where id = ?').run(`${PREFIX}prod`);
  const pushDelete = await pushPending(A);
  check('Envío de un borrado', pushDelete.ok, pushDelete.errors.join(' · '));
  const D = openDb('d');
  pullAllSync(D);
  const gone = D.prepare('select 1 as ok from products where id = ?').get(`${PREFIX}prod`);
  check('El producto eliminado no reaparece', !gone);

  // 7. Limpieza de los registros de prueba en Supabase.
  const cleanKeys: Array<[string, string[]]> = [
    ['support_messages', [`${PREFIX}smsg`]],
    ['support_tickets', [`${PREFIX}ticket`]],
    ['messages', [`${PREFIX}msg`]],
    ['conversations', [`${PREFIX}conv`]],
    ['order_items', [`${PREFIX}item`]],
    ['orders', [`${PREFIX}order`]],
    ['users', [`${PREFIX}user`]],
    ['products', [`${PREFIX}prod`]],
    ['uploads', [`${PREFIX}upload`]],
    ['categories', [`${PREFIX}cat`]],
    ['settings', [`${PREFIX}flag`]],
  ];
  const cleanResults = runOpsSync(cleanKeys.map(([table, keys]) => deleteOp(table, keys)));
  check(
    'Limpieza de los datos de prueba',
    cleanResults.every((result) => result.ok),
    cleanResults.filter((result) => !result.ok).length.toString()
  );
  let leftovers = 0;
  for (const table of tables) {
    try {
      leftovers += remoteCount(table);
    } catch {
      leftovers += 1;
    }
  }
  check('Supabase queda sin registros de prueba', leftovers === 0, `${leftovers} restante(s)`);
}

main()
  .catch((error: unknown) => {
    failures += 1;
    lines.push(`FALLO · excepción inesperada → ${(error as Error)?.message ?? String(error)}`);
  })
  .finally(() => {
    for (const dir of dirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* la limpieza del directorio temporal no afecta al resultado */
      }
    }
    console.log(lines.join('\n'));
    console.log(failures === 0 ? '\nRESULTADO: persistencia verificada correctamente.' : `\nRESULTADO: ${failures} fallo(s).`);
    process.exit(failures === 0 ? 0 : 1);
  });
