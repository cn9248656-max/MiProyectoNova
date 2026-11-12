import { NextResponse } from 'next/server';
import { getAdminUser, getCurrentUser } from '../../../lib/auth';
import * as support from '../../../lib/support';

export const dynamic = 'force-dynamic';

/**
 * Mensajes en vivo del soporte.
 * Un cliente solo puede pedir sus propias solicitudes: si el ticket es de otra
 * persona la respuesta es 404, sin revelar que existe.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const admin = await getAdminUser();
  const user = admin ?? (await getCurrentUser());
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ticketId = url.searchParams.get('ticket') || '';
  const ticket = admin ? support.getTicket(ticketId) : support.getTicketForUser(ticketId, user.id);
  if (!ticket) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const after = url.searchParams.get('after');
  const messages = support.listMessages(ticket.id, after ? { after } : {});

  if (admin) support.markReadForAdmin(ticket.id);
  else support.markReadForUser(ticket.id, user.id);

  return NextResponse.json(
    {
      ticketId: ticket.id,
      status: ticket.status,
      messages,
      unreadForUser: admin ? 0 : support.unreadForUser(user.id),
      unreadForAdmin: admin ? support.unreadForAdmin() : 0,
      serverTime: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
