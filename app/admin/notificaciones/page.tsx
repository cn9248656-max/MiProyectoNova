import Link from 'next/link';
import { markNotificationsReadAction } from '../../../app/actions';
import { formatDate } from '../../../lib/money';
import { listNotifications, unreadNotifications } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  const notifications = listNotifications(100);
  const unread = unreadNotifications();

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="page-subtitle">
            Avisos de compras, recargas y solicitudes de clientes. Sin leer: {unread}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markNotificationsReadAction}>
            <button className="btn btn--ghost btn--sm" type="submit">
              Marcar todo como leído
            </button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">🔔</div>
          <h3>Sin notificaciones</h3>
          <p>Cuando un cliente compre, recargue o pida un producto verás el aviso aquí.</p>
        </div>
      ) : (
        <div className="stack">
          {notifications.map((notification) => (
            <article key={notification.id} className="card card--flat" data-unread={!notification.read}>
              <div className="row row--between row--wrap" style={{ gap: 10 }}>
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{notification.title}</strong>
                    {!notification.read ? <span className="dot-unread" /> : null}
                  </div>
                  <p className="tiny muted" style={{ marginTop: 4 }}>
                    {notification.message}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tiny muted">{formatDate(notification.createdAt)}</span>
                  {notification.link ? (
                    <div>
                      <Link className="link tiny" href={notification.link}>
                        Abrir
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
