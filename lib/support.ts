/**
 * Soporte al cliente: solicitudes privadas (tickets) con su hilo de mensajes.
 *
 * Reglas de privacidad aplicadas aquí, en el servidor:
 *  - un cliente solo obtiene sus propios tickets (getTicketForUser / listTicketsForUser);
 *  - el panel administrador es el único que consulta la bandeja completa;
 *  - los textos se limpian y se limitan antes de guardarse (antiabuso).
 *
 * La base es la misma SQLite persistente de la tienda (data/novastore.db).
 * Cada escritura se intenta replicar en Supabase desde el servidor cuando
 * existe SUPABASE_SERVICE_ROLE_KEY (nunca desde el navegador).
 */
import { db, id, now } from './db';
import { mirrorMessage, mirrorStatus, mirrorTicket } from './support-supabase';
import type {
  ChatSenderRole,
  SupportCategory,
  SupportMessage,
  SupportStatus,
  SupportTicket,
} from './types';

type Row = Record<string, unknown>;

const MAX_SUBJECT = 120;
const MAX_BODY = 2000;
const MIN_SUBJECT = 4;
const MIN_BODY = 5;
const MAX_MESSAGES = 300;

/** Límites antiabuso: evitan que un usuario llene la bandeja de soporte. */
const TICKET_WINDOW_MS = 60 * 60 * 1000;
const MAX_TICKETS_PER_WINDOW = 10;
const MESSAGE_WINDOW_MS = 60 * 1000;
const MAX_MESSAGES_PER_WINDOW = 30;

const CATEGORIES: SupportCategory[] = ['QUESTION', 'ORDER', 'PAYMENT', 'BUG', 'CLAIM', 'OTHER'];
const STATUSES: SupportStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Limpia el texto recibido del formulario: elimina caracteres de control
 * (incluidos los usados para inyección de terminal/HTML) y limita la longitud.
 * El render de React ya escapa el HTML; esto añade la validación del servidor.
 */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export function normalizeCategory(value: unknown): SupportCategory {
  const raw = String(value || '').toUpperCase();
  return (CATEGORIES as string[]).includes(raw) ? (raw as SupportCategory) : 'OTHER';
}

export function normalizeStatus(value: unknown): SupportStatus | null {
  const raw = String(value || '').toUpperCase();
  return (STATUSES as string[]).includes(raw) ? (raw as SupportStatus) : null;
}

const TICKET_SELECT = `
  SELECT t.id, t.code, t.user_id, t.subject, t.category, t.status,
         t.created_at, t.updated_at, t.last_message_at,
         u.name AS user_name, u.email AS user_email,
         (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS message_count,
         (SELECT COUNT(*) FROM support_messages m
            WHERE m.ticket_id = t.id AND m.sender_role = 'ADMIN' AND m.read_by_user = 0) AS unread_for_user,
         (SELECT COUNT(*) FROM support_messages m
            WHERE m.ticket_id = t.id AND m.sender_role = 'USER' AND m.read_by_admin = 0) AS unread_for_admin,
         (SELECT m.body FROM support_messages m
            WHERE m.ticket_id = t.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message
  FROM support_tickets t
  JOIN users u ON u.id = t.user_id
`;

function mapTicket(row: Row): SupportTicket {
  return {
    id: text(row.id),
    code: text(row.code),
    userId: text(row.user_id),
    subject: text(row.subject),
    category: normalizeCategory(row.category),
    status: normalizeStatus(row.status) ?? 'PENDING',
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    lastMessageAt: row.last_message_at ? text(row.last_message_at) : null,
    lastMessage: row.last_message ? text(row.last_message) : null,
    messageCount: count(row.message_count),
    unreadForUser: count(row.unread_for_user),
    unreadForAdmin: count(row.unread_for_admin),
    userName: row.user_name ? text(row.user_name) : undefined,
    userEmail: row.user_email ? text(row.user_email) : undefined,
  };
}

