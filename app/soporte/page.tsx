import Link from 'next/link';
import { redirect } from 'next/navigation';
import SupportChat from '../../components/SupportChat';
import SupportTicketForm from '../../components/SupportTicketForm';
import { getCurrentUser } from '../../lib/auth';
import * as support from '../../lib/support';
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_CLASS, SUPPORT_STATUS_LABEL } from '../../lib/types';

export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' });

function fecha(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/soporte');

  const query = await searchParams;
  // Solo las solicitudes de este usuario: el filtro se aplica en el servidor.
  const tickets = support.listTicketsForUser(user.id);
  const requested = query.t ? support.getTicketForUser(query.t, user.id) : null;
  const selected = requested ?? tickets[0] ?? null;

  let messages: Awaited<ReturnType<typeof support.listMessages>> = [];
  if (selected) {
    support.markReadForUser(selected.id, user.id);
    messages = support.listMessages(selected.id);
  }

  const pending = tickets.filter((ticket) => ticket.status !== 'RESOLVED').length;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Soporte al cliente</h1>
          <p className="page-subtitle">
            Envía consultas, dudas, reclamos o reporta un problema. Un administrador te responde por este chat privado.
          </p>
        </div>
        <span className={pending > 0 ? 'status status--pending' : 'status status--completed'}>
          {pending > 0 ? `${pending} solicitud(es) abierta(s)` : 'Sin solicitudes abiertas'}
        </span>
      </div>

      <div className="support-layout">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <h2 className="card__title">Nueva solicitud</h2>
            <p className="hint" style={{ marginTop: 0 }}>
              Cuéntanos qué necesitas. Queda guardada en tu historial y el administrador recibe una notificación.
            </p>
            <SupportTicketForm />
          </section>

          <section className="card">
            <div className="row row--between" style={{ marginBottom: 10 }}>
              <h2 className="card__title" style={{ margin: 0 }}>
                Mis solicitudes
              </h2>
              <span className="tiny muted">{tickets.length}</span>
            </div>

            {tickets.length === 0 ? (
              <p className="tiny muted">Todavía no has enviado solicitudes. Usa el formulario de arriba.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {tickets.map((ticket) => {
                  const active = selected?.id === ticket.id;
                  return (
                    <Link
                      key={ticket.id}
                      href={`/soporte?t=${ticket.id}`}
                      className="chat-list__item"
                      data-active={active}
                      style={{ display: 'block' }}
                    >
                      <div className="row row--between" style={{ gap: 8 }}>
                        <span className="mono tiny muted">{ticket.code}</span>
                        <span className={SUPPORT_STATUS_CLASS[ticket.status]}>{SUPPORT_STATUS_LABEL[ticket.status]}</span>
                      </div>
                      <strong style={{ display: 'block', marginTop: 4 }}>{ticket.subject}</strong>
                      <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                        {SUPPORT_CATEGORY_LABEL[ticket.category]} · {fecha(ticket.lastMessageAt || ticket.createdAt)}
                      </p>
                      {ticket.unreadForUser > 0 ? (
                        <span className="tiny" style={{ color: '#c4b5fd' }}>
                          {ticket.unreadForUser} respuesta(s) sin leer
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {selected ? (
            <>
              <section className="card">
                <div className="row row--between" style={{ gap: 12 }}>
                  <div>
                    <span className="mono tiny muted">{selected.code}</span>
                    <h2 className="card__title" style={{ margin: '2px 0 0' }}>
                      {selected.subject}
                    </h2>
                    <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                      {SUPPORT_CATEGORY_LABEL[selected.category]} · abierta el {fecha(selected.createdAt)}
                    </p>
                  </div>
                  <span className={SUPPORT_STATUS_CLASS[selected.status]}>{SUPPORT_STATUS_LABEL[selected.status]}</span>
                </div>
              </section>

              <SupportChat
                ticketId={selected.id}
                initialMessages={messages}
                initialStatus={selected.status}
                role="USER"
                partnerName="Soporte NovaStore"
                emptyHint="Escribe tu primer mensaje para empezar la conversación."
              />
            </>
          ) : (
            <section className="card">
              <h2 className="card__title">Tu chat de soporte</h2>
              <p className="tiny muted">
                Cuando envíes una solicitud aparecerá aquí el chat privado con el administrador, con su estado y todo el
                historial guardado.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
