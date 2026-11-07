import Link from 'next/link';
import { formatDate, formatMoney } from '../../lib/money';
import {
  adminStats,
  getSettings,
  listAllOrders,
  listAllTopups,
  listNotifications,
  listProductRequests,
} from '../../lib/store';
import { ORDER_STATUS_LABEL, TOPUP_STATUS_LABEL } from '../../lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const settings = getSettings();
  const stats = adminStats();
  const pendingOrders = listAllOrders('PENDING').slice(0, 5);
  const pendingTopups = listAllTopups('PENDING').slice(0, 5);
  const requests = listProductRequests().filter((request) => request.status === 'OPEN').slice(0, 5);
  const notifications = listNotifications(6);

  const cards = [
    { label: 'Usuarios', value: String(stats.users), href: '/admin/usuarios', hint: 'clientes y administradores' },
    { label: 'Productos', value: String(stats.products), href: '/admin/productos', hint: `${stats.lowStock} con stock bajo` },
    { label: 'Pedidos pendientes', value: String(stats.pendingOrders), href: '/admin/pedidos', hint: 'requieren revisión' },
    { label: 'Recargas pendientes', value: String(stats.pendingTopups), href: '/admin/recargas', hint: 'esperando aprobación' },
    { label: 'Solicitudes', value: String(stats.openRequests), href: '/admin/solicitudes', hint: 'productos pedidos por clientes' },
    { label: 'Ingresos', value: formatMoney(stats.revenueCents, settings.currency), href: '/admin/pedidos', hint: 'pedidos aprobados o completados' },
  ];

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Resumen de la tienda</h1>
          <p className="page-subtitle">Control de productos, pagos, recargas y clientes.</p>
        </div>
        <Link className="btn btn--sm" href="/admin/productos">
          Nuevo producto
        </Link>
      </div>

      {settings.maintenance ? (
        <div className="alert alert--info">
          La tienda está en <strong>modo mantenimiento</strong>. Los clientes ven la pantalla de mantenimiento.
          <Link className="link" href="/admin/configuracion">
            {' '}
            Cambiar
          </Link>
        </div>
      ) : null}

      <div className="stat-grid">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="stat card">
            <span className="stat__label">{card.label}</span>
            <strong className="stat__value">{card.value}</strong>
            <span className="tiny muted">{card.hint}</span>
          </Link>
        ))}
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="row row--between">
            <h2 className="card__title" style={{ margin: 0 }}>
              Pedidos pendientes
            </h2>
            <Link className="link tiny" href="/admin/pedidos">
              Ver todos
            </Link>
          </div>
          {pendingOrders.length === 0 ? (
            <p className="hint">No hay pedidos pendientes.</p>
          ) : (
            <div className="stack" style={{ gap: 8, marginTop: 12 }}>
              {pendingOrders.map((order) => (
                <div key={order.id} className="row row--between" style={{ gap: 10 }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{order.code}</strong>
                    <div className="tiny muted">
                      {order.userName || 'Cliente'} · {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="mono tiny">{formatMoney(order.totalCents, settings.currency)}</span>
                    <span className="status status--pending">{ORDER_STATUS_LABEL[order.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="row row--between">
            <h2 className="card__title" style={{ margin: 0 }}>
              Recargas por aprobar
            </h2>
            <Link className="link tiny" href="/admin/recargas">
              Gestionar
            </Link>
          </div>
          {pendingTopups.length === 0 ? (
            <p className="hint">No hay recargas pendientes.</p>
          ) : (
            <div className="stack" style={{ gap: 8, marginTop: 12 }}>
              {pendingTopups.map((topup) => (
                <div key={topup.id} className="row row--between" style={{ gap: 10 }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{topup.userName || topup.userEmail || 'Cliente'}</strong>
                    <div className="tiny muted">{formatDate(topup.createdAt)}</div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="mono tiny">{formatMoney(topup.amountCents, settings.currency)}</span>
                    <span className="status status--pending">{TOPUP_STATUS_LABEL[topup.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="row row--between">
            <h2 className="card__title" style={{ margin: 0 }}>
              Solicitudes de productos
            </h2>
            <Link className="link tiny" href="/admin/solicitudes">
              Ver todas
            </Link>
          </div>
          {requests.length === 0 ? (
            <p className="hint">No hay solicitudes abiertas.</p>
          ) : (
            <div className="stack" style={{ gap: 10, marginTop: 12 }}>
              {requests.map((request) => (
                <div key={request.id}>
                  <strong style={{ fontSize: 14 }}>{request.productName}</strong>
                  <div className="tiny muted">
                    {request.userName || request.userEmail || 'Cliente'} · {formatDate(request.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="row row--between">
            <h2 className="card__title" style={{ margin: 0 }}>
              Actividad reciente
            </h2>
            <Link className="link tiny" href="/admin/notificaciones">
              Notificaciones
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="hint">Sin actividad nueva.</p>
          ) : (
            <div className="stack" style={{ gap: 8, marginTop: 12 }}>
              {notifications.map((notification) => (
                <div key={notification.id} className="row row--between" style={{ gap: 10 }}>
                  <div>
                    <strong style={{ fontSize: 13 }}>{notification.title}</strong>
                    <div className="tiny muted">{notification.body}</div>
                  </div>
                  <span className="tiny muted">{formatDate(notification.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card card--flat">
        <h2 className="card__title">Billeteras de clientes</h2>
        <p className="hint" style={{ marginBottom: 0 }}>
          Saldo total en billeteras: <strong className="mono">{formatMoney(stats.walletTotalCents, settings.currency)}</strong>
        </p>
      </section>
    </div>
  );
}
