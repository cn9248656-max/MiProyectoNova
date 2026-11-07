'use client';

import { useActionState } from 'react';
import { saveDeliveryDataAction } from '../app/actions';
import type { ActionState, OrderCustomerData } from '../lib/types';

export default function OrderDeliveryForm({
  orderId,
  data,
}: {
  orderId: string;
  data: OrderCustomerData | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveDeliveryDataAction, null);

  return (
    <form action={formAction} className="stack" style={{ gap: 10 }}>
      <input type="hidden" name="orderId" value={orderId} />

      <div className="field">
        <label className="label" htmlFor={`playerId-${orderId}`}>
          ID de jugador / Free Fire
        </label>
        <input
          className="input"
          id={`playerId-${orderId}`}
          name="playerId"
          defaultValue={data?.playerId ?? ''}
          placeholder="Ej. 1234567890"
          maxLength={120}
          required
        />
      </div>

      <div className="field">
        <label className="label" htmlFor={`details-${orderId}`}>
          Otros datos necesarios <span className="muted tiny">(opcional)</span>
        </label>
        <textarea
          className="textarea"
          id={`details-${orderId}`}
          name="details"
          rows={2}
          defaultValue={data?.details ?? ''}
          placeholder="Correo de la cuenta, plataforma, región…"
          maxLength={600}
        />
      </div>

      <button className="btn btn--sm" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar datos'}
      </button>

      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      {state?.success ? <p className="alert alert--ok">{state.success}</p> : null}
    </form>
  );
}
