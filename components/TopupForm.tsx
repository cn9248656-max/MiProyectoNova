'use client';

import { useActionState, useState } from 'react';
import { topupAction } from '../app/actions';
import type { ActionState } from '../lib/types';

export default function TopupForm({ currency }: { currency: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(topupAction, null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="alert alert--error">{state.error}</div> : null}
      {state?.success ? <div className="alert alert--success">{state.success}</div> : null}

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="amount">
            Monto a recargar ({currency})
          </label>
          <input
            className="input"
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="Ej. 10.00"
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="reference">
            Referencia de Agora <span className="muted tiny">(opcional)</span>
          </label>
          <input className="input" id="reference" name="reference" placeholder="Número de operación" maxLength={80} />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="receipt">
          Comprobante del pago (imagen)
        </label>
        <input
          className="input"
          id="receipt"
          name="receipt"
          type="file"
          accept="image/*"
          required
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
      </div>

      {preview ? (
        <div className="receipt-preview">
          <img src={preview} alt="Vista previa del comprobante" />
        </div>
      ) : null}

      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Enviando solicitud…' : 'Enviar solicitud de recarga'}
      </button>
    </form>
  );
}
