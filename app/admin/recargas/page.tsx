import { reviewTopupAction } from '../../../app/actions';
import { formatDate, formatMoney } from '../../../lib/money';
import { getSettings, listAllTopups } from '../../../lib/store';
import { TOPUP_STATUS_LABEL } from '../../../lib/types';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'status status--pending',
  APPROVED: 'status status--approved',
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

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Recargas</h1>
          <p className="page-subtitle">
            Verifica el comprobante antes de aprobar. Al aprobar, el saldo se acredita una sola vez.
          </p>
        </div>
      </div>

      {query.ok ? <div className="alert alert--success">{query.ok}</div> : null}
      {query.error ? <div className="alert alert--error">{query.error}</div> : null}

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
            {pending.map((topup) => (
              <article key={topup.id} className="card">
                <div className="row row--between row--wrap" style={{ gap: 12 }}>
                  <div>
                    <strong>{formatMoney(topup.amountCents, settings.currency)}</strong>
                    <div className="tiny muted">
                      {topup.userName || 'Cliente'} · {topup.userEmail || ''} · {formatDate(topup.createdAt)}
                    </div>
                    {topup.reference ? <div className="tiny muted">Referencia: {topup.reference}</div> : null}
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
              </article>
            ))}
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
