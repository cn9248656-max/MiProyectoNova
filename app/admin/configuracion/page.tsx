import SettingsForm from '../../../components/SettingsForm';
import { formatDate } from '../../../lib/money';
import { getSettings } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const settings = getSettings();

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Datos de la tienda, cuentas de Agora y modo mantenimiento.</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="card__title">Ajustes generales</h2>
          <SettingsForm settings={settings} />
        </section>

        <div className="stack">
          <section className="card card--flat">
            <h2 className="card__title">Estado actual</h2>
            <div className="kv">
              <span>Tienda</span>
              <strong>{settings.storeName}</strong>
            </div>
            <div className="kv">
              <span>Moneda</span>
              <strong>{settings.currency}</strong>
            </div>
            <div className="kv">
              <span>Mantenimiento</span>
              <strong>
                <span className={settings.maintenance ? 'status status--pending' : 'status status--approved'}>
                  {settings.maintenance ? 'Activado' : 'Desactivado'}
                </span>
              </strong>
            </div>
            <div className="kv">
              <span>Última actualización</span>
              <strong className="tiny">{formatDate(settings.updatedAt)}</strong>
            </div>
          </section>

          <section className="card card--flat">
            <h2 className="card__title">Cómo funciona la aprobación</h2>
            <p className="hint" style={{ marginBottom: 0 }}>
              Ninguna recarga suma saldo automáticamente. El cliente sube su comprobante y el administrador debe aprobarla
              en <strong>Recargas</strong>. Cada aprobación se registra en el historial de movimientos del cliente.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
