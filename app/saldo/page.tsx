import { redirect } from 'next/navigation';
import TopupForm from '../../components/TopupForm';
import { getCurrentUser } from '../../lib/auth';
import { formatDate, formatMoney } from '../../lib/money';
import { getSipAccount } from '../../lib/sip';
import { getSettings, listTopups } from '../../lib/store';
import { SIP_METHOD_LABEL, TOPUP_STATUS_LABEL } from '../../lib/types';

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
  const sip = getSipAccount();
  const topups = listTopups(user.id);
  const pending = topups.filter((topup) => topup.status === 'PENDING');

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Añadir saldo</h1>
          <p className="page-subtitle">
            Recarga por Sip (Yape, Plin o Sip) con un código único, o por Agora con comprobante. El saldo se acredita
            cuando el pago queda confirmado.
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
          <h2 className="card__title">Datos de la cuenta Sip</h2>
          {sip.holder && sip.number ? (
            <>
              <div className="kv">
                <span>Titular</span>
                <strong>{sip.holder}</strong>
              </div>
              <div className="kv">
                <span>Número Sip</span>
                <strong className="mono">{sip.number}</strong>
              </div>
              {sip.alias ? (
                <div className="kv">
                  <span>Alias</span>
                  <strong className="mono">{sip.alias}</strong>
                </div>
              ) : null}
              {sip.cci ? (
                <div className="kv">
                  <span>CCI / cuenta</span>
                  <strong className="mono">{sip.cci}</strong>
                </div>
              ) : null}
              <p className="hint" style={{ marginBottom: 0 }}>
                {sip.note || 'Transfiere desde Yape, Plin o Sip y usa tu código NOVA#### como referencia.'}
              </p>
            </>
          ) : (
            <p className="hint" style={{ marginBottom: 0 }}>
              La cuenta Sip aún no está configurada. Puedes recargar por Agora mientras el administrador la habilita.
            </p>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="card__title">Solicitar recarga</h2>
        <TopupForm currency={settings.currency} sip={sip} />
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
                    {topup.sipCode ? ` · Código ${topup.sipCode}` : ''}
                    {topup.sipMethod ? ` · ${SIP_METHOD_LABEL[topup.sipMethod] || topup.sipMethod}` : ''}
                    {topup.reference && !topup.sipCode ? ` · Ref. ${topup.reference}` : ''}
                  </span>
                  {topup.sipOperation ? (
                    <span className="list-item__meta">Operación declarada: {topup.sipOperation}</span>
                  ) : null}
                  {topup.creditedAt ? (
                    <span className="list-item__meta">Saldo acreditado: {formatDate(topup.creditedAt)}</span>
                  ) : null}
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
