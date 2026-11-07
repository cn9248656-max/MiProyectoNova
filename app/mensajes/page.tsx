import Link from 'next/link';
import { redirect } from 'next/navigation';
import ChatPanel from '../../components/ChatPanel';
import { getCurrentUser } from '../../lib/auth';
import * as chat from '../../lib/chat';
import { formatDate } from '../../lib/money';
import { getSettings, listOrders } from '../../lib/store';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/mensajes');

  const conversation = chat.conversationForUser(user.id);
  if (!conversation) redirect('/');

  chat.markReadForUser(conversation.id);
  const messages = chat.listMessages(conversation.id);
  const settings = getSettings();
  const orders = listOrders(user.id).slice(0, 6);
  const withData = orders.filter((order) => order.customerData);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Mensajes</h1>
          <p className="page-subtitle">
            Chat privado con {settings.storeName}. Aquí recibes los datos de acceso de tus productos digitales.
          </p>
        </div>
        <Link className="btn btn--ghost btn--sm" href="/compras">
          Ver mis compras
        </Link>
      </div>

      <div className="grid-2 grid-2--chat">
        <ChatPanel
          conversationId={conversation.id}
          initialMessages={messages}
          role="USER"
          partnerName={`Soporte ${settings.storeName}`}
          emptyHint="Escribe tu primera consulta. El administrador recibirá una notificación y te responderá por aquí."
        />

        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <h2 className="card__title">Datos de entrega enviados</h2>
            <p className="hint" style={{ marginTop: 0 }}>
              El administrador usa estos datos para entregar tus productos. Puedes corregirlos desde el detalle de cada
              pedido.
            </p>

            {withData.length === 0 ? (
              <p className="tiny muted" style={{ marginBottom: 0 }}>
                Aún no has enviado datos de entrega. Al comprar puedes indicar tu ID de jugador y otros datos.
              </p>
            ) : (
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                {withData.map((order) => (
                  <div key={order.id} className="mini-block">
                    <div className="row row--between">
                      <Link className="link mono tiny" href={`/compras/${order.id}`}>
                        {order.code}
                      </Link>
                      <span className="tiny muted">{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="kv">
                      <span>ID / jugador</span>
                      <strong className="mono">{order.customerData?.playerId || '—'}</strong>
                    </div>
                    {order.customerData?.details ? (
                      <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                        {order.customerData.details}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="card__title">Pedidos recientes</h2>
            {orders.length === 0 ? (
              <p className="tiny muted" style={{ marginBottom: 0 }}>
                Todavía no tienes pedidos.
              </p>
            ) : (
              <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                {orders.map((order) => (
                  <Link key={order.id} className="mini-row" href={`/compras/${order.id}`}>
                    <span className="mono tiny">{order.code}</span>
                    <span className="tiny muted">{(order.items ?? []).length} artículo(s)</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
