import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';
import { formatDate, formatMoney } from '../../lib/money';
import { getSettings, listOrders } from '../../lib/store';
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../lib/types';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'status status--pending',
  APPROVED: 'status status--approved',
  SENT: 'status status--sent',
  COMPLETED: 'status status--completed',
  CANCELLED: 'status status--cancelled',
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/compras');

  const settings = getSettings();
  const orders = listOrders(user.id);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Mis compras</h1>
          <p className="page-subtitle">Historial de pedidos y estado de cada entrega.</p>
        </div>
        <Link className="btn btn--ghost btn--sm" href="/">
          Seguir comprando
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">🧾</div>
          <h3>Todavía no tienes compras</h3>
          <p>Cuando confirmes un pedido aparecerá aquí con su estado en tiempo real.</p>
          <Link className="btn" href="/">
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="stack">
          {orders.map((order) => (
            <Link key={order.id} href={`/compras/${order.id}`} className="list-item list-item--link">
              <div className="list-item__thumb">
                <span>#{order.code.slice(-3)}</span>
              </div>
              <div className="list-item__main">
                <span className="list-item__title">Pedido {order.code}</span>
                <span className="list-item__meta">
                  {formatDate(order.createdAt)} · {order.itemsCount} {order.itemsCount === 1 ? 'artículo' : 'artículos'} ·{' '}
                  {PAYMENT_METHOD_LABEL[order.paymentMethod]}
                </span>
              </div>
              <div className="row" style={{ gap: 12 }}>
                <strong className="mono">{formatMoney(order.totalCents, settings.currency)}</strong>
                <span className={STATUS_CLASS[order.status] || 'status'}>{ORDER_STATUS_LABEL[order.status]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
