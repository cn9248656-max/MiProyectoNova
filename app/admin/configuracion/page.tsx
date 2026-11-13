import { headers } from 'next/headers';
import SettingsForm from '../../../components/SettingsForm';
import SipSettingsForm from '../../../components/SipSettingsForm';
import { getSipStatus } from '../../../lib/sip';
import { getSettings } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const settings = getSettings();
  const sip = getSipStatus();

  const headerList = await headers();
  const host = headerList.get('host') || 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') || 'http';
  const webhookUrl = `${proto}://${host}${sip.webhookPath}`;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Datos de la tienda, cuentas de cobro (Sip y Agora) y modo mantenimiento.</p>
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
              <span>Titular Agora</span>
              <strong className="tiny">{settings.agoraHolder || 'Sin configurar'}</strong>
            </div>
            <div className="kv">
              <span>Cuenta Sip</span>
              <strong className="tiny">{sip.holder ? `${sip.holder} · ${sip.number}` : 'Sin configurar'}</strong>
            </div>
          </section>

          <section className="card card--flat">
            <h2 className="card__title">Cómo se acreditan las recargas</h2>
            <p className="hint" style={{ marginBottom: 0 }}>
              Con la acreditación automática activa, una transferencia confirmada con el código <strong>NOVA####</strong>{' '}
              acredita el saldo una sola vez. Si el pago no se puede confirmar automáticamente, la recarga queda pendiente y
              la apruebas en <strong>Recargas</strong>. Ninguna operación se acredita dos veces.
            </p>
          </section>
        </div>
      </div>

      <section className="card">
        <h2 className="card__title">Cuenta Sip receptora</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Los clientes transfieren desde Yape, Plin, Sip u otra app compatible hacia esta cuenta usando su código único.
        </p>
        <SipSettingsForm sip={sip} webhookUrl={webhookUrl} />
      </section>
    </div>
  );
}
