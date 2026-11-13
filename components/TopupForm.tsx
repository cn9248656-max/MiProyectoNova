'use client';

import { useActionState, useState } from 'react';
import { sipOperationAction, sipTopupAction, topupAction } from '../app/actions';
import type { ActionState, SipAccount } from '../lib/types';

const METHODS = [
  { value: 'YAPE', label: 'Yape → Sip' },
  { value: 'PLIN', label: 'Plin → Sip' },
  { value: 'SIP', label: 'Sip → Sip' },
  { value: 'OTRO', label: 'Otra transferencia compatible' },
];

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

function ReceiptInput({ preview, setPreview }: { preview: string | null; setPreview: (value: string | null) => void }) {
  return (
    <div className="field">
      <label className="label" htmlFor="receipt">
        Comprobante del pago <span className="muted tiny">(recomendado)</span>
      </label>
      <input
        className="input"
        id="receipt"
        name="receipt"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            setPreview(null);
            return;
          }
          const reader = new FileReader();
          reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
          reader.readAsDataURL(file);
        }}
      />
      <span className="hint">JPG o PNG, máximo 5 MB. Se guarda en la base de datos junto a tu solicitud.</span>
      {preview ? (
        <div className="receipt-preview">
          <img src={preview} alt="Vista previa del comprobante" />
        </div>
      ) : null}
    </div>
  );
}

export default function TopupForm({ currency, sip }: { currency: string; sip: SipAccount }) {
  const sipReady = Boolean(sip.holder && sip.number);
  const [tab, setTab] = useState<'SIP' | 'AGORA'>(sipReady ? 'SIP' : 'AGORA');
  const [sipState, sipAction, sipPending] = useActionState<ActionState, FormData>(sipTopupAction, null);
  const [opState, opAction, opPending] = useActionState<ActionState, FormData>(sipOperationAction, null);
  const [agoraState, agoraAction, agoraPending] = useActionState<ActionState, FormData>(topupAction, null);
  const [sipPreview, setSipPreview] = useState<string | null>(null);
  const [agoraPreview, setAgoraPreview] = useState<string | null>(null);

  const activeCode = sipState?.code || '';

  return (
    <div className="stack">
      <div className="tabs" role="tablist" aria-label="Método de recarga">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'SIP'}
          className={tab === 'SIP' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('SIP')}
        >
          Sip · Yape · Plin
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'AGORA'}
          className={tab === 'AGORA' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('AGORA')}
        >
          Agora
        </button>
      </div>

      {tab === 'SIP' ? (
        <div className="stack">
          {sipState?.error ? <div className="alert alert--error">{sipState.error}</div> : null}
          {sipState?.success ? <div className="alert alert--success">{sipState.success}</div> : null}

          {activeCode ? (
            <div className="sip-code-box">
              <span className="stat__label">Tu código único de operación</span>
              <div className="row row--between row--wrap" style={{ gap: 10 }}>
                <strong className="sip-code mono">{activeCode}</strong>
                <CopyValue value={activeCode} />
              </div>
              <p className="hint" style={{ marginBottom: 0 }}>
                Escribe este código como referencia/glosa de tu transferencia. Solo con él podemos identificar tu pago.
              </p>
            </div>
          ) : null}

          {!sipState?.success ? (
            <form action={sipAction} className="stack">
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="sip-amount">
                    Monto a recargar ({currency})
                  </label>
                  <input
                    className="input"
                    id="sip-amount"
                    name="amount"
                    inputMode="decimal"
                    placeholder="Ej. 20.00"
                    required
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="sip-method">
                    ¿Desde qué app transfieres?
                  </label>
                  <select className="input" id="sip-method" name="sipMethod" defaultValue="YAPE">
                    {METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ReceiptInput preview={sipPreview} setPreview={setSipPreview} />

              <button className="btn" type="submit" disabled={sipPending}>
                {sipPending ? 'Generando código…' : 'Generar código y continuar'}
              </button>
            </form>
          ) : (
            <form action={opAction} className="stack">
              {opState?.error ? <div className="alert alert--error">{opState.error}</div> : null}
              {opState?.success ? <div className="alert alert--success">{opState.success}</div> : null}
              <input type="hidden" name="topupId" value={sipState.topupId || ''} />
              <input type="hidden" name="sipCode" value={activeCode} />
              <div className="field">
                <label className="label" htmlFor="sip-operation">
                  Número de operación de tu transferencia
                </label>
                <input
                  className="input"
                  id="sip-operation"
                  name="operation"
                  placeholder="Ej. 01234567"
                  maxLength={40}
                  required
                />
                <span className="hint">
                  Lo encuentras en el comprobante de Yape, Plin o Sip. Con él verificamos que el dinero llegó a la cuenta Sip.
                </span>
              </div>
              <ReceiptInput preview={sipPreview} setPreview={setSipPreview} />
              <button className="btn" type="submit" disabled={opPending}>
                {opPending ? 'Enviando…' : 'Ya transferí · enviar a verificación'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <form action={agoraAction} className="stack">
          {agoraState?.error ? <div className="alert alert--error">{agoraState.error}</div> : null}
          {agoraState?.success ? <div className="alert alert--success">{agoraState.success}</div> : null}

          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="amount">
                Monto a recargar ({currency})
              </label>
              <input className="input" id="amount" name="amount" inputMode="decimal" placeholder="Ej. 10.00" required />
            </div>

            <div className="field">
              <label className="label" htmlFor="reference">
                Referencia de Agora <span className="muted tiny">(opcional)</span>
              </label>
              <input className="input" id="reference" name="reference" placeholder="Número de operación" maxLength={80} />
            </div>
          </div>

          <ReceiptInput preview={agoraPreview} setPreview={setAgoraPreview} />

          <button className="btn" type="submit" disabled={agoraPending}>
            {agoraPending ? 'Enviando solicitud…' : 'Enviar solicitud de recarga'}
          </button>
        </form>
      )}
    </div>
  );
}