function mapMessage(row: Row): SupportMessage {
  return {
    id: text(row.id),
    ticketId: text(row.ticket_id),
    senderRole: text(row.sender_role) === 'ADMIN' ? 'ADMIN' : 'USER',
    senderName: text(row.sender_name) || (text(row.sender_role) === 'ADMIN' ? 'Soporte NovaStore' : 'Cliente'),
    body: text(row.body),
    readByUser: count(row.read_by_user) === 1,
    readByAdmin: count(row.read_by_admin) === 1,
    createdAt: text(row.created_at),
  };
}

function ticketCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `SUP-${code}`;
}

function uniqueCode(): string {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = ticketCode();
    const exists = db().prepare('SELECT 1 AS ok FROM support_tickets WHERE code = ?').get(code);
    if (!exists) return code;
  }
  return `SP-${id('').slice(0, 8).toUpperCase()}`;
}

function ticketsInLastHour(userId: string): number {
  const row = db()
    .prepare('SELECT COUNT(*) AS total FROM support_tickets WHERE user_id = ? AND created_at > ?')
    .get(userId, new Date(Date.now() - TICKET_WINDOW_MS).toISOString()) as Row;
  return count(row.total);
}

function messagesInLastMinute(senderId: string): number {
  const row = db()
    .prepare('SELECT COUNT(*) AS total FROM support_messages WHERE sender_id = ? AND created_at > ?')
    .get(senderId, new Date(Date.now() - MESSAGE_WINDOW_MS).toISOString()) as Row;
  return count(row.total);
}

/** Aviso para el administrador (se muestra en /admin/notificaciones y en el badge). */
function notifyAdmin(title: string, message: string, link: string) {
  db()
    .prepare(
      'INSERT INTO notifications (id, type, title, message, link, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
    )
    .run(id('ntf_'), 'SUPPORT', title, message.slice(0, 240), link, now());
}

export type CreateTicketResult =
  | { ok: true; ticket: SupportTicket }
  | { ok: false; error: string };

/** Crea una solicitud de soporte con su primer mensaje. */
export function createTicket(input: {
  userId: string;
  subject: string;
  category: string;
  message: string;
}): CreateTicketResult {
  const subject = cleanText(input.subject, MAX_SUBJECT);
  const body = cleanText(input.message, MAX_BODY);

  if (subject.length < MIN_SUBJECT) {
    return { ok: false, error: 'Escribe un asunto de al menos 4 caracteres.' };
  }
  if (body.length < MIN_BODY) {
    return { ok: false, error: 'Cuéntanos tu caso con un poco más de detalle.' };
  }
  if (ticketsInLastHour(input.userId) >= MAX_TICKETS_PER_WINDOW) {
    return {
      ok: false,
      error:
        'Enviaste varias solicitudes en la última hora. Espera un momento o continúa una conversación existente.',
    };
  }

  const ticketId = id('sup_');
  const stamp = now();
  const code = uniqueCode();
  const category = normalizeCategory(input.category);

  const create = db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO support_tickets (id, code, user_id, subject, category, status, created_at, updated_at, last_message_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
      )
      .run(ticketId, code, input.userId, subject, category, stamp, stamp, stamp);

    db()
      .prepare(
        `INSERT INTO support_messages (id, ticket_id, sender_role, sender_id, body, read_by_user, read_by_admin, created_at)
         VALUES (?, ?, 'USER', ?, ?, 1, 0, ?)`
      )
      .run(id('smsg_'), ticketId, input.userId, body, stamp);

    const user = db().prepare('SELECT name, email FROM users WHERE id = ?').get(input.userId) as Row | undefined;
    notifyAdmin(
      `Nueva solicitud de soporte: ${subject}`,
      `${text(user?.name) || text(user?.email) || 'Cliente'} (${code}): ${body.slice(0, 140)}`,
      `/admin/soporte?t=${ticketId}`
    );
  });

  create();

  const ticket = getTicket(ticketId);
  if (!ticket) return { ok: false, error: 'No se pudo crear la solicitud. Inténtalo de nuevo.' };

  mirrorTicket(ticket);
  const first = listMessages(ticketId, { limit: 1 });
  if (first[0]) mirrorMessage(first[0]);

  return { ok: true, ticket };
}

/** Ticket sin comprobar el propietario: uso interno del servidor. */
export function getTicket(ticketId: string): SupportTicket | null {
  if (!ticketId) return null;
  const row = db().prepare(`${TICKET_SELECT} WHERE t.id = ?`).get(ticketId) as Row | undefined;
  return row ? mapTicket(row) : null;
}

