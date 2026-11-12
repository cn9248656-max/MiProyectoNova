'use client';

import { useActionState } from 'react';
import { adminSyncSupportAction } from '../app/support-actions';
import type { ActionState } from '../lib/types';

/** Recupera desde Supabase las conversaciones que falten (solo agrega). */
export default function SupportSyncForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(adminSyncSupportAction, null);

  return (
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <button className="btn btn--ghost btn--sm" type="submit" disabled={pending}>
        {pending ? 'Sincronizando…' : 'Sincronizar con Supabase'}
      </button>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      {state?.success ? <p className="alert alert--success">{state.success}</p> : null}
    </form>
  );
}
