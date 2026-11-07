import { resolveRequestAction } from '../../../app/actions';
import { formatDate } from '../../../lib/money';
import { listProductRequests } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const query = await searchParams;
  const requests = listProductRequests();
  const open = requests.filter((request) => request.status === 'OPEN');
  const closed = requests.filter((request) => request.status !== 'OPEN');

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Solicitudes de productos</h1>
          <p className="page-subtitle">Productos que los clientes quieren comprar y aún no están en el catálogo.</p>
        </div>
      </div>

      {query.ok ? <div className="alert alert--success">{query.ok}</div> : null}
      {query.error ? <div className="alert alert--error">{query.error}</div> : null}

      <section className="stack">
        <h2 className="section-title">Abiertas ({open.length})</h2>
        {open.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">✉</div>
            <h3>Sin solicitudes abiertas</h3>
            <p>Los clientes pueden pedir productos desde su cuenta.</p>
          </div>
        ) : (
          <div className="stack">
            {open.map((request) => (
              <article key={request.id} className="card">
                <div className="row row--between row--wrap" style={{ gap: 12 }}>
                  <div>
                    <strong>{request.productName}</strong>
                    <div className="tiny muted">
                      {request.userName || 'Cliente'} · {request.userEmail || ''} · {formatDate(request.createdAt)}
                    </div>
                    {request.details ? <p className="tiny" style={{ marginTop: 6 }}>{request.details}</p> : null}
                  </div>
                  <form action={resolveRequestAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="btn btn--sm" type="submit">
                      Marcar atendida
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <section className="stack">
          <h2 className="section-title">Atendidas ({closed.length})</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((request) => (
                  <tr key={request.id}>
                    <td>{request.productName}</td>
                    <td className="tiny">{request.userName || request.userEmail}</td>
                    <td className="tiny">{formatDate(request.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
