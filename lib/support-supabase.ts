/**
 * Compatibilidad con el espejo de soporte anterior.
 *
 * El soporte al cliente ya no se replica por separado: forma parte del motor
 * general de persistencia (lib/supabase-sync.ts), que envía support_tickets y
 * support_messages junto con el resto de la tienda. Este módulo mantiene las
 * mismas funciones públicas para no romper los imports existentes, pero deja
 * de duplicar escrituras (dos escritores sobre la misma fila se pisarían).
 *
 * El esquema y las políticas RLS están en supabase/soporte.sql y
 * supabase/persistencia.sql.
 */
import type { SupportMessage, SupportStatus, SupportTicket } from './types';
import { syncEnabled } from './supabase-db';

/** ¿Hay persistencia en Supabase configurada en el servidor? */
export function supabaseSupportEnabled(): boolean {
  return syncEnabled();
}

/** Ya lo envía el motor general: aquí no se duplica. */
export function mirrorTicket(ticket: SupportTicket): void {
  void ticket;
}

/** Ya lo envía el motor general: aquí no se duplica. */
export function mirrorMessage(message: SupportMessage): void {
  void message;
}

/** Ya lo envía el motor general: aquí no se duplica. */
export function mirrorStatus(ticketId: string, status: SupportStatus): void {
  void ticketId;
  void status;
}

/**
 * Restaura solicitudes y mensajes desde Supabase. Se conserva la firma previa,
 * pero ahora restaura TODAS las tablas (usuarios, productos, pedidos...), no
 * solo soporte, para que un contenedor nuevo recupere la tienda completa.
 */
export async function restoreSupportFromSupabase(): Promise<
  { ok: true; tickets: number; messages: number } | { ok: false; error: string }
> {
  if (!syncEnabled()) {
    return {
      ok: false,
      error:
        'La persistencia en Supabase no está configurada en el servidor. Revisa SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SYNC_SECRET en Settings → Environment variables.',
    };
  }

  const { db } = await import('./db');
  const { pullAllSync } = await import('./supabase-sync');
  const report = pullAllSync(db());
  if (!report.ok) {
    return { ok: false, error: report.errors.join(' · ').slice(0, 400) || 'No se pudo restaurar desde Supabase.' };
  }
  return {
    ok: true,
    tickets: report.tables.support_tickets ?? 0,
    messages: report.tables.support_messages ?? 0,
  };
}
