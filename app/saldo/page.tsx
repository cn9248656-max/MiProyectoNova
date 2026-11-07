import { redirect } from 'next/navigation';
import TopupForm from '../../components/TopupForm';
import { getCurrentUser } from '../../lib/auth';
import { formatDate, formatMoney } from '../../lib/money';
import { getSettings, listTopups } from '../../lib/store';
import { TOPUP_STATUS_LABEL } from '../../lib/types';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'status status--pending',
  APPROVED: 'status status--approved',
  REJECTED: 'status status--rejected',
};

export default async function BalancePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/saldo');

  const settings = getSettings();
  const topups = listTopups(user.id);
  const pending = topups.filter((topup) => topup.status === 'PENDING');

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Añadir saldo</h1>
          <p className="page-subtitle">
            Recarga por Agora y adjunta el comprobante. El saldo se acredita cuando el administrador lo aprueba.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <span className="stat__label">Saldo disponible</span>
          <div className="amount" style={{ fontSize: 34, margin: '6px 0 4px' }}>
            <strong className="mono">{formatMoney(user.balanceCents, settings.currency)}</strong>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            {pending.length > 0
              ? `Tienes ${pending.length} solicitud(es) de recarga pendientes de aprobación.`
              : 'No tienes recargas pendientes.'}
          </p>
        </section>

        <section className="card card--flat">
          <h2 className="card__title">Datos para pagar por Agora</h2>
          <div className="kv">
            <span>Alias</span>
            <strong>{settings.agoraAlias || 'No configurado'}</strong>
          </div>
          <div className="kv">
            <span>Teléfono</span>
            <strong>{settings.agoraPhone || '—'}</strong>
          </div>
          <div className="kv">
            <span>Titular</span>
            <strong>{settings.agoraHolder || '—'}</strong>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            {settings.agoraNote || 'Realiza la transferencia y guarda una captura del comprobante.'}
          </p>
        </section>
      </div>

      <section className="card">
        <h2 className="card__title">Solicitar recarga</h2>
        <TopupForm currency={settings.currency} />
      </section>

      <section className="stack">
        <h2 className="section-title">Mis solicitudes de recarga</h2>

        {topups.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">💳</div>
            <h3>Aún no has solicitado recargas</h3>
            <p>Cuando envíes un comprobante, aparecerá aquí con su estado.</p>
          </div>
        ) : (
          <div className="stack">
            {topups.map((topup) => (
              <div key={topup.id} className="list-item">
                <div className="list-item__thumb">
                  {topup.receiptId ? (
                    <img src={`/api/uploads/${topup.receiptId}`} alt="Comprobante" />
                  ) : (
                    <span>💳</span>
                  )}
                </div>
                <div className="list-item__main">
                  <span className="list-item__title">Recarga {formatMoney(topup.amountCents, settings.currency)}</span>
                  <span className="list-item__meta">
                    {formatDate(topup.createdAt)}
                    {topup.reference ? ` · Ref. ${topup.reference}` : ''}
                  </span>
                  {topup.adminNote ? <span className="list-item__meta">Nota del administrador: {topup.adminNote}</span> : null}
                </div>
                <span className={STATUS_CLASS[topup.status] || 'status'}>{TOPUP_STATUS_LABEL[topup.status]}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
