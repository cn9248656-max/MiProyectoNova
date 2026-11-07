'use client';

import { useActionState } from 'react';
import { passwordAction, productRequestAction, profileAction } from '../app/actions';
import type { ActionState } from '../lib/types';

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <div className="alert alert--error">{state.error}</div>;
  if (state.success) return <div className="alert alert--success">{state.success}</div>;
  return null;
}

export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(profileAction, null);

  return (
    <form action={formAction} className="stack">
      <Feedback state={state} />
      <div className="field">
        <label className="label" htmlFor="profile-name">
          Nombre completo
        </label>
        <input className="input" id="profile-name" name="name" defaultValue={name} required minLength={2} />
      </div>
      <div className="field">
        <label className="label" htmlFor="profile-phone">
          Teléfono / WhatsApp
        </label>
        <input className="input" id="profile-phone" name="phone" defaultValue={phone || ''} placeholder="+53 5555 5555" />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar datos personales'}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(passwordAction, null);

  return (
    <form action={formAction} className="stack">
      <Feedback state={state} />
      <div className="field">
        <label className="label" htmlFor="current-password">
          Contraseña actual
        </label>
        <input className="input" id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label className="label" htmlFor="new-password">
          Nueva contraseña
        </label>
        <input
          className="input"
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="repeat-password">
          Repetir nueva contraseña
        </label>
        <input
          className="input"
          id="repeat-password"
          name="repeatPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      <button className="btn btn--ghost" type="submit" disabled={pending}>
        {pending ? 'Actualizando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}

export function ProductRequestForm({ productId, productName }: { productId?: string; productName?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(productRequestAction, null);

  return (
    <form action={formAction} className="stack" id="solicitud">
      <Feedback state={state} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      <div className="field">
        <label className="label" htmlFor="request-name">
          Producto que deseas
        </label>
        <input
          className="input"
          id="request-name"
          name="productName"
          defaultValue={productName || ''}
          placeholder="Ej. Suscripción anual de música"
          required
          minLength={2}
          maxLength={120}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="request-message">
          Detalles <span className="muted tiny">(opcional)</span>
        </label>
        <textarea
          className="textarea"
          id="request-message"
          name="message"
          rows={3}
          placeholder="Plataforma, duración, región o cualquier detalle útil"
          maxLength={400}
        />
      </div>
      <button className="btn btn--outline" type="submit" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar solicitud al administrador'}
      </button>
    </form>
  );
}
