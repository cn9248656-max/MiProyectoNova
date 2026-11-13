'use client';

import { useActionState, useState } from 'react';
import { sipSettingsAction } from '../app/actions';
import type { ActionState, SipStatus } from '../lib/types';

export default function SipSettingsForm({ sip, webhookUrl }: { sip: SipStatus; webhookUrl: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(sipSettingsAction, null);
  const [copied, setCopied] = useState(false);

  return (
    <form action={action} className="stack">
      {state?.error ? <div className="alert alert--error">{state.error}</div> : null}
      {state?.success ? <div className="alert alert--success">{state.success}</div> : null}

      <div className="row row--wrap" style={{ gap: 8 }}>
        <span className={sip.configured ? 'status status--approved' : 'status status--pending'}>
          {sip.configured ? 'Cuenta Sip configurada' : 'Cuenta Sip sin configurar'}
        </span>
        <span className={sip.hasApiKey ? 'status status--approved' : 'status'}>
          {sip.hasApiKey ? 'API con clave guardada' : 'Sin clave de API'}
        </span>
        <span className={sip.hasWebhookSecret ? 'status status--approved' : 'status status--pending'}>
          {sip.hasWebhookSecret ? 'Webhook protegido' : 'Webhook sin secreto'}
        </span>
      </div>

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="sip-holder">
            Titular de la cuenta Sip
          </label>
          <input className="input" id="sip-holder" name="holder" defaultValue={sip.holder} maxLength={120} />
        </div>

        <div className="field">
          <label className="label" htmlFor="sip-number">
            Número / celular Sip
          </label>
          <input className="input" id="sip-number" name="number" defaultValue={sip.number} maxLength={40} />
        </div>

        <div className="field">
          <label className="label" htmlFor="sip-alias">
            Alias Sip <span className="muted tiny">(opcional)</span>
          </label>
          <input className="input" id="sip-alias" name="alias" defaultValue={sip.alias} maxLength={80} />
        </div>

        <div className="field">
          <label className="label" htmlFor="sip-cci">
            CCI / cuenta <span className="muted tiny">(opcional)</span>
          </label>
          <input className="input" id="sip-cci" name="cci" defaultValue={sip.cci} maxLength={60} />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="sip-note">
          Instrucciones para el cliente
        </label>
        <textarea
          className="input"
          id="sip-note"
          name="note"
          rows={3}
          maxLength={400}
          defaultValue={sip.note}
          placeholder="Ej. Transfiere desde Yape o Plin y usa tu código NOVA#### como referencia."
        />
      </div>

      <label className="check">
        <input type="checkbox" name="auto" defaultChecked={sip.auto} />
        <span>
          Acreditar automáticamente cuando se confirme una transferencia con el código de recarga
          <span className="hint">Si lo desactivas, cada recarga queda pendiente de tu aprobación manual.</span>
        </span>
      </label>

      <h3 className="card__title" style={{ marginTop: 6 }}>
        API de Sip (opcional)
      </h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Si tu proveedor Sip te entrega una API autorizada de consulta de movimientos, guarda aquí la URL y la clave. Se
        cifran en el servidor y nunca se envían al navegador. Si no la tienes, el sistema funciona con el webhook y la
        verificación manual, sin simular automatización.
      </p>

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="sip-api-url">
            URL de la API
          </label>
          <input
            className="input"
            id="sip-api-url"
            name="apiUrl"
            defaultValue={sip.apiUrl}
            placeholder="https://api.sip.pe/…"
            maxLength={200}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="sip-api-key">
            Clave de API {sip.hasApiKey ? <span className="muted tiny">(guardada)</span> : null}
          </label>
          <input
            className="input"
            id="sip-api-key"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={sip.hasApiKey ? '•••••• (dejar vacío para conservarla)' : 'Pega la clave de tu API Sip'}
          />
        </div>
      </div>

      {sip.hasApiKey ? (
        <label className="check">
          <input type="checkbox" name="clearApiKey" />
          <span>Borrar la clave de API guardada</span>
        </label>
      ) : null}

      <h3 className="card__title" style={{ marginTop: 6 }}>
        Notificaciones de pago (webhook)
      </h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Configura esta URL en tu proveedor para que cada transferencia recibida llegue automáticamente. La petición debe
        enviar el secreto en la cabecera <code>x-sip-secret</code> (o <code>Authorization: Bearer …</code>).
      </p>

      <div className="field">
        <label className="label" htmlFor="sip-webhook-url">
          URL del webhook
        </label>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" id="sip-webhook-url" readOnly value={webhookUrl} />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(webhookUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="sip-webhook-secret">
          Secreto del webhook {sip.hasWebhookSecret ? <span className="muted tiny">(ya configurado)</span> : null}
        </label>
        <input
          className="input"
          id="sip-webhook-secret"
          name="webhookSecret"
          type="password"
          autoComplete="off"
          placeholder={sip.hasWebhookSecret ? '•••••• (dejar vacío para conservarlo)' : 'Escribe o genera un secreto'}
        />
      </div>

      <label className="check">
        <input type="checkbox" name="generateWebhookSecret" />
        <span>Generar un secreto nuevo aleatorio (se muestra una sola vez)</span>
      </label>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar configuración Sip'}
      </button>
    </form>
  );
}
