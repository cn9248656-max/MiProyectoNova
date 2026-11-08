import { createBackupAction, restoreBackupAction } from '../../../app/actions';
import { formatBytes, listBackups, MAX_BACKUPS } from '../../../lib/backup';
import { currentCounts } from '../../../lib/backup-db';

export const dynamic = 'force-dynamic';

const ROWS: Array<{ label: string; key: string }> = [
  { label: 'Productos', key: 'products' },
  { label: 'Categorías', key: 'categories' },
  { label: 'Clientes', key: 'users' },
  { label: 'Pedidos', key: 'orders' },
  { label: 'Artículos de pedidos', key: 'order_items' },
  { label: 'Recargas', key: 'topups' },
  { label: 'Movimientos de saldo', key: 'wallet_transactions' },
  { label: 'Imágenes y comprobantes', key: 'uploads' },
  { label: 'Conversaciones', key: 'conversations' },
  { label: 'Mensajes', key: 'messages' },
];

export default async function AdminBackupPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const query = await searchParams;
  const counts = currentCounts();
  const backups = listBackups();
  const latest = backups[0];

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Respaldos y protección de datos</h1>
          <p className="page-subtitle">
            Tus productos, pedidos, clientes, saldos y comprobantes nunca se borran al actualizar la tienda.
          </p>
        </div>
      </div>

      {query.ok ? <div className="alert alert--success">{query.ok}</div> : null}
      {query.error ? <div className="alert alert--error">{query.error}</div> : null}

      <section className="card">
        <h2 className="card__title">Datos guardados ahora mismo</h2>
        <p className="hint">
          Se leen directamente de la base de datos persistente ({formatBytes(latest?.sizeBytes ?? 0)} en la última
          copia). Si un número no cuadra con lo que esperas, restaura una copia antes de seguir.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Información</th>
                <th>Registros</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="mono">{counts ? (counts[row.key] ?? 0) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Crear copia de seguridad</h2>
        <p className="hint">
          Se guarda un archivo .db con toda la tienda (productos, imágenes, pedidos, clientes, recargas,
          comprobantes, mensajes y configuración). Se conservan las últimas {MAX_BACKUPS} copias.
        </p>
        <form action={createBackupAction} className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            name="reason"
            placeholder="Motivo (ej. antes de cambiar precios)"
            maxLength={60}
            style={{ flex: '1 1 240px' }}
          />
          <button className="btn btn--primary" type="submit">
            Crear copia ahora
          </button>
        </form>
      </section>

      <section className="card">
        <div className="row row--between">
          <h2 className="card__title" style={{ margin: 0 }}>
            Copias disponibles ({backups.length})
          </h2>
          <a className="btn btn--ghost btn--sm" href="/api/backup/export">
            Exportar todo en JSON
          </a>
        </div>

        {backups.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">🛡</div>
            <h3>Todavía no hay copias</h3>
            <p>Crea la primera con el botón de arriba. Se recomienda hacerlo antes de cada cambio importante.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Fecha</th>
                  <th>Tamaño</th>
                  <th>Productos</th>
                  <th>Pedidos</th>
                  <th>Clientes</th>
                  <th>Integridad</th>
                  <th>Descargar</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.name}>
                    <td className="tiny mono">{backup.name}</td>
                    <td className="tiny">{new Date(backup.createdAt).toLocaleString('es')}</td>
                    <td className="tiny mono">{formatBytes(backup.sizeBytes)}</td>
                    <td className="mono">{backup.counts?.products ?? '—'}</td>
                    <td className="mono">{backup.counts?.orders ?? '—'}</td>
                    <td className="mono">{backup.counts?.users ?? '—'}</td>
                    <td>
                      <span className={backup.healthy ? 'status status--approved' : 'status status--cancelled'}>
                        {backup.healthy ? 'Verificada' : 'Revisar'}
                      </span>
                    </td>
                    <td>
                      <a className="btn btn--ghost btn--sm" href={`/api/backup/${encodeURIComponent(backup.name)}`}>
                        Descargar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Restaurar una copia</h2>
        <p className="hint">
          Antes de restaurar se guarda automáticamente una copia del estado actual, así que también puedes volver
          atrás. Escribe <strong>RESTAURAR</strong> para confirmar.
        </p>
        <form action={restoreBackupAction} className="stack" style={{ gap: 12 }}>
          <input className="input" type="file" name="file" accept=".db,application/octet-stream" required />
          <input className="input" name="confirm" placeholder="Escribe RESTAURAR" required maxLength={20} />
          <button className="btn btn--danger" type="submit">
            Restaurar copia
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="card__title">Qué está protegido</h2>
        <ul className="hint" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>Los productos se archivan en lugar de borrarse: sus pedidos, imágenes e historial se conservan.</li>
          <li>Las actualizaciones del esquema solo agregan tablas o columnas, nunca eliminan registros.</li>
          <li>Antes de cualquier cambio de esquema se crea una copia automática (pre-migración).</li>
          <li>Los datos de demostración nunca reemplazan un catálogo real: solo se siembran si la tienda está vacía.</li>
          <li>Cada copia se verifica con integridad SQLite y el conteo de registros antes de darla por válida.</li>
        </ul>
      </section>
    </div>
  );
}
