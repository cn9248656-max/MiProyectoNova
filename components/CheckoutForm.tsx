'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { checkoutAction } from '../app/actions';
import { formatMoney } from '../lib/money';
import type { ActionState, PaymentMethod } from '../lib/types';

export default function CheckoutForm({
  totalCents,
  balanceCents,
  currency,
  agoraAlias,
  agoraPhone,
  agoraHolder,
  agoraNote,
}: {
  totalCents: number;
  balanceCents: number;
  currency: string;
  agoraAlias: string;
  agoraPhone: string;
  agoraHolder: string;
  agoraNote: string;
}) {
  const canPayWithBalance = balanceCents >= totalCents;
  const [method, setMethod] = useState<PaymentMethod>(canPayWithBalance ? 'BALANCE' : 'AGORA');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(checkoutAction, null);

  return (
    <form action={formAction} className="stack" style={{ marginTop: 18 }}>
      {state?.error ? <div className="alert alert--error">{state.error}</div> : null}

      <div className="field">
        <span className="label">Método de pago</span>

        <label className="pay-option" data-selected={method === 'BALANCE'} data-disabled={!canPayWithBalance}>
          <input
            type="radio"
            name="paymentMethod"
            value="BALANCE"
            checked={method === 'BALANCE'}
            onChange={() => setMethod('BALANCE')}
            disabled={!canPayWithBalance}
          />
          <span>
            <strong>Saldo NovaStore</strong>
            <small>
              Disponible: {formatMoney(balanceCents, currency)}
              {!canPayWithBalance ? ' · saldo insuficiente' : ' · se descuenta al confirmar'}
            </small>
          </span>
        </label>

        <label className="pay-option" data-selected={method === 'AGORA'}>
          <input
            type="radio"
            name="paymentMethod"
            value="AGORA"
            checked={method === 'AGORA'}
            onChange={() => setMethod('AGORA')}
          />
          <span>
            <strong>Pagar aparte por Agora</strong>
            <small>Transfiere el total y adjunta la referencia del pago.</small>
          </span>
        </label>
      </div>

      {method === 'AGORA' ? (
        <div className="card card--flat" style={{ padding: 14 }}>
          <p className="tiny muted" style={{ marginTop: 0 }}>
            Datos para pagar por Agora:
          </p>
          <div className="kv">
            <span>Alias</span>
            <strong>{agoraAlias || 'Configúralo en administración'}</strong>
          </div>
          <div className="kv">
            <span>Teléfono</span>
            <strong>{agoraPhone || '—'}</strong>
          </div>
          <div className="kv">
            <span>Titular</span>
            <strong>{agoraHolder || '—'}</strong>
          </div>
          {agoraNote ? <p className="hint" style={{ marginBottom: 0 }}>{agoraNote}</p> : null}
          <div className="field" style={{ marginTop: 12 }}>
            <label className="label" htmlFor="reference">
              Referencia del pago <span className="muted tiny">(opcional)</span>
            </label>
            <input className="input" id="reference" name="reference" placeholder="Ej. 123456789" maxLength={80} />
          </div>
        </div>
      ) : null}

      <div className="card card--flat" style={{ padding: 14 }}>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          Datos para recibir tu producto. El administrador los verá en tu pedido y podrá responderte por el chat privado.
        </p>
        <div className="field">
          <label className="label" htmlFor="playerId">
            ID de jugador / Free Fire <span className="muted tiny">(si aplica)</span>
          </label>
          <input className="input" id="playerId" name="playerId" placeholder="Ej. 1234567890" maxLength={120} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label" htmlFor="customerDetails">
            Otros datos necesarios <span className="muted tiny">(opcional)</span>
          </label>
          <textarea
            className="textarea"
            id="customerDetails"
            name="customerDetails"
            rows={2}
            placeholder="Correo de la cuenta, plataforma, región…"
            maxLength={600}
          />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="note">
          Nota para el administrador <span className="muted tiny">(opcional)</span>
        </label>
        <textarea className="textarea" id="note" name="note" rows={2} placeholder="Datos de entrega o aclaraciones" maxLength={300} />
      </div>

      <button className="btn btn--block" type="submit" disabled={pending}>
        {pending ? 'Confirmando…' : `Confirmar compra · ${formatMoney(totalCents, currency)}`}
      </button>

      {!canPayWithBalance ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          Tu saldo no alcanza el total. Puedes <Link className="link" href="/saldo">añadir saldo</Link> o pagar aparte
          mediante Agora.
        </p>
      ) : null}
    </form>
  );
}
