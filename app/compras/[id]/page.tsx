import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import OrderDeliveryForm from '../../../components/OrderDeliveryForm';
import { getCurrentUser } from '../../../lib/auth';
import { formatDate, formatMoney } from '../../../lib/money';
import { getOrder, getSettings } from '../../../lib/store';
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../lib/types';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'status status--pending',
  APPROVED: 'status status--approved',
  SENT: 'status status--sent',
  COMPLETED: 'status status--completed',
  CANCELLED: 'status status--cancelled',
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/compras');

  const { id } = await params;
  const order = getOrder(id, user.id);
  if (!order) notFound();

  const paramsQuery = await searchParams;
  const settings = getSettings();
  const flow = order.status === 'CANCELLED' ? ['PENDING', 'CANCELLED'] : ORDER_STATUS_FLOW;
  const currentIndex = flow.indexOf(order.status);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <Link className="link tiny" href="/compras">
        ← Volver a mis compras
      </Link>

      {paramsQuery.ok ? <div className="alert alert--success">{paramsQuery.ok}</div> : null}

      <div className="page-head">
        <div>
          <h1 className="page-title">Pedido {order.code}</h1>
          <p className="page-subtitle">
            Creado el {formatDate(order.createdAt)} · {PAYMENT_METHOD_LABEL[order.paymentMethod]}
          </p>
        </div>
        <span className={STATUS_CLASS[order.status] || 'status'}>{ORDER_STATUS_LABEL[order.status]}</span>
      </div>

      <section className="card">
        <h2 className="card__title">Estado del pedido</h2>
        <div className="timeline">
          {flow.map((status, index) => (
            <div
              key={status}
              className="timeline__step"
              data-active={index <= currentIndex}
              data-current={status === order.status}
            >
              <span className="badge-dot" />
              <span>{ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL]}</span>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          {order.status === 'PENDING'
            ? 'Tu pedido está pendiente. El administrador revisará el pago y lo aprobará.'
            : order.status === 'APPROVED'
              ? 'Pago aprobado. Estamos preparando la entrega digital.'
              : order.status === 'SENT'
                ? 'Producto enviado. Revisa tus datos de contacto para recibir la entrega.'
                : order.status === 'COMPLETED'
                  ? 'Pedido completado. ¡Gracias por comprar en NovaStore!'
                  : 'Este pedido fue cancelado. Si tienes dudas, contacta al administrador.'}
        </p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="card__title">Productos</h2>
          <div className="stack" style={{ gap: 10 }}>
            {(order.items || []).map((item) => (
              <div key={item.id} className="row row--between">
                <div>
                  <strong>{item.name}</strong>
                  <div className="tiny muted">
                    {item.quantity} × {formatMoney(item.priceCents, settings.currency)}
                  </div>
                </div>
                <span className="mono">{formatMoney(item.priceCents * item.quantity, settings.currency)}</span>
              </div>
            ))}
          </div>

          <div className="divider" />
          <div className="summary-row">
            <span>Subtotal</span>
            <span className="mono">{formatMoney(order.subtotalCents, settings.currency)}</span>
          </div>
          <div className="summary-row summary-row--total">
            <span>Total</span>
            <strong className="mono">{formatMoney(order.totalCents, settings.currency)}</strong>
          </div>
        </section>

        <section className="card card--flat">
          <h2 className="card__title">Pago y entrega</h2>
          <div className="kv">
            <span>Método</span>
            <strong>{PAYMENT_METHOD_LABEL[order.paymentMethod]}</strong>
          </div>
          <div className="kv">
            <span>Estado del pago</span>
            <strong>
              {order.paymentStatus === 'PAID' ? 'Pagado' : order.paymentStatus === 'REFUNDED' ? 'Reembolsado' : 'Pendiente'}
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
              <span>Nota</span>
              <strong>{order.note}</strong>
            </div>
          ) : null}
          <p className="hint" style={{ marginBottom: 0 }}>
            {order.paymentMethod === 'AGORA' && order.paymentStatus !== 'PAID'
              ? 'El administrador verificará tu pago por Agora antes de aprobar el pedido.'
              : 'La entrega es digital y se gestiona desde el panel administrador.'}
          </p>
        </section>
      </div>

      <section className="card">
        <div className="row row--between row--wrap">
          <h2 className="card__title" style={{ margin: 0 }}>
            Datos de entrega
          </h2>
          <Link className="btn btn--ghost btn--sm" href="/mensajes">
            Hablar con el administrador
          </Link>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>
          Indica tu ID de jugador (Free Fire u otro) y los datos que necesite el administrador para entregarte el
          producto. Se guardan en tu pedido y puedes corregirlos cuando quieras.
        </p>
        <OrderDeliveryForm orderId={order.id} data={order.customerData} />
        {order.customerData?.updatedAt ? (
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Última actualización: {formatDate(order.customerData.updatedAt)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
