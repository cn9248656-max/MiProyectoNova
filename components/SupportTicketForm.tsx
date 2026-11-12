'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createSupportTicketAction } from '../app/support-actions';
import { SUPPORT_CATEGORY_LABEL, SUPPORT_CATEGORY_OPTIONS, type ActionState } from '../lib/types';

export default function SupportTicketForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createSupportTicketAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form action={formAction} ref={formRef} className="stack">
      {state?.error ? <div className="alert alert--error">{state.error}</div> : null}
      {state?.success ? <div className="alert alert--success">{state.success}</div> : null}

      <div className="field">
        <label className="label" htmlFor="support-category">
          Tipo de solicitud
        </label>
        <select className="select" id="support-category" name="category" defaultValue="QUESTION">
          {SUPPORT_CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {SUPPORT_CATEGORY_LABEL[category]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="support-subject">
          Asunto
        </label>
        <input
          className="input"
          id="support-subject"
          name="subject"
          maxLength={120}
          minLength={4}
          placeholder="Ej. No recibí mi producto"
          required
        />
        <span className="hint">Un resumen corto para identificar tu caso.</span>
      </div>

      <div className="field">
        <label className="label" htmlFor="support-message">
          Cuéntanos qué necesitas
        </label>
        <textarea
          className="textarea"
          id="support-message"
          name="message"
          rows={4}
          maxLength={2000}
          minLength={5}
          placeholder="Describe tu consulta, reclamo o problema con el mayor detalle posible."
          required
        />
        <span className="hint">Máximo 2000 caracteres. El administrador recibirá una notificación.</span>
      </div>

      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Enviando solicitud…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}
