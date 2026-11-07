import { NextResponse } from 'next/server';
import { getAdminUser, getCurrentUser } from '../../../lib/auth';
import * as chat from '../../../lib/chat';

export const dynamic = 'force-dynamic';

/**
 * Mensajes en vivo del chat. El cliente siempre queda limitado a su propia
 * conversación; el administrador puede leer cualquiera indicándola.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const admin = await getAdminUser();
  const user = admin ?? (await getCurrentUser());
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let conversationId = url.searchParams.get('conversation') || '';
  if (!admin) {
    const own = chat.conversationForUser(user.id);
    if (!own) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    conversationId = own.id;
  }
  if (!conversationId) return NextResponse.json({ error: 'missing_conversation' }, { status: 400 });

  const conversation = chat.getConversation(conversationId);
  if (!conversation) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const after = url.searchParams.get('after');
  const messages = chat.listMessages(conversationId, after);

  if (admin) chat.markReadForAdmin(conversationId);
  else chat.markReadForUser(conversationId);

  return NextResponse.json(
    {
      conversationId,
      messages,
      unreadForAdmin: chat.unreadForAdmin(),
      unreadForUser: admin ? 0 : chat.unreadForUser(user.id),
      serverTime: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