/**
 * Ticket visible solo para su dueño. Devuelve null cuando la solicitud es de
 * otra persona: el llamador no distingue «no existe» de «no es tuya».
 */
export function getTicketForUser(ticketId: string, userId: string): SupportTicket | null {
  if (!ticketId || !userId) return null;
  const row = db()
    .prepare(`${TICKET_SELECT} WHERE t.id = ? AND t.user_id = ?`)
    .get(ticketId, userId) as Row | undefined;
  return row ? mapTicket(row) : null;
}

/** Bandeja del cliente: solo sus propias solicitudes. */
export function listTicketsForUser(userId: string): SupportTicket[] {
  if (!userId) return [];
  const rows = db()
    .prepare(`${TICKET_SELECT} WHERE t.user_id = ? ORDER BY COALESCE(t.last_message_at, t.created_at) DESC`)
    .all(userId) as Row[];
  return rows.map(mapTicket);
}

/** Bandeja del administrador: todas las solicitudes, opcionalmente por estado. */
export function listAllTickets(filter: { status?: SupportStatus | null } = {}): SupportTicket[] {
  const status = filter.status ?? null;
  const rows = status
    ? (db()
        .prepare(`${TICKET_SELECT} WHERE t.status = ? ORDER BY COALESCE(t.last_message_at, t.created_at) DESC`)
        .all(status) as Row[])
    : (db()
        .prepare(`${TICKET_SELECT} ORDER BY COALESCE(t.last_message_at, t.created_at) DESC`)
        .all() as Row[]);
  return rows.map(mapTicket);
}

export function supportStatusCounts(): Record<SupportStatus, number> {
  const rows = db()
    .prepare('SELECT status, COUNT(*) AS total FROM support_tickets GROUP BY status')
    .all() as Row[];
  const result: Record<SupportStatus, number> = { PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const row of rows) {
    const status = normalizeStatus(row.status);
    if (status) result[status] = count(row.total);
  }
  return result;
}

export function listMessages(ticketId: string, options: { after?: string; limit?: number } = {}): SupportMessage[] {
  if (!ticketId) return [];
  const limit = Math.min(Math.max(options.limit ?? MAX_MESSAGES, 1), MAX_MESSAGES);
  const after = options.after ? text(options.after) : '';
  const select = `
    SELECT m.*, CASE WHEN m.sender_role = 'ADMIN' THEN 'Soporte NovaStore' ELSE COALESCE(u.name, 'Cliente') END AS sender_name
    FROM support_messages m
    LEFT JOIN users u ON u.id = m.sender_id
  `;
  const rows = after
    ? (db()
        .prepare(
          `${select} WHERE m.ticket_id = ? AND m.rowid > (SELECT rowid FROM support_messages WHERE id = ?) ORDER BY m.created_at ASC, m.rowid ASC LIMIT ?`
        )
        .all(ticketId, after, limit) as Row[])
    : (db()
        .prepare(`${select} WHERE m.ticket_id = ? ORDER BY m.created_at ASC, m.rowid ASC LIMIT ?`)
        .all(ticketId, limit) as Row[]);
  return rows.map(mapMessage);
}

export type AddMessageResult =
  | { ok: true; message: SupportMessage; status: SupportStatus }
  | { ok: false; error: string };

/**
 * Agrega un mensaje al hilo. El llamador ya comprobó los permisos:
 * un cliente solo llega aquí con su propio ticket; el administrador con cualquiera.
 */
