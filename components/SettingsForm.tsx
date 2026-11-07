'use client';

import { useActionState } from 'react';
import { settingsAction } from '../app/actions';
import type { ActionState, Settings } from '../lib/types';

export default function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(settingsAction, null);

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="alert alert--error">{state.error}</div> : null}
      {state?.success ? <div className="alert alert--success">{state.success}</div> : null}

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="store-name">
            Nombre de la tienda
          </label>
          <input className="input" id="store-name" name="storeName" defaultValue={settings.storeName} required minLength={2} />
        </div>
        <div className="field">
          <label className="label" htmlFor="store-currency">
            Moneda
          </label>
          <input
            className="input"
            id="store-currency"
            name="currency"
            defaultValue={settings.currency}
            required
            maxLength={6}
            placeholder="USD"
          />
        </div>
      </div>

      <h3 className="section-title" style={{ fontSize: 16 }}>
        Datos para recargas por Agora
      </h3>

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="agora-alias">
            Alias
          </label>
          <input className="input" id="agora-alias" name="agoraAlias" defaultValue={settings.agoraAlias} maxLength={60} />
        </div>
        <div className="field">
          <label className="label" htmlFor="agora-phone">
            Teléfono
          </label>
          <input className="input" id="agora-phone" name="agoraPhone" defaultValue={settings.agoraPhone} maxLength={40} />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="agora-holder">
          Titular de la cuenta
        </label>
        <input className="input" id="agora-holder" name="agoraHolder" defaultValue={settings.agoraHolder} maxLength={80} />
      </div>

      <div className="field">
        <label className="label" htmlFor="agora-note">
          Instrucciones adicionales
        </label>
        <textarea
          className="textarea"
          id="agora-note"
          name="agoraNote"
          rows={3}
          defaultValue={settings.agoraNote}
          maxLength={400}
        />
      </div>

      <h3 className="section-title" style={{ fontSize: 16 }}>
        Mantenimiento
      </h3>

      <label className="checkbox">
        <input type="checkbox" name="maintenance" defaultChecked={settings.maintenance} />
        <span>Activar modo mantenimiento (la tienda deja de ser visible para clientes)</span>
      </label>

      <div className="field">
        <label className="label" htmlFor="maintenance-message">
          Mensaje de mantenimiento
        </label>
        <textarea
          className="textarea"
          id="maintenance-message"
          name="maintenanceMessage"
          rows={2}
          defaultValue={settings.maintenanceMessage}
          maxLength={300}
        />
      </div>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </form>
  );
}
