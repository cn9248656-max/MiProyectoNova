/**
 * Prueba de persistencia: los datos deben seguir en disco al reiniciar el proceso.
 * Uso: DATA_DIR=/tmp/nova-persist tsx scripts/verify-persistence.ts write|read
 */
import {
  addToCart,
  checkout,
  createCategory,
  createProduct,
  createTopup,
  createUser,
  findUserByEmail,
  getUserById,
  listCategories,
  listOrders,
  listProducts,
  listWallet,
  reviewTopup,
  updateSettings,
  getSettings,
} from '../lib/store';

const EMAIL = 'persistencia@nova.test';
const mode = process.argv[2];

function fail(message: string): never {
  console.error(`FALLO: ${message}`);
  process.exit(1);
}

if (mode === 'write') {
  const admin = createUser({ email: 'admin-persist@nova.test', name: 'Admin Persistencia', password: 'secreto123' });
  if (!admin.ok) fail(`no se pudo crear admin: ${admin.error}`);

  const customer = createUser({ email: EMAIL, name: 'Cliente Persistencia', password: 'secreto123' });
  if (!customer.ok) fail(`no se pudo crear cliente: ${customer.error}`);

  const category = createCategory('Prueba Persistencia', '🧪');
  if (!category.ok) fail(`no se pudo crear categoría: ${category.error}`);
  const categoryId = listCategories().find((item) => item.name === 'Prueba Persistencia')!.id;

  const product = createProduct({
    name: 'Producto Persistencia',
    description: 'Producto creado por la prueba automática de persistencia.',
    priceCents: 1500,
    categoryId,
    stock: 5,
    active: true,
    featured: false,
  });
  if (!product.ok) fail(`no se pudo crear producto: ${product.error}`);

  const topup = createTopup(customer.user.id, { amountCents: 5000, reference: 'AGORA-PRUEBA-1' });
  if (!topup.ok) fail(`no se pudo crear recarga: ${topup.error}`);

  const approved = reviewTopup(topup.id, 'APPROVED', 'Aprobada en prueba', admin.user.id);
  if (!approved.ok) fail(`no se pudo aprobar recarga: ${approved.error}`);

  addToCart(customer.user.id, product.id, 2);
  const order = checkout(customer.user.id, { paymentMethod: 'BALANCE', note: 'Prueba persistencia' });
  if (!order.ok) fail(`no se pudo comprar: ${order.error}`);

  updateSettings({ storeName: 'NovaStore' });

  console.log(
    JSON.stringify({
      mode,
      userId: customer.user.id,
      productId: product.id,
      orderId: order.orderId,
      orderCode: order.code,
      topupId: topup.id,
    })
  );
} else if (mode === 'read') {
  const user = findUserByEmail(EMAIL);
  if (!user) fail('el usuario no sobrevivió al reinicio del proceso');

  const fresh = getUserById(user.id)!;
  if (fresh.balanceCents !== 5000 - 3000) fail(`saldo esperado 2000, obtenido ${fresh.balanceCents}`);

  const product = listProducts({}).find((item) => item.name === 'Producto Persistencia');
  if (!product) fail('el producto no sobrevivió al reinicio del proceso');
  if (product.stock !== 3) fail(`stock esperado 3, obtenido ${product.stock}`);

  const orders = listOrders(user.id);
  if (orders.length !== 1) fail(`se esperaba 1 pedido, obtenidos ${orders.length}`);

  const wallet = listWallet(user.id);
  const kinds = wallet.map((tx) => tx.type).sort();
  if (!kinds.includes('TOPUP') || !kinds.includes('PURCHASE')) fail(`movimientos incompletos: ${kinds.join(',')}`);

  const settings = getSettings();
  if (settings.storeName !== 'NovaStore') fail('la configuración no se recuperó');

  console.log(
    JSON.stringify({
      mode,
      ok: true,
      balanceCents: fresh.balanceCents,
      stock: product.stock,
      orders: orders.length,
      walletMoves: wallet.length,
      storeName: settings.storeName,
    })
  );
} else {
  fail('modo inválido, usa write o read');
}
