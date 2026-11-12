'use server';

import { revalidatePath } from 'next/cache';
import { getAdminUser, getCurrentUser } from '../lib/auth';
import * as support from '../lib/support';
import { restoreSupportFromSupabase } from '../lib/support-supabase';
import type { ActionState } from '../lib/types';

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * Crea una solicitud de soporte. El autor sale de la sesión, nunca del formulario.
 */
export async function createSupportTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Inicia sesión para contactar con soporte.' };

  const result = support.createTicket({
    userId: user.id,
    subject: str(formData, 'subject'),
    category: str(formData, 'category'),
    message: str(formData, 'message'),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath('/soporte');
  revalidatePath('/admin/soporte');
  revalidatePath('/admin/notificaciones');
  return { success: `Solicitud ${result.ticket.code} enviada. Te responderemos en este mismo chat.` };
}

/** Mensaje del cliente: solo se acepta si la solicitud es suya. */
export async function sendSupportMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' };

  const ticketId = str(formData, 'ticketId');
  const ticket = support.getTicketForUser(ticketId, user.id);
  if (!ticket) return { error: 'No tienes acceso a esta conversación.' };

  const result = support.addMessage({
    ticketId,
    senderId: user.id,
    senderRole: 'USER',
    body: str(formData, 'body'),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath('/soporte');
  revalidatePath('/admin/soporte');
  return { success: 'Mensaje enviado.' };
}

/** Respuesta del administrador: requiere rol ADMIN verificado en el servidor. */
export async function adminReplySupportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: 'Solo un administrador autorizado puede responder desde el panel.' };

  const ticketId = str(formData, 'ticketId');
  if (!support.getTicket(ticketId)) return { error: 'La solicitud no existe.' };

  const result = support.addMessage({
    ticketId,
    senderId: admin.id,
    senderRole: 'ADMIN',
    body: str(formData, 'body'),
  });
  if (!result.ok) return { error: result.error };

  support.markReadForAdmin(ticketId);
  revalidatePath('/admin/soporte');
  revalidatePath('/soporte');
  return { success: 'Respuesta enviada al cliente.' };
}

/** Cambia el estado (Pendiente / En proceso / Resuelto). Solo administradores. */
export async function adminSetSupportStatusAction(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const ticketId = str(formData, 'ticketId');
  const status = support.normalizeStatus(str(formData, 'status'));
  if (!ticketId || !status) return;

  support.setStatus(ticketId, status);
  revalidatePath('/admin/soporte');
  revalidatePath('/soporte');
}

/** Recupera desde Supabase lo que falte en la base local (solo agrega). */
export async function adminSyncSupportAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: 'Solo el administrador puede sincronizar el soporte.' };

  const result = await restoreSupportFromSupabase();
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin/soporte');
  return {
    success: `Sincronizado con Supabase: ${result.tickets} solicitudes y ${result.messages} mensajes recuperados.`,
  };
}
