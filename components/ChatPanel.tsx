'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { adminSendMessageAction, sendMessageAction } from '../app/actions';
import type { ActionState, ChatMessage } from '../lib/types';

const timeFormat = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' });

function label(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? timeFormat.format(date) : `${dayFormat.format(date)} ${timeFormat.format(date)}`;
}

export default function ChatPanel({
  conversationId,
  initialMessages,
  role,
  partnerName,
  emptyHint,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  role: 'USER' | 'ADMIN';
  partnerName: string;
  emptyHint: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    role === 'ADMIN' ? adminSendMessageAction : sendMessageAction,
    null
  );
  const [live, setLive] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastIdRef = useRef<string>(initialMessages.length ? initialMessages[initialMessages.length - 1].id : '');

  const merge = useCallback((incoming: ChatMessage[]) => {
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
    const params = new URLSearchParams({ conversation: conversationId });
    if (lastIdRef.current) params.set('after', lastIdRef.current);
    try {
      const response = await fetch(`/api/chat?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        setLive(false);
        return;
      }
      const data = (await response.json()) as { messages?: ChatMessage[] };
      setLive(true);
      if (Array.isArray(data.messages)) merge(data.messages);
    } catch {
      setLive(false);
    }
  }, [conversationId, merge]);

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
          <p className="chat-sub">
            Chat privado · el historial queda guardado
          </p>
        </div>
        <span className={`live-dot${live ? ' on' : ''}`} title={live ? 'Actualizando en vivo' : 'Sin conexión'}>
          {live ? 'En vivo' : 'Reconectando'}
        </span>
      </header>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 ? <p className="chat-empty">{emptyHint}</p> : null}
        {messages.map((message) => {
          const mine = message.senderRole === role;
          return (
            <article key={message.id} className={`chat-msg${mine ? ' own' : ''}`}>
              <div className="chat-bubble">{message.body}</div>
              <p className="chat-meta">
                {mine ? 'Tú' : message.senderName || (message.senderRole === 'ADMIN' ? 'Administrador' : 'Cliente')} ·{' '}
                {label(message.createdAt)}
              </p>
            </article>
          );
        })}
      </div>

      <form action={formAction} ref={formRef} className="chat-form">
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea
          name="body"
          rows={2}
          maxLength={2000}
          placeholder={
            role === 'ADMIN'
              ? 'Escribe los datos de acceso o tu respuesta al cliente…'
              : 'Escribe tu mensaje al administrador…'
          }
          required
        />
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar'}
        </button>
      </form>

      {state?.error ? <p className="alert error">{state.error}</p> : null}
      {state?.success ? <p className="alert ok">{state.success}</p> : null}
    </section>
  );
}
