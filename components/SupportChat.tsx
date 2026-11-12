'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { adminReplySupportAction, sendSupportMessageAction } from '../app/support-actions';
import { SUPPORT_STATUS_CLASS, SUPPORT_STATUS_LABEL, type ActionState, type SupportMessage, type SupportStatus } from '../lib/types';

const timeFormat = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' });

function label(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? timeFormat.format(date) : `${dayFormat.format(date)} ${timeFormat.format(date)}`;
}

export default function SupportChat({
  ticketId,
  initialMessages,
  initialStatus,
  role,
  partnerName,
  emptyHint,
}: {
  ticketId: string;
  initialMessages: SupportMessage[];
  initialStatus: SupportStatus;
  role: 'USER' | 'ADMIN';
  partnerName: string;
  emptyHint: string;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [status, setStatus] = useState<SupportStatus>(initialStatus);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    role === 'ADMIN' ? adminReplySupportAction : sendSupportMessageAction,
    null
  );
  const [live, setLive] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastIdRef = useRef<string>(initialMessages.length ? initialMessages[initialMessages.length - 1].id : '');

  const merge = useCallback((incoming: SupportMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((item) => item.id));
      const next = [...prev];
      for (const item of incoming) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          next.push(item);
        }
      }
      lastIdRef.current = next.length ? next[next.length - 1].id : lastIdRef.current;
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ ticket: ticketId });
    if (lastIdRef.current) params.set('after', lastIdRef.current);
    try {
      const response = await fetch(`/api/support?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        setLive(false);
        return;
      }
      const data = (await response.json()) as { messages?: SupportMessage[]; status?: SupportStatus };
      setLive(true);
      if (data.status) setStatus(data.status);
      if (Array.isArray(data.messages)) merge(data.messages);
    } catch {
      setLive(false);
    }
  }, [ticketId, merge]);

  useEffect(() => {
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      void refresh();
    }
  }, [state, refresh]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  return (
    <section className="chat">
      <header className="chat-head">
        <div>
          <strong>{partnerName}</strong>
          <p className="chat-sub">Chat privado de soporte · el historial queda guardado</p>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className={SUPPORT_STATUS_CLASS[status]}>{SUPPORT_STATUS_LABEL[status]}</span>
          <span className={`live-dot${live ? ' on' : ''}`} title={live ? 'Actualizando en vivo' : 'Sin conexión'}>
            {live ? 'En vivo' : 'Reconectando'}
          </span>
        </div>
      </header>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 ? <p className="chat-empty">{emptyHint}</p> : null}
        {messages.map((message) => {
          const mine = message.senderRole === role;
          return (
            <article key={message.id} className={`chat-msg${mine ? ' own' : ''}`}>
              <div className="chat-bubble">{message.body}</div>
              <p className="chat-meta">
                {mine ? 'Tú' : message.senderName || (message.senderRole === 'ADMIN' ? 'Soporte NovaStore' : 'Cliente')} ·{' '}
                {label(message.createdAt)}
              </p>
            </article>
          );
        })}
      </div>

      <form action={formAction} ref={formRef} className="chat-form">
        <input type="hidden" name="ticketId" value={ticketId} />
        <textarea
          name="body"
          rows={2}
          maxLength={2000}
          placeholder={
            role === 'ADMIN'
              ? 'Escribe la respuesta, los datos de acceso o los pasos a seguir…'
              : 'Escribe tu mensaje al equipo de soporte…'
          }
          required
        />
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar'}
        </button>
      </form>

      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      {state?.success ? <p className="alert alert--success">{state.success}</p> : null}
    </section>
  );
}
