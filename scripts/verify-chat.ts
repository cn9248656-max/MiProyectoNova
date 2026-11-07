/**
 * Verifica el chat privado y los datos de entrega entre procesos distintos.
 * Uso: DATA_DIR=/tmp/nova-chat tsx scripts/verify-chat.ts write|read
 */
import { ensureConversation, conversationForUser, listMessages, sendMessage, unreadForAdmin, unreadForUser } from '../lib/chat';
import { addToCart, checkout, createCategory, createProduct, createUser, findUserByEmail, listOrders, saveOrderCustomerData } from '../lib/store';

const EMAIL = 'chat-persistencia@nova.test';
const mode = process.argv[2];

function fail(message: string): never {
  console.error(`FALLO: ${message}`);
  process.exit(1);
}

if (mode === 'write') {
  const customer = createUser({ email: EMAIL, name: 'Cliente Chat', password: 'secreto123' });
  if (!customer.ok) fail(`usuario: ${customer.error}`);
  const user = findUserByEmail(EMAIL);
  if (!user) fail('no se recuperó el usuario');

  const conversationId = ensureConversation(user.id);
  const first = sendMessage({ conversationId, senderId: user.id, senderRole: 'USER', body: 'Mi ID de Free Fire es 123456789' });
  if (!first.ok) fail(`mensaje cliente: ${first.error}`);
  const second = sendMessage({ conversationId, senderId: 'admin-test', senderRole: 'ADMIN', body: 'Listo, tus datos de acceso son usuario/clave' });
  if (!second.ok) fail(`mensaje admin: ${second.error}`);
  if (unreadForAdmin() < 1) fail('el administrador no tiene mensajes sin leer');
  if (unreadForUser(user.id) < 1) fail('el cliente no ve la respuesta como no leída');

  createCategory('Categoria Chat', '💬');
  const product = createProduct({ name: 'Diamantes 100', description: 'Paquete de prueba de chat.', priceCents: 500, stock: 10, active: true, featured: false });
  if (!product.ok) fail(`producto: ${product.error}`);
  addToCart(user.id, product.id, 1);
  const order = checkout(user.id, {
    paymentMethod: 'BALANCE',
    customerData: { playerId: '123456789', details: 'Servidor LATAM' },
  });
  if (!order.ok) fail(`checkout: ${order.error}`);
  const created = listOrders(user.id)[0];
  if (!created) fail('no se creó el pedido');
  const saved = saveOrderCustomerData(created.id, user.id, { playerId: '987654321', details: 'Servidor LATAM' });
  if (!saved.ok) fail(`guardar datos: ${saved.error}`);

  console.log(JSON.stringify({ mode, conversationId, userId: user.id, orderId: created.id }));
} else if (mode === 'read') {
  const user = findUserByEmail(EMAIL);
  if (!user) fail('el usuario no persistió');
  const conversation = conversationForUser(user.id);
  if (!conversation) fail('la conversación no persistió');
  const messages = listMessages(conversation.id);
  if (messages.length !== 2) fail(`se esperaban 2 mensajes, hay ${messages.length}`);
  if (messages[0].senderRole !== 'USER' || messages[1].senderRole !== 'ADMIN') fail('roles de mensaje incorrectos');
  if (!messages[0].body.includes('123456789')) fail('el mensaje del cliente no se recuperó');
  if (!messages[1].body.includes('datos de acceso')) fail('la respuesta del administrador no se recuperó');

  const orders = listOrders(user.id);
  if (orders.length !== 1) fail(`se esperaba 1 pedido, hay ${orders.length}`);
  const data = orders[0].customerData;
  if (!data) fail('los datos de entrega no persistieron');
  if (data.playerId !== '987654321') fail(`ID guardado incorrecto: ${data.playerId}`);
  if (data.details !== 'Servidor LATAM') fail('los datos adicionales no persistieron');

  console.log(JSON.stringify({ mode, ok: true, messages: messages.length, playerId: data.playerId, orders: orders.length }));
} else {
  fail('modo inválido, usa write o read');
}
