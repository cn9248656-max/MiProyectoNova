import Link from 'next/link';
import { updateOrderStatusAction } from '../../../app/actions';
import { formatDate, formatMoney } from '../../../lib/money';
import { getOrder, getSettings, listAllOrders } from '../../../lib/store';
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../lib/types';
import type { OrderStatus } from '../../../lib/types';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'status status--pending',
  APPROVED: 'status status--approved',
  SENT: 'status status--sent',
  COMPLETED: 'status status--completed',
  CANCELLED: 'status status--cancelled',
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobados' },
  { value: 'SENT', label: 'Enviados' },
  { value: 'COMPLETED', label: 'Completados' },
  { value: 'CANCELLED', label: 'Cancelados' },
];

const NEXT_STATUS: Record<string, Array<{ value: OrderStatus; label: string }>> = {
  PENDING: [
    { value: 'APPROVED', label: 'Aprobar' },
    { value: 'CANCELLED', label: 'Cancelar' },
  ],
  APPROVED: [{ value: 'SENT', label: 'Marcar enviado' }],
  SENT: [{ value: 'COMPLETED', label: 'Completar' }],
  COMPLETED: [],
  CANCELLED: [],
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ok?: string; error?: string }>;
}) {
  const query = await searchParams;
  const settings = getSettings();
  const status = query.status as OrderStatus | undefined;
  const orders = listAllOrders(status || undefined);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">Revisa pagos y actualiza el estado de cada pedido.</p>
        </div>
      </div>

      {query.ok ? <div className="alert alert--success">{query.ok}</div> : null}
      {query.error ? <div className="alert alert--error">{query.error}</div> : null}

      <div className="chips">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value || 'all'}
            href={filter.value ? `/admin/pedidos?status=${filter.value}` : '/admin/pedidos'}
            className="chip-filter"
            data-active={(status || '') === filter.value}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">🧾</div>
          <h3>No hay pedidos en este estado</h3>
          <p>Los pedidos de los clientes aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="stack">
          {orders.map((order) => {
            const detail = getOrder(order.id);
            return (
              <article key={order.id} className="card">
                <div className="row row--between row--wrap" style={{ gap: 12 }}>
                  <div>
                    <div className="row" style={{ gap: 10 }}>
                      <strong>{order.code}</strong>
                      <span className={STATUS_CLASS[order.status] || 'status'}>{ORDER_STATUS_LABEL[order.status]}</span>
                    </div>
                    <div className="tiny muted">
                      {order.userName || 'Cliente'} · {order.userEmail || ''} · {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <strong className="mono">{formatMoney(order.totalCents, settings.currency)}</strong>
                      <div className="tiny muted">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</div>
                    </div>
                  </div>
                </div>

                <details className="details-panel" style={{ marginTop: 12 }}>
                  <summary>Ver detalle y gestionar</summary>

                  <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                    {(detail?.items || []).map((item) => (
                      <div key={item.id} className="row row--between">
                        <span>
                          {item.quantity} × {item.name}
                        </span>
                        <span className="mono tiny">{formatMoney(item.priceCents * item.quantity, settings.currency)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="divider" />
                  <div className="kv">
                    <span>Estado del pago</span>
                    <strong>
                      {order.paymentStatus === 'PAID'
                        ? 'Pagado'
                        : order.paymentStatus === 'REFUNDED'
                          ? 'Reembolsado'
                          : 'Pendiente de verificación'}
                    </strong>
                  </div>
                  {order.reference ? (
                    <div className="kv">
                      <span>Referencia Agora</span>
                      <strong>{order.reference}</strong>
                    </div>
                  ) : null}
                  {order.note ? (
                    <div className="kv">
                      <span>Nota del cliente</span>
                      <strong>{order.note}</strong>
                    </div>
                  ) : null}

                  {NEXT_STATUS[order.status]?.length ? (
                    <form action={updateOrderStatusAction} className="form-actions" style={{ marginTop: 14 }}>
                      <input type="hidden" name="orderId" value={order.id} />
                      {NEXT_STATUS[order.status].map((option) => (
                        <button
                          key={option.value}
                          className={option.value === 'CANCELLED' ? 'btn btn--danger btn--sm' : 'btn btn--sm'}
                          type="submit"
                          name="status"
                          value={option.value}
                        >
                          {option.label}
                        </button>
                      ))}
                    </form>
                  ) : (
                    <p className="hint" style={{ marginBottom: 0 }}>
                      Este pedido no tiene más acciones disponibles.
                    </p>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
