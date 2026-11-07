'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, registerAction } from '../app/actions';
import type { ActionState } from '../lib/types';

export default function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const action = mode === 'login' ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  const isLogin = mode === 'login';

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="alert alert--error">{state.error}</div> : null}

      {!isLogin ? (
        <div className="field">
          <label className="label" htmlFor="name">
            Nombre completo
          </label>
          <input className="input" id="name" name="name" autoComplete="name" placeholder="Tu nombre" required minLength={2} />
        </div>
      ) : null}

      <div className="field">
        <label className="label" htmlFor="email">
          Correo electrónico
        </label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" required />
      </div>

      {!isLogin ? (
        <div className="field">
          <label className="label" htmlFor="phone">
            Teléfono / WhatsApp <span className="muted tiny">(opcional)</span>
          </label>
          <input className="input" id="phone" name="phone" autoComplete="tel" placeholder="+53 5555 5555" />
        </div>
      ) : null}

      <div className="field">
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          placeholder="Mínimo 6 caracteres"
          required
          minLength={6}
        />
      </div>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <button className="btn btn--block" type="submit" disabled={pending}>
        {pending ? 'Procesando…' : isLogin ? 'Entrar a mi cuenta' : 'Crear mi cuenta'}
      </button>

      <p className="hint" style={{ textAlign: 'center' }}>
        {isLogin ? (
          <>
            ¿Aún no tienes cuenta? <Link className="link" href="/registro">Regístrate</Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta? <Link className="link" href="/login">Inicia sesión</Link>
          </>
        )}
      </p>

      {!isLogin ? (
        <p className="tiny muted" style={{ textAlign: 'center' }}>
          La primera cuenta creada en la tienda se convierte automáticamente en administrador.
        </p>
      ) : null}
    </form>
  );
}
