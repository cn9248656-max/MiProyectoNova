import { db, id, now } from './db';
import type { ChatMessage, ChatSenderRole, Conversation } from './types';

type Row = Record<string, unknown>;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : Number(value ?? fallback) || fallback;
}

const MAX_BODY = 2000;

function mapMessage(row: Row): ChatMessage {
  return {
    id: str(row.id),
    conversationId: str(row.conversation_id),
    senderRole: str(row.sender_role, 'USER') as ChatSenderRole,
    senderName: str(row.sender_name, ''),
    body: str(row.body),
    readByUser: num(row.read_by_user) === 1,
    readByAdmin: num(row.read_by_admin) === 1,
    createdAt: str(row.created_at),
  };
}

const MESSAGE_SELECT = `
  SELECT m.*, (SELECT name FROM users u WHERE u.id = m.sender_id) AS sender_name
  FROM messages m
`;

/** Cada cliente tiene exactamente una conversación privada con el administrador. */
export function ensureConversation(userId: string): string {
  const existing = db().prepare('SELECT id FROM conversations WHERE user_id = ?').get(userId) as
    | { id: string }
    | undefined;
  if (existing) return existing.id;

  const conversationId = id('conv_');
  const stamp = now();
  db()
    .prepare(
      'INSERT INTO conversations (id, user_id, created_at, updated_at, last_message_at) VALUES (?,?,?,?,NULL)'
    )
    .run(conversationId, userId, stamp, stamp);
  return conversationId;
}

export function conversationForUser(userId: string): Conversation | null {
  const conversationId = ensureConversation(userId);
  const row = db()
    .prepare(
      `SELECT c.*, u.name AS user_name, u.email AS user_email,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'USER' AND m.read_by_admin = 0) AS unread_for_admin,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'ADMIN' AND m.read_by_user = 0) AS unread_for_user,
         (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message
       FROM conversations c JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`
    )
    .get(conversationId) as Row | undefined;
  return row ? mapConversation(row) : null;
}

export function getConversation(conversationId: string): Conversation | null {
  const row = db()
    .prepare(
      `SELECT c.*, u.name AS user_name, u.email AS user_email,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'USER' AND m.read_by_admin = 0) AS unread_for_admin,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'ADMIN' AND m.read_by_user = 0) AS unread_for_user,
         (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message
       FROM conversations c JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`
    )
    .get(conversationId) as Row | undefined;
  return row ? mapConversation(row) : null;
}

function mapConversation(row: Row): Conversation {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    userName: str(row.user_name, 'Cliente'),
    userEmail: str(row.user_email),
    createdAt: str(row.created_at),
    lastMessageAt: (row.last_message_at as string | null) ?? null,
    lastMessage: (row.last_message as string | null) ?? null,
    unreadForAdmin: num(row.unread_for_admin),
    unreadForUser: num(row.unread_for_user),
    messageCount: num(row.message_count),
  };
}

/** Historial completo (o incremental con `afterId`) de una conversación. */
export function listMessages(conversationId: string, afterId?: string | null, limit = 300): ChatMessage[] {
  const rows = afterId
    ? (db()
        .prepare(`${MESSAGE_SELECT} WHERE m.conversation_id = ? AND m.rowid > (SELECT rowid FROM messages WHERE id = ?) ORDER BY m.created_at ASC, m.rowid ASC LIMIT ?`)
        .all(conversationId, afterId, limit) as Row[])
    : (db()
        .prepare(`${MESSAGE_SELECT} WHERE m.conversation_id = ? ORDER BY m.created_at ASC, m.rowid ASC LIMIT ?`)
        .all(conversationId, limit) as Row[]);
  return rows.map(mapMessage);
}

export function sendMessage(input: {
  conversationId: string;
  senderId: string;
  senderRole: ChatSenderRole;
  body: string;
}): { ok: true; message: ChatMessage } | { ok: false; error: string } {
  const body = input.body.replace(/\r\n/g, '\n').trim();
  if (!body) return { ok: false, error: 'Escribe un mensaje antes de enviarlo.' };
  if (body.length > MAX_BODY) return { ok: false, error: `El mensaje no debe superar ${MAX_BODY} caracteres.` };

  const conversation = db()
    .prepare('SELECT id, user_id FROM conversations WHERE id = ?')
    .get(input.conversationId) as { id: string; user_id: string } | undefined;
  if (!conversation) return { ok: false, error: 'La conversación ya no existe.' };

  const messageId = id('msg_');
  const stamp = now();

  const tx = db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO messages (id, conversation_id, sender_role, sender_id, body, read_by_user, read_by_admin, created_at)
         VALUES (?,?,?,?,?,?,?,?)`
      )
      .run(
        messageId,
        conversation.id,
        input.senderRole,
        input.senderId,
        body,
        input.senderRole === 'USER' ? 1 : 0,
        input.senderRole === 'ADMIN' ? 1 : 0,
        stamp
      );
    db().prepare('UPDATE conversations SET updated_at = ?, last_message_at = ? WHERE id = ?').run(
      stamp,
      stamp,
      conversation.id
    );
  });
  tx();

  if (input.senderRole === 'USER') {
    const user = db().prepare('SELECT name FROM users WHERE id = ?').get(conversation.user_id) as
      | { name: string }
      | undefined;
    db()
      .prepare('INSERT INTO notifications (id, type, title, message, link, read, created_at) VALUES (?,?,?,?,?,0,?)')
      .run(
        id('ntf_'),
        'CHAT',
        `Nuevo mensaje de ${user?.name || 'un cliente'}`,
        body.slice(0, 160),
        `/admin/mensajes?c=${conversation.id}`,
        stamp
      );
  }

  const row = db().prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).get(messageId) as Row;
  return { ok: true, message: mapMessage(row) };
}

export function markReadForUser(conversationId: string): void {
  db()
    .prepare("UPDATE messages SET read_by_user = 1 WHERE conversation_id = ? AND sender_role = 'ADMIN' AND read_by_user = 0")
    .run(conversationId);
}

export function markReadForAdmin(conversationId: string): void {
  db()
    .prepare("UPDATE messages SET read_by_admin = 1 WHERE conversation_id = ? AND sender_role = 'USER' AND read_by_admin = 0")
    .run(conversationId);
}

export function unreadForUser(userId: string): number {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.user_id = ? AND m.sender_role = 'ADMIN' AND m.read_by_user = 0`
    )
    .get(userId) as Row;
  return num(row.c);
}

export function unreadForAdmin(): number {
  const row = db()
    .prepare("SELECT COUNT(*) AS c FROM messages WHERE sender_role = 'USER' AND read_by_admin = 0")
    .get() as Row;
  return num(row.c);
}

/** Lista de conversaciones para el panel administrador, con el último mensaje y no leídos. */
export function listConversations(): Conversation[] {
  const rows = db()
    .prepare(
      `SELECT c.*, u.name AS user_name, u.email AS user_email,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'USER' AND m.read_by_admin = 0) AS unread_for_admin,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'ADMIN' AND m.read_by_user = 0) AS unread_for_user,
         (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message
       FROM conversations c JOIN users u ON u.id = c.user_id
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`
    )
    .all() as Row[];
  return rows.map(mapConversation);
}