export function addMessage(input: {
  ticketId: string;
  senderId: string;
  senderRole: ChatSenderRole;
  body: string;
}): AddMessageResult {
  const ticket = getTicket(input.ticketId);
  if (!ticket) return { ok: false, error: 'La conversación de soporte no existe.' };

  const body = cleanText(input.body, MAX_BODY);
  if (body.length < 1) return { ok: false, error: 'Escribe un mensaje antes de enviarlo.' };
  if (messagesInLastMinute(input.senderId) >= MAX_MESSAGES_PER_WINDOW) {
    return { ok: false, error: 'Estás enviando mensajes muy rápido. Espera unos segundos.' };
  }

  const messageId = id('smsg_');
  const stamp = now();
  const isAdmin = input.senderRole === 'ADMIN';

  // El administrador al responder mueve «Pendiente» a «En proceso»; si el cliente
  // vuelve a escribir sobre un caso resuelto, se reabre como «En proceso».
  let nextStatus: SupportStatus = ticket.status;
  if (isAdmin && ticket.status === 'PENDING') nextStatus = 'IN_PROGRESS';
  if (!isAdmin && ticket.status === 'RESOLVED') nextStatus = 'IN_PROGRESS';

  db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO support_messages (id, ticket_id, sender_role, sender_id, body, read_by_user, read_by_admin, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        messageId,
        input.ticketId,
        isAdmin ? 'ADMIN' : 'USER',
        input.senderId,
        body,
        isAdmin ? 0 : 1,
        isAdmin ? 1 : 0,
        stamp
      );

    db()
      .prepare('UPDATE support_tickets SET updated_at = ?, last_message_at = ?, status = ? WHERE id = ?')
      .run(stamp, stamp, nextStatus, input.ticketId);

    if (!isAdmin) {
      notifyAdmin(
        `Nuevo mensaje de soporte (${ticket.code})`,
        `${ticket.userName || 'Cliente'}: ${body.slice(0, 140)}`,
        `/admin/soporte?t=${input.ticketId}`
      );
    }
  })();

  const created = db()
    .prepare(
      `SELECT m.*, CASE WHEN m.sender_role = 'ADMIN' THEN 'Soporte NovaStore' ELSE COALESCE(u.name, 'Cliente') END AS sender_name
       FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
    )
    .get(messageId) as Row;

  const message = mapMessage(created);
  mirrorMessage(message);
  if (nextStatus !== ticket.status) mirrorStatus(input.ticketId, nextStatus);

  return { ok: true, message, status: nextStatus };
}

export function setStatus(ticketId: string, status: SupportStatus): { ok: boolean; error?: string } {
  const ticket = getTicket(ticketId);
  if (!ticket) return { ok: false, error: 'La solicitud no existe.' };
  db().prepare('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), ticketId);
  mirrorStatus(ticketId, status);
  return { ok: true };
}

/** Marca como leídos los mensajes del administrador (los que ve el cliente). */
export function markReadForUser(ticketId: string, userId: string): void {
  if (!getTicketForUser(ticketId, userId)) return;
  db()
    .prepare(
      "UPDATE support_messages SET read_by_user = 1 WHERE ticket_id = ? AND sender_role = 'ADMIN' AND read_by_user = 0"
    )
    .run(ticketId);
}

/** Marca como leídos los mensajes del cliente (los que ve el administrador). */
export function markReadForAdmin(ticketId: string): void {
  if (!getTicket(ticketId)) return;
  db()
    .prepare(
      "UPDATE support_messages SET read_by_admin = 1 WHERE ticket_id = ? AND sender_role = 'USER' AND read_by_admin = 0"
    )
    .run(ticketId);
}

/** Respuestas sin leer para el cliente: alimenta el aviso del menú. */
export function unreadForUser(userId: string): number {
  if (!userId) return 0;
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS total FROM support_messages m
       JOIN support_tickets t ON t.id = m.ticket_id
       WHERE t.user_id = ? AND m.sender_role = 'ADMIN' AND m.read_by_user = 0`
    )
    .get(userId) as Row;
  return count(row.total);
}

/** Mensajes de clientes sin leer para el administrador. */
export function unreadForAdmin(): number {
  const row = db()
    .prepare("SELECT COUNT(*) AS total FROM support_messages WHERE sender_role = 'USER' AND read_by_admin = 0")
    .get() as Row;
  return count(row.total);
}

/** Resumen para la cabecera del panel de soporte. */
export function supportSummary(): { total: number; pending: number; unread: number } {
  const row = db().prepare('SELECT COUNT(*) AS total FROM support_tickets').get() as Row;
  const counts = supportStatusCounts();
  return { total: count(row.total), pending: counts.PENDING, unread: unreadForAdmin() };
}
