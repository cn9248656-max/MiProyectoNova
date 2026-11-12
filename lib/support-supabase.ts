/**
 * Puente opcional con Supabase para el soporte al cliente.
 *
 * SOLO SERVIDOR. Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del entorno del
 * proceso: la service role key nunca se expone al navegador (no se usa ninguna
 * variable NEXT_PUBLIC_*). Si la clave no está configurada, todas las funciones
 * devuelven «no disponible» y la tienda sigue funcionando con su base SQLite.
 *
 * El esquema y las políticas RLS están en supabase/soporte.sql.
 */
import type { SupportMessage, SupportStatus, SupportTicket } from './types';

const TIMEOUT_MS = 6000;
const TICKETS_TABLE = 'support_tickets';
const MESSAGES_TABLE = 'support_messages';

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

export function supabaseSupportEnabled(): boolean {
  return config() !== null;
}

async function request(path: string, init: RequestInit = {}): Promise<Response | null> {
  const current = config();
  if (!current) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${current.url}/rest/v1/${path}`, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        apikey: current.key,
        Authorization: `Bearer ${current.key}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    console.warn('[nova] Supabase no respondió (soporte):', (error as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Replica una solicitud. Nunca lanza: si falla, la copia local sigue siendo válida. */
export function mirrorTicket(ticket: SupportTicket): void {
  if (!supabaseSupportEnabled()) return;
  void request(`${TICKETS_TABLE}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([
      {
        id: ticket.id,
        code: ticket.code,
        user_ref: ticket.userId,
        subject: ticket.subject,
        category: ticket.category,
        status: ticket.status,
        created_at: ticket.createdAt,
        updated_at: ticket.updatedAt,
        last_message_at: ticket.lastMessageAt,
      },
    ]),
  }).then((response) => {
    if (response && !response.ok) {
      console.warn('[nova] No se pudo replicar la solicitud en Supabase:', response.status);
    }
  });
}

export function mirrorMessage(message: SupportMessage): void {
  if (!supabaseSupportEnabled()) return;
  void request(`${MESSAGES_TABLE}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([
      {
        id: message.id,
        ticket_id: message.ticketId,
        sender_role: message.senderRole,
        body: message.body,
        read_by_user: message.readByUser,
        read_by_admin: message.readByAdmin,
        created_at: message.createdAt,
      },
    ]),
  }).then((response) => {
    if (response && !response.ok) {
      console.warn('[nova] No se pudo replicar el mensaje en Supabase:', response.status);
    }
  });
}

export function mirrorStatus(ticketId: string, status: SupportStatus): void {
  if (!supabaseSupportEnabled()) return;
  void request(`${TICKETS_TABLE}?id=eq.${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  }).then((response) => {
    if (response && !response.ok) {
      console.warn('[nova] No se pudo actualizar el estado en Supabase:', response.status);
    }
  });
}

/**
 * Recupera desde Supabase las solicitudes y mensajes que falten en la base local.
 * Solo agrega (ignora lo que ya existe): nunca borra ni sobrescribe historial.
 */
export async function restoreSupportFromSupabase(): Promise<
  { ok: true; tickets: number; messages: number } | { ok: false; error: string }
> {
  if (!supabaseSupportEnabled()) {
    return {
      ok: false,
      error:
        'Supabase no está configurado en el servidor. Añade SUPABASE_SERVICE_ROLE_KEY en Settings → Environment variables y vuelve a intentarlo.',
    };
  }

  const { db } = await import('./db');
  const ticketResponse = await request(`${TICKETS_TABLE}?select=*&order=created_at.asc&limit=2000`);
  if (!ticketResponse) return { ok: false, error: 'No se pudo conectar con Supabase.' };
  if (!ticketResponse.ok) {
    return {
      ok: false,
      error: `Supabase respondió ${ticketResponse.status}. Revisa el esquema y la clave del servidor.`,
    };
  }

  const ticketRows = (await ticketResponse.json()) as Array<Record<string, unknown>>;
  let tickets = 0;
  let messages = 0;

  const insertTicket = db().prepare(
    `INSERT OR IGNORE INTO support_tickets (id, code, user_id, subject, category, status, created_at, updated_at, last_message_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const row of ticketRows) {
    const userId = String(row.user_ref ?? '');
    const exists = db().prepare('SELECT 1 AS ok FROM users WHERE id = ?').get(userId);
    if (!exists) continue;
    const info = insertTicket.run(
      String(row.id ?? ''),
      String(row.code ?? ''),
      userId,
      String(row.subject ?? ''),
      String(row.category ?? 'QUESTION'),
      String(row.status ?? 'PENDING'),
      String(row.created_at ?? new Date().toISOString()),
      String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
      row.last_message_at ? String(row.last_message_at) : null
    );
    tickets += info.changes;
  }

  const messageResponse = await request(`${MESSAGES_TABLE}?select=*&order=created_at.asc&limit=5000`);
  if (messageResponse && messageResponse.ok) {
    const messageRows = (await messageResponse.json()) as Array<Record<string, unknown>>;
    const insertMessage = db().prepare(
      `INSERT OR IGNORE INTO support_messages (id, ticket_id, sender_role, sender_id, body, read_by_user, read_by_admin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of messageRows) {
      const ticketId = String(row.ticket_id ?? '');
      const ticket = db().prepare('SELECT user_id FROM support_tickets WHERE id = ?').get(ticketId) as
        | { user_id: string }
        | undefined;
      if (!ticket) continue;
      const isAdmin = String(row.sender_role ?? 'USER') === 'ADMIN';
      const info = insertMessage.run(
        String(row.id ?? ''),
        ticketId,
        isAdmin ? 'ADMIN' : 'USER',
        isAdmin ? 'admin' : ticket.user_id,
        String(row.body ?? ''),
        Number(row.read_by_user ?? 0) ? 1 : 0,
        Number(row.read_by_admin ?? 0) ? 1 : 0,
        String(row.created_at ?? new Date().toISOString())
      );
      messages += info.changes;
    }
  }

  return { ok: true, tickets, messages };
}
