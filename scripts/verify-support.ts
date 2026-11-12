/**
 * Prueba del soporte al cliente:
 *  - cada cliente solo ve sus propias solicitudes (privacidad);
 *  - los mensajes quedan guardados y se recuperan;
 *  - el estado cambia (Pendiente → En proceso → Resuelto) y se reabre;
 *  - el administrador recibe notificación y el cliente marca sus respuestas;
 *  - los datos maliciosos o vacíos se rechazan o se limpian.
 *
 * Uso: DATA_DIR=/tmp/nova-support-check tsx scripts/verify-support.ts
 */
import { createUser, listNotifications } from '../lib/store';
import * as support from '../lib/support';

let checks = 0;

function fail(message: string): never {
  console.error(`FALLO: ${message}`);
  process.exit(1);
}

function check(condition: boolean, message: string) {
  checks += 1;
  if (!condition) fail(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  if (!process.env.DATA_DIR) {
    fail('Ejecuta con DATA_DIR apuntando a una carpeta temporal para no tocar datos reales.');
  }

  const admin = createUser({ email: 'admin@nova.test', name: 'Admin Soporte', password: 'secreto123' });
  if (!admin.ok) fail(admin.error);
  check(admin.user.role === 'ADMIN', 'El primer usuario es administrador');

  const ana = createUser({ email: 'ana@nova.test', name: 'Ana Cliente', password: 'secreto123' });
  if (!ana.ok) fail(ana.error);
  const luis = createUser({ email: 'luis@nova.test', name: 'Luis Cliente', password: 'secreto123' });
  if (!luis.ok) fail(luis.error);

  /* --------------------------- Crear solicitudes --------------------------- */

  const ticketA = support.createTicket({
    userId: ana.user.id,
    subject: 'No recibí mi producto',
    category: 'ORDER',
    message: 'Compré un paquete de Free Fire y no me llegó el código.',
  });
  if (!ticketA.ok) fail(ticketA.error);
  check(ticketA.ticket.code.startsWith('SUP-'), 'La solicitud recibe un código legible');
  check(ticketA.ticket.status === 'PENDING', 'La solicitud nace en estado Pendiente');

  const ticketB = support.createTicket({
    userId: luis.user.id,
    subject: 'Problema con mi recarga',
    category: 'PAYMENT',
    message: 'Envié el comprobante de Agora y no se acreditó el saldo.',
  });
  if (!ticketB.ok) fail(ticketB.error);

  /* ------------------------------- Privacidad ------------------------------ */

  check(support.getTicketForUser(ticketB.ticket.id, ana.user.id) === null, 'Ana no puede abrir la solicitud de Luis');
  check(support.getTicketForUser(ticketA.ticket.id, luis.user.id) === null, 'Luis no puede abrir la solicitud de Ana');
  check(support.getTicketForUser(ticketA.ticket.id, ana.user.id) !== null, 'Ana sí puede abrir su propia solicitud');

  const anaTickets = support.listTicketsForUser(ana.user.id);
  check(anaTickets.length === 1, 'Ana ve exactamente una solicitud');
  check(anaTickets[0].id === ticketA.ticket.id, 'La lista de Ana solo contiene su solicitud');

  const luisTickets = support.listTicketsForUser(luis.user.id);
  check(luisTickets.length === 1 && luisTickets[0].id === ticketB.ticket.id, 'La lista de Luis solo contiene la suya');

  /* ------------------------- Notificación al admin ------------------------- */

  const notificaciones = listNotifications();
  check(
    notificaciones.some((item) => item.type === 'SUPPORT' && (item.link || '').includes(ticketA.ticket.id)),
    'El administrador recibe una notificación con enlace a la solicitud'
  );

  /* ----------------------------- Conversación ----------------------------- */

  const first = support.addMessage({
    ticketId: ticketA.ticket.id,
    senderId: ana.user.id,
    senderRole: 'USER',
    body: 'Adjunto el número de pedido: NV-1042.',
  });
  if (!first.ok) fail(first.error);
  check(first.message.senderRole === 'USER', 'El mensaje del cliente se guarda como USER');
  check(support.unreadForAdmin() >= 1, 'El mensaje del cliente queda como no leído para el administrador');

  const reply = support.addMessage({
    ticketId: ticketA.ticket.id,
    senderId: admin.user.id,
    senderRole: 'ADMIN',
    body: 'Hola Ana, tus datos de acceso son usuario demo / clave demo.',
  });
  if (!reply.ok) fail(reply.error);
  check(reply.status === 'IN_PROGRESS', 'Al responder, la solicitud pasa a En proceso');
  check(support.getTicket(ticketA.ticket.id)?.status === 'IN_PROGRESS', 'El nuevo estado queda guardado en la base');
  check(support.unreadForUser(ana.user.id) === 1, 'La respuesta del administrador notifica al cliente');

  // Un tercero no puede marcar como leída una conversación ajena.
  support.markReadForUser(ticketA.ticket.id, luis.user.id);
  check(support.unreadForUser(ana.user.id) === 1, 'Otro usuario no puede alterar los no leídos de Ana');

  support.markReadForUser(ticketA.ticket.id, ana.user.id);
  check(support.unreadForUser(ana.user.id) === 0, 'Ana marca la respuesta como leída');

  support.markReadForAdmin(ticketA.ticket.id);
  check(support.unreadForAdmin() === 0, 'El administrador marca la conversación como leída');

  /* -------------------------- Estados y reapertura ------------------------- */

  support.setStatus(ticketA.ticket.id, 'RESOLVED');
  check(support.getTicket(ticketA.ticket.id)?.status === 'RESOLVED', 'El administrador puede marcar Resuelto');

  const reopen = support.addMessage({
    ticketId: ticketA.ticket.id,
    senderId: ana.user.id,
    senderRole: 'USER',
    body: 'Sigo sin poder entrar, me ayuda por favor.',
  });
  if (!reopen.ok) fail(reopen.error);
  check(reopen.status === 'IN_PROGRESS', 'Si el cliente responde, la solicitud resuelta se reabre');

  const counts = support.supportStatusCounts();
  check(counts.PENDING === 1 && counts.IN_PROGRESS === 1, 'Los contadores por estado son correctos');

  /* ------------------------------- Validación ------------------------------ */

  const empty = support.createTicket({ userId: ana.user.id, subject: 'x', category: 'OTHER', message: 'y' });
  check(!empty.ok, 'Se rechaza una solicitud con asunto y mensaje demasiado cortos');

  const malicious = support.addMessage({
    ticketId: ticketB.ticket.id,
    senderId: luis.user.id,
    senderRole: 'USER',
    body: '<script>alert("xss")</script>Hola, sigo esperando mi recarga.',
  });
  if (!malicious.ok) fail(malicious.error);
  check(!malicious.message.body.includes('<script'), 'El HTML malicioso se elimina del mensaje');

  const tooLong = support.addMessage({
    ticketId: ticketB.ticket.id,
    senderId: luis.user.id,
    senderRole: 'USER',
    body: 'a'.repeat(6000),
  });
  if (!tooLong.ok) fail(tooLong.error);
  check(tooLong.message.body.length <= 2000, 'Un mensaje gigante se recorta a 2000 caracteres');

  /* ------------------------- Persistencia del historial -------------------- */

  const stored = support.listMessages(ticketA.ticket.id);
  check(stored.length === 3, 'El historial de Ana conserva los tres mensajes');
  check(
    stored.some((message) => message.body.includes('usuario demo / clave demo')),
    'La respuesta del administrador sigue guardada'
  );
  check(stored[0].body.includes('NV-1042'), 'El primer mensaje conserva su contenido');
  check(stored.every((message) => message.ticketId === ticketA.ticket.id), 'Los mensajes pertenecen a su solicitud');

  const summary = support.supportSummary();
  check(summary.total === 2, 'El resumen del panel cuenta las dos solicitudes');

  console.log(`\nSoporte al cliente: ${checks} comprobaciones correctas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
