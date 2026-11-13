import { reviewTopupAction, sipRegisterTransactionAction, sipVerifyAction } from '../../../app/actions';
import { formatDate, formatMoney } from '../../../lib/money';
import { listSipTransactions, sipSummary, sipTransactionForTopup } from '../../../lib/sip';
import { getSettings, listAllTopups } from '../../../lib/store';
import { SIP_METHOD_LABELS, SIP_TRANSACTION_LABEL, TOPUP_STATUS_LABEL } from '../../../lib/types';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'status status--pending',
  APPROVED: 'status status--approved',
  REJECTED: 'status status--rejected',
};

const SIP_STATUS_CLASS: Record<string, string> = {
  APPLIED: 'status status--approved',
  MATCHED: 'status status--pending',
  RECEIVED: 'status status--pending',
  AMOUNT_MISMATCH: 'status status--rejected',
  UNMATCHED: 'status status--rejected',
  REJECTED: 'status status--rejected',
};

export default async function AdminTopupsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const query = await searchParams;
  const settings = getSettings();
  const all = listAllTopups();
  const pending = all.filter((topup) => topup.status === 'PENDING');
  const history = all.filter((topup) => topup.status !== 'PENDING');
  const sipPending = pending.filter((topup) => topup.method === 'SIP');
  const transactions = listSipTransactions();
  const summary = sipSummary();

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Recargas</h1>
          <p className="page-subtitle">
            Recargas Sip (Yape, Plin, Sip) identificadas por código único y recargas Agora con comprobante. Al aprobar, el
            saldo se acredita una sola vez.
          </p>
        </div>
      </div>

      {query.ok ? <div className="alert alert--success">{query.ok}</div> : null}
      {query.error ? <div className="alert alert--error">{query.error}</div> : null}

      <div className="grid-2">
        <section className="card card--flat">
          <span className="stat__label">Recargas Sip pendientes</span>
          <div className="amount mono" style={{ fontSize: 26, margin: '6px 0 0' }}>
            <strong>{summary.pending}</strong>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            {sipPending.length} esperan verificación de la transferencia.
          </p>
        </section>
        <section className="card card--flat">
          <span className="stat__label">Operaciones sin conciliar</span>
          <div className="amount mono" style={{ fontSize: 26, margin: '6px 0 0' }}>
            <strong>{summary.unmatched}</strong>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            Recibidas sin código válido o con monto distinto.
          </p>
        </section>
        <section className="card card--flat">
          <span className="stat__label">Acreditadas hoy</span>
          <div className="amount mono" style={{ fontSize: 26, margin: '6px 0 0' }}>
            <strong>{summary.appliedToday}</strong>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            Acreditación automática o aprobada manualmente.
          </p>
        </section>
        <section className="card card--flat">
          <span className="stat__label">Total recibido por Sip</span>
          <div className="amount mono" style={{ fontSize: 26, margin: '6px 0 0' }}>
            <strong>{formatMoney(summary.receivedCents, settings.currency)}</strong>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            Solo operaciones confirmadas y acreditadas.
          </p>
        </section>
      </div>

      <section className="stack">
        <h2 className="section-title">Pendientes de aprobación ({pending.length})</h2>

        {pending.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">✅</div>
            <h3>No hay recargas pendientes</h3>
            <p>Cuando un cliente envíe un comprobante aparecerá aquí.</p>
          </div>
        ) : (
          <div className="stack">
            {pending.map((topup) => {
              const transaction = topup.method === 'SIP' ? sipTransactionForTopup(topup.id) : null;
              return (
                <article key={topup.id} className="card">
                  <div className="row row--between row--wrap" style={{ gap: 12 }}>
                    <div>
                      <strong>{formatMoney(topup.amountCents, settings.currency)}</strong>
                      <div className="tiny muted">
                        {topup.userName || 'Cliente'} · {topup.userEmail || ''} · {formatDate(topup.createdAt)}
                      </div>
                      {topup.sipCode ? (
                        <div className="tiny" style={{ marginTop: 4 }}>
                          Código: <strong className="mono">{topup.sipCode}</strong>
                          {topup.sipMethod ? ` · ${SIP_METHOD_LABELS[topup.sipMethod] || topup.sipMethod}` : ''}
                        </div>
                      ) : null}
                      {topup.sipOperation ? (
                        <div className="tiny muted">Operación declarada: {topup.sipOperation}</div>
                      ) : null}
                      {transaction ? (
                        <div className="tiny muted">
                          Operación recibida: {transaction.operationNumber} ·{' '}
                          {formatMoney(transaction.amountCents, settings.currency)} ·{' '}
                          {SIP_TRANSACTION_LABEL[transaction.status]}
                        </div>
                      ) : (
                        <div className="tiny muted">Sin transferencia confirmada con este código todavía.</div>
                      )}
                      {topup.reference && !topup.sipCode ? (
                        <div className="tiny muted">Referencia: {topup.reference}</div>
                      ) : null}
                    </div>
                    <span className="status status--pending">{TOPUP_STATUS_LABEL[topup.status]}</span>
                  </div>

                  <div className="grid-2" style={{ marginTop: 14 }}>
                    <div className="receipt-preview">
                      {topup.receiptId ? (
                        <a href={`/api/uploads/${topup.receiptId}`} target="_blank" rel="noreferrer">
                          <img src={`/api/uploads/${topup.receiptId}`} alt="Comprobante de recarga" />
                        </a>
                      ) : (
                        <p className="hint">El cliente no adjuntó comprobante.</p>
                      )}
                    </div>

                    <div className="stack">
                      {topup.method === 'SIP' ? (
                        <form action={sipVerifyAction} className="form-actions">
                          <input type="hidden" name="topupId" value={topup.id} />
                          <button className="btn btn--ghost" type="submit">
                            Verificar transferencia
                          </button>
                        </form>
                      ) : null}

                      <form action={reviewTopupAction} className="stack">
                        <input type="hidden" name="topupId" value={topup.id} />
                        <div className="field">
                          <label className="label" htmlFor={`note-${topup.id}`}>
                            Nota para el cliente <span className="muted tiny">(opcional)</span>
                          </label>
                          <input
                            className="input"
                            id={`note-${topup.id}`}
                            name="adminNote"
                            placeholder="Ej. Pago verificado correctamente"
                            maxLength={200}
                          />
                        </div>
                        <div className="form-actions">
                          <button className="btn btn--success" type="submit" name="decision" value="APPROVED">
                            Aprobar y acreditar
                          </button>
                          <button className="btn btn--danger" type="submit" name="decision" value="REJECTED">
                            Rechazar
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Registrar una transferencia recibida en Sip</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Usa este formulario cuando el dinero ya llegó a tu cuenta Sip (por el webhook o por revisión manual). Si el monto
          y el código coinciden con una recarga pendiente, el saldo se acredita automáticamente. Una operación nunca se
          acredita dos veces.
        </p>

        <form action={sipRegisterTransactionAction} className="stack">
          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="sip-tx-operation">
                Número de operación
              </label>
              <input className="input" id="sip-tx-operation" name="operation" placeholder="Ej. 01234567" maxLength={80} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="sip-tx-amount">
                Monto recibido ({settings.currency})
              </label>
              <input className="input" id="sip-tx-amount" name="amount" inputMode="decimal" placeholder="Ej. 20.00" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="sip-tx-code">
                Código de recarga <span className="muted tiny">(referencia NOVA####)</span>
              </label>
              <input className="input" id="sip-tx-code" name="sipCode" placeholder="NOVA5821" maxLength={20} />
            </div>
            <div className="field">
              <label className="label" htmlFor="sip-tx-sender">
                Nombre del remitente <span className="muted tiny">(opcional)</span>
              </label>
              <input className="input" id="sip-tx-sender" name="senderName" maxLength={120} />
            </div>
            <div className="field">
              <label className="label" htmlFor="sip-tx-phone">
                Celular del remitente <span className="muted tiny">(opcional)</span>
              </label>
              <input className="input" id="sip-tx-phone" name="senderPhone" maxLength={40} />
            </div>
            <div className="field">
              <label className="label" htmlFor="sip-tx-note">
                Nota interna <span className="muted tiny">(opcional)</span>
              </label>
              <input className="input" id="sip-tx-note" name="note" maxLength={200} />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn" type="submit">
              Registrar operación recibida
            </button>
          </div>
        </form>
      </section>

      <section className="stack">
        <h2 className="section-title">Operaciones Sip recibidas ({transactions.length})</h2>

        {transactions.length === 0 ? (
          <p className="hint">
            Aún no hay operaciones registradas. Llegarán por el webhook de Sip o cuando las registres manualmente.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Recibida</th>
                  <th>Operación</th>
                  <th>Monto</th>
                  <th>Código</th>
                  <th>Remitente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="tiny">{formatDate(transaction.receivedAt || transaction.createdAt)}</td>
                    <td className="mono tiny">{transaction.operationNumber}</td>
                    <td className="mono">{formatMoney(transaction.amountCents, settings.currency)}</td>
                    <td className="mono tiny">{transaction.referenceCode || '—'}</td>
                    <td className="tiny">
                      {transaction.senderName || '—'}
                      {transaction.senderPhone ? <div className="tiny muted">{transaction.senderPhone}</div> : null}
                    </td>
                    <td>
                      <span className={SIP_STATUS_CLASS[transaction.status] || 'status'}>
                        {SIP_TRANSACTION_LABEL[transaction.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">Historial ({history.length})</h2>

        {history.length === 0 ? (
          <p className="hint">Aún no hay recargas procesadas.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Código</th>
                  <th>Operación</th>
                  <th>Solicitada</th>
                  <th>Estado</th>
                  <th>Nota</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {history.map((topup) => (
                  <tr key={topup.id}>
                    <td>
                      <strong style={{ fontSize: 13 }}>{topup.userName || 'Cliente'}</strong>
                      <div className="tiny muted">{topup.userEmail}</div>
                    </td>
                    <td className="mono">{formatMoney(topup.amountCents, settings.currency)}</td>
                    <td className="tiny">
                      {topup.method === 'SIP'
                        ? topup.sipMethod
                          ? SIP_METHOD_LABELS[topup.sipMethod] || topup.sipMethod
                          : 'Sip'
                        : 'Agora'}
                    </td>
                    <td className="mono tiny">{topup.sipCode || '—'}</td>
                    <td className="mono tiny">{topup.sipOperation || '—'}</td>
                    <td className="tiny">{formatDate(topup.createdAt)}</td>
                    <td>
                      <span className={STATUS_CLASS[topup.status] || 'status'}>{TOPUP_STATUS_LABEL[topup.status]}</span>
                    </td>
                    <td className="tiny">{topup.adminNote || '—'}</td>
                    <td>
                      {topup.receiptId ? (
                        <a className="link tiny" href={`/api/uploads/${topup.receiptId}`} target="_blank" rel="noreferrer">
                          Ver
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
