import Link from 'next/link';
import { redirect } from 'next/navigation';
import ChatPanel from '../../../components/ChatPanel';
import { getAdminUser } from '../../../lib/auth';
import * as chat from '../../../lib/chat';
import { formatDate, formatMoney } from '../../../lib/money';
import { getSettings, getUserById, listOrders } from '../../../lib/store';
import { ORDER_STATUS_LABEL } from '../../../lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin/mensajes');

  const settings = getSettings();
  const conversations = chat.listConversations();
  const query = await searchParams;
  const requested = query.c || '';
  const selectedId = conversations.some((item) => item.id === requested)
    ? requested
    : conversations[0]?.id || '';

  const selected = selectedId ? chat.getConversation(selectedId) : null;
  if (selected) chat.markReadForAdmin(selected.id);

  const messages = selected ? chat.listMessages(selected.id) : [];
  const client = selected ? getUserById(selected.userId) : null;
  const orders = selected ? listOrders(selected.userId) : [];
  const deliveryOrders = orders.filter((order) => order.customerData);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Mensajes</h1>
          <p className="page-subtitle">
            Chat privado con cada cliente, con sus datos de entrega y compras a la vista.
          </p>
        </div>
        <Link className="btn btn--ghost btn--sm" href="/admin/pedidos">
          Ir a pedidos
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">💬</div>
          <h3>Sin conversaciones todavía</h3>
          <p>Cuando un cliente compre o escriba, su chat privado aparecerá aquí.</p>
        </div>
      ) : (
        <div className="chat-layout">
          <aside className="card card--flat chat-list">
            <h2 className="card__title">Clientes ({conversations.length})</h2>
            <div className="stack" style={{ gap: 6 }}>
              {conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/admin/mensajes?c=${conversation.id}`}
                  className="chat-list__item"
                  data-active={conversation.id === selectedId}
                >
                  <span className="avatar" style={{ width: 34, height: 34, fontSize: 14 }}>
                    {conversation.userName.trim().charAt(0).toUpperCase() || 'C'}
                  </span>
                  <span className="chat-list__body">
                    <strong>{conversation.userName}</strong>
                    <span className="tiny muted">
                      {conversation.lastMessage
                        ? conversation.lastMessage.slice(0, 46)
                        : 'Sin mensajes todavía'}
                    </span>
                  </span>
                  {conversation.unreadForAdmin > 0 ? (
                    <span className="badge-count">{conversation.unreadForAdmin}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          </aside>

          <div className="stack" style={{ gap: 16 }}>
            {selected ? (
              <>
                <section className="card card--flat">
                  <div className="row row--between row--wrap">
                    <div>
                      <h2 className="card__title" style={{ margin: 0 }}>
                        {client?.name || selected.userName}
                      </h2>
                      <p className="tiny muted" style={{ margin: 0 }}>
                        {client?.email || selected.userEmail}
                        {client?.phone ? ` · ${client.phone}` : ''}
                      </p>
                    </div>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="pill mono">
                        Saldo: {formatMoney(client?.balanceCents ?? 0, settings.currency)}
                      </span>
                      <span className="pill">{orders.length} pedido(s)</span>
                    </div>
                  </div>

                  <div className="divider" />

                  <h3 className="tiny muted" style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Datos enviados por el cliente
                  </h3>

                  {deliveryOrders.length === 0 ? (
                    <p className="tiny muted" style={{ marginBottom: 0 }}>
                      Este cliente aún no ha enviado ID de jugador ni datos de entrega.
                    </p>
                  ) : (
                    <div className="stack" style={{ gap: 10 }}>
                      {deliveryOrders.map((order) => (
                        <div key={order.id} className="mini-block">
                          <div className="row row--between row--wrap" style={{ gap: 8 }}>
                            <Link className="link mono tiny" href={`/admin/pedidos`}>
                              {order.code}
                            </Link>
                            <span className="status status--sm">{ORDER_STATUS_LABEL[order.status]}</span>
                            <span className="tiny muted">{formatDate(order.createdAt)}</span>
                          </div>
                          <div className="kv">
                            <span>ID / jugador</span>
                            <strong className="mono">{order.customerData?.playerId || '—'}</strong>
                          </div>
                          {order.customerData?.details ? (
                            <div className="kv">
                              <span>Otros datos</span>
                              <strong>{order.customerData.details}</strong>
                            </div>
                          ) : null}
                          <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                            {order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')} —{' '}
                            {formatMoney(order.totalCents, settings.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <ChatPanel
                  conversationId={selected.id}
                  initialMessages={messages}
                  role="ADMIN"
                  partnerName={client?.name || selected.userName}
                  emptyHint="Escribe al cliente los datos de acceso o cualquier información de su pedido. Recibirá el mensaje en su chat."
                />
              </>
            ) : (
              <div className="empty">
                <div className="empty__icon">💬</div>
                <h3>Selecciona una conversación</h3>
                <p>Elige un cliente de la lista para ver sus datos y chatear.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
