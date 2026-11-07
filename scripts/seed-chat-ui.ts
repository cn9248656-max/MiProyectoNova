/**
 * Datos de prueba para verificar el chat en la interfaz (uso temporal).
 * Uso: DATA_DIR=/tmp/nova-ui tsx scripts/seed-chat-ui.ts
 */
import { ensureConversation, sendMessage } from '../lib/chat';
import {
  addToCart,
  checkout,
  createCategory,
  createProduct,
  createUser,
  findUserByEmail,
  listCategories,
} from '../lib/store';

function fail(message: string): never {
  console.error(`FALLO: ${message}`);
  process.exit(1);
}

const admin = createUser({ email: 'admin@nova.test', name: 'Administrador Nova', password: 'nova1234' });
if (!admin.ok) fail(`admin: ${admin.error}`);
const adminUser = findUserByEmail('admin@nova.test');
if (!adminUser) fail('no se recuperó el admin');

const client = createUser({ email: 'cliente@nova.test', name: 'Carlos Cliente', password: 'nova1234' });
if (!client.ok) fail(`cliente: ${client.error}`);
const clientUser = findUserByEmail('cliente@nova.test');
if (!clientUser) fail('no se recuperó el cliente');

createCategory('Juegos', '🎮');
const category = listCategories().find((item) => item.name === 'Juegos');
if (!category) fail('no se creó la categoría');
const product = createProduct({
  name: 'Diamantes Free Fire 220',
  description: 'Recarga de diamantes para Free Fire.',
  priceCents: 900,
  categoryId: category.id,
  stock: 25,
  active: true,
  featured: true,
});
if (!product.ok) fail(`producto: ${product.error}`);

const added = addToCart(clientUser.id, product.product.id, 1);
if (!added.ok) fail(`carrito: ${added.error}`);
const order = checkout(clientUser.id, {
  paymentMethod: 'AGORA',
  reference: 'AGORA-UI-TEST',
  customerData: { playerId: '555777999', details: 'Servidor LATAM, cuenta principal' },
});
if (!order.ok) fail(`pedido: ${order.error}`);

const conversationId = ensureConversation(clientUser.id);
const first = sendMessage({
  conversationId,
  senderId: clientUser.id,
  senderRole: 'USER',
  body: 'Hola, mi ID de Free Fire es 555777999. ¿Cuándo me entregan?',
});
if (!first.ok) fail(`mensaje cliente: ${first.error}`);
const reply = sendMessage({
  conversationId,
  senderId: adminUser.id,
  senderRole: 'ADMIN',
  body: 'Hola Carlos, tus datos de acceso son: usuario nova777 / clave Nova2026',
});
if (!reply.ok) fail(`mensaje admin: ${reply.error}`);

console.log(
  JSON.stringify({ ok: true, admin: adminUser.role, client: clientUser.email, order: order.order.code, conversationId })
);
