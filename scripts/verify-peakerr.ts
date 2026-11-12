/**
 * Verificación de la integración PEAKERR con un proveedor local que habla el
 * protocolo oficial (POST form-urlencoded: balance, services, add, status).
 *
 * No usa la base real de la tienda (DATA_DIR temporal) ni datos ficticios de
 * producción: comprueba cifrado de la clave, sincronización, precios
 * personalizados, envío automático sin duplicados y seguimiento de estados.
 *
 * Uso: DATA_DIR=/tmp/nova-peakerr-check npx tsx scripts/verify-peakerr.ts
 */
import http from 'node:http';
import fs from 'node:fs';

const DATA_DIR = process.env.DATA_DIR || '/tmp/nova-peakerr-check';
process.env.DATA_DIR = DATA_DIR;
fs.rmSync(DATA_DIR, { recursive: true, force: true });

const MOCK_KEY = 'test-key-123';
let rate = 0.5;
let addCalls = 0;
let externalSeq = 5001;
let statusPayload: Record<string, unknown> = {};

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) throw new Error(`FALLÓ: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const form = new URLSearchParams(raw);
      const action = form.get('action') || '';
      const send = (obj: unknown) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (form.get('key') !== MOCK_KEY) return send({ error: 'Incorrect key' });
      if (action === 'balance') return send({ balance: '25.50', currency: 'USD' });
      if (action === 'services')
        return send([
          { service: '101', name: 'Instagram Followers', type: 'Default', category: 'Instagram', rate: String(rate), min: '10', max: '10000' },
          { service: '102', name: 'TikTok Likes', type: 'Default', category: 'TikTok', rate: '0.20', min: '10', max: '5000' },
        ]);
      if (action === 'add') {
        addCalls += 1;
        return send({ order: externalSeq });
      }
      if (action === 'status') return send(statusPayload);
      return send({ error: 'Unknown action' });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;

  const { db } = await import('../lib/db');
  const store = await import('../lib/store');
  const provider = await import('../lib/provider');
  db();

  // ---------- 1. Configuración y cifrado de la clave ----------
  provider.saveConfig({ url: `http://127.0.0.1:${port}/api/v2`, apiKey: MOCK_KEY });
  const cfg = provider.readConfig();
  check('configuración guardada con clave', cfg.hasKey === true);
  const rawSettings = db().prepare("SELECT key, value FROM settings WHERE key LIKE 'peakerr%'").all() as Array<{ key: string; value: string }>;
  const leaked = rawSettings.filter((row) => String(row.value).includes(MOCK_KEY));
  check('la clave API no se guarda en texto plano', leaked.length === 0, JSON.stringify(leaked.map((r) => r.key)));

  // ---------- 2. Prueba de conexión y saldo ----------
  const conn = await provider.testConnection();
  check('testConnection responde OK', conn.ok === true, conn.error || '');
  check('saldo real leído (25.50 USD = 2550)', conn.balanceCents === 2550, String(conn.balanceCents));
  const balance = await provider.refreshBalance();
  check('refreshBalance devuelve 2550', balance === 2550, String(balance));

  // ---------- 3. Sincronización de servicios ----------
  const first = await provider.syncServices();
  check('servicios importados', first.total === 2, JSON.stringify(first));
  const svc = provider.findService('101');
  check('servicio 101 con tarifa 0.50', svc?.rateCents === 50, String(svc?.rateCents));

  // ---------- 4. Vínculo producto ↔ servicio y precio personalizado ----------
  const cat = store.createCategory('Pruebas', '🧪');
  check('categoría de prueba creada', cat.ok === true, cat.error || '');
  const categoryId = (db().prepare("SELECT id FROM categories WHERE name = 'Pruebas'").get() as { id: string }).id;
  const created = store.createProduct({
    name: 'Seguidores Instagram 1K',
    description: 'Prueba de integración',
    priceCents: 150,
    categoryId,
    stock: 0,
    unlimitedStock: true,
    active: true,
    featured: false,
  } as Parameters<typeof store.createProduct>[0]);
  check('producto de prueba creado', created.ok === true, created.ok ? '' : created.error);
  const productId = (created as { id: string }).id;

  provider.linkProduct(productId, '101');
  let linked = provider.listLinkedProducts().find((item) => item.productId === productId);
  check('producto vinculado al servicio 101', linked?.serviceId === '101', JSON.stringify(linked?.serviceId));
  check('costo del proveedor guardado (50)', linked?.costCents === 50, String(linked?.costCents));
  check('precio de venta propio conservado (150)', linked?.saleCents === 150, String(linked?.saleCents));

  // El proveedor sube su tarifa: mi precio de venta NO debe cambiar.
  rate = 0.8;
  await provider.syncServices();
  linked = provider.listLinkedProducts().find((item) => item.productId === productId);
  let priceRow = db().prepare('SELECT price_cents, provider_cost_cents FROM products WHERE id = ?').get(productId) as {
    price_cents: number;
    provider_cost_cents: number;
  };
  check('re-sincronizar no sobrescribe mi precio de venta', priceRow.price_cents === 150, String(priceRow.price_cents));
  check('un costo ajustado a mano se conserva', priceRow.provider_cost_cents === 50, String(priceRow.provider_cost_cents));

  // Con «seguir el costo del proveedor» activo el costo se refresca, el precio no.
  provider.savePricing({ productId, saleCents: 150, costCents: 50, priceMode: 'UNIT', syncCost: true });
  rate = 1.0;
  await provider.syncServices();
  priceRow = db().prepare('SELECT price_cents, provider_cost_cents FROM products WHERE id = ?').get(productId) as {
    price_cents: number;
    provider_cost_cents: number;
  };
  check('el costo sigue la nueva tarifa del proveedor (100)', priceRow.provider_cost_cents === 100, String(priceRow.provider_cost_cents));
  check('seguir el costo no modifica mi precio de venta', priceRow.price_cents === 150, String(priceRow.price_cents));
  linked = provider.listLinkedProducts().find((item) => item.productId === productId);
  check('ganancia por unidad calculada (150 - 100)', linked?.saleCents === 150 && linked?.costCents === 100, JSON.stringify({ sale: linked?.saleCents, cost: linked?.costCents }));

  // ---------- 5. Pedido pagado con saldo → envío automático ----------
  const user = store.createUser({ email: 'cliente@nova.local', name: 'Cliente Prueba', password: 'Prueba1234' });
  if (!user.ok) throw new Error(`No se pudo crear el usuario de prueba: ${user.error}`);
  const userId = user.user.id;
  db().prepare('UPDATE users SET balance_cents = 1000 WHERE id = ?').run(userId);

  const added = store.addToCart(userId, productId, 1);
  check('producto añadido al carrito', added.ok === true, added.error || '');
  const order = store.checkout(userId, { paymentMethod: 'BALANCE', customerData: { link: 'https://instagram.com/cliente_prueba' } });
  check('checkout completado', order.ok === true, order.ok ? '' : order.error);
  const orderId = (order as { orderId: string }).orderId;
  const orderRow = db().prepare('SELECT payment_status, status, total_cents FROM orders WHERE id = ?').get(orderId) as {
    payment_status: string;
    status: string;
    total_cents: number;
  };
  check('pedido pagado con saldo', orderRow.payment_status === 'PAID', orderRow.payment_status);
  check('total del pedido correcto (150)', orderRow.total_cents === 150, String(orderRow.total_cents));

  const dispatch = await provider.dispatchOrder(orderId);
  check('pedido enviado a PEAKERR', dispatch.sent === 1, JSON.stringify(dispatch));
  check('se llamó una vez a la acción add', addCalls === 1, String(addCalls));

  const sent = provider.listProviderOrders(10).filter((row) => row.orderId === orderId);
  check('un único registro de proveedor por pedido', sent.length === 1, String(sent.length));
  check('ID externo guardado', sent[0]?.providerOrderId === String(externalSeq), String(sent[0]?.providerOrderId));
  check('ganancia calculada (150 - 100)', sent[0]?.profitCents === 50, String(sent[0]?.profitCents));

  // ---------- 6. Nunca se envía dos veces ----------
  const again = await provider.dispatchOrder(orderId);
  check('reenviar no duplica el pedido', again.sent === 0 && addCalls === 1, JSON.stringify({ again, addCalls }));

  // ---------- 7. Seguimiento de estados ----------
  statusPayload = {
    [String(externalSeq)]: { status: 'Completed', remains: '0', start_count: '12', charge: '0.80' },
  };
  const sync = await provider.syncStatuses();
  check('estado consultado al proveedor', sync.checked >= 1, JSON.stringify(sync));
  const completed = provider.listProviderOrders(10).find((row) => row.orderId === orderId);
  check('estado del servicio completado', completed?.status === 'COMPLETED', String(completed?.status));
  const afterSync = db().prepare('SELECT status, provider_status FROM orders WHERE id = ?').get(orderId) as {
    status: string;
    provider_status: string | null;
  };
  check('pedido del cliente completado', afterSync.status === 'COMPLETED', afterSync.status);
  check('estado del proveedor visible en el pedido', afterSync.provider_status === 'COMPLETED', String(afterSync.provider_status));

  // ---------- 8. Pedido sin pago confirmado no se envía ----------
  store.addToCart(userId, productId, 1);
  const unpaid = store.checkout(userId, { paymentMethod: 'AGORA', customerData: { link: 'https://instagram.com/cliente_prueba' } });
  check('segundo pedido creado', unpaid.ok === true, unpaid.ok ? '' : unpaid.error);
  const unpaidId = (unpaid as { orderId: string }).orderId;
  const before = addCalls;
  const blocked = await provider.dispatchOrder(unpaidId);
  check('no se envía si el pago no está confirmado', blocked.sent === 0 && addCalls === before, JSON.stringify(blocked));

  // ---------- 9. Estados finales y errores del proveedor ----------
  statusPayload = { '999': { status: 'Canceled' }, '998': { error: 'Not enough funds' } };
  const mapped = await provider.syncStatuses();
  check('consulta de estados no rompe con datos raros', mapped.error === undefined, String(mapped.error));

  // ---------- 10. Desconexión ----------
  provider.disconnect();
  check('desconectar borra la clave', provider.readConfig().hasKey === false);

  server.close();
  console.log('\n=== RESULTADOS ===');
  for (const row of results) console.log(`${row.ok ? 'OK ' : 'X  '} ${row.name}${row.detail ? ` (${row.detail})` : ''}`);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} comprobaciones correctas`);
}

main().catch((error) => {
  console.error('\n' + (error instanceof Error ? error.message : String(error)));
  console.log('\n=== RESULTADOS ===');
  for (const row of results) console.log(`${row.ok ? 'OK ' : 'X  '} ${row.name}${row.detail ? ` (${row.detail})` : ''}`);
  process.exit(1);
});
