import Link from 'next/link';
import { redirect } from 'next/navigation';
import SupportChat from '../../../components/SupportChat';
import SupportSyncForm from '../../../components/SupportSyncForm';
import { adminSetSupportStatusAction } from '../../support-actions';
import { getCurrentUser } from '../../../lib/auth';
import * as support from '../../../lib/support';
import { getUserById } from '../../../lib/store';
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_CLASS,
  SUPPORT_STATUS_LABEL,
  SUPPORT_STATUS_ORDER,
  type SupportStatus,
} from '../../../lib/types';

export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' });

function fecha(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; estado?: string }>;
}) {
  // Doble comprobación: el layout ya protege /admin, aquí se repite en el servidor.
  const admin = await getCurrentUser();
  if (!admin) redirect('/login?next=/admin/soporte');
  if (admin.role !== 'ADMIN') redirect('/');

  const query = await searchParams;
  const filter = SUPPORT_STATUS_ORDER.includes(query.estado as SupportStatus) ? (query.estado as SupportStatus) : null;
  const tickets = support.listAllTickets({ status: filter });
  const counts = support.supportStatusCounts();
  const requested = query.t ? support.getTicket(query.t) : null;
  const selected = requested ?? tickets[0] ?? null;

  let messages: Awaited<ReturnType<typeof support.listMessages>> = [];
  if (selected) {
    support.markReadForAdmin(selected.id);
    messages = support.listMessages(selected.id);
  }

  const client = selected ? getUserById(selected.userId) : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Soporte al cliente</h1>
          <p className="page-subtitle">Responde las solicitudes, cambia su estado y envía los datos de acceso.</p>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="status status--pending">{counts.PENDING} pendientes</span>
          <span className="status status--sent">{counts.IN_PROGRESS} en proceso</span>
          <span className="status status--completed">{counts.RESOLVED} resueltas</span>
        </div>
      </div>

      <div className="support-toolbar">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn--ghost btn--sm" href="/admin/soporte" data-active={!filter}>
            Todas ({counts.PENDING + counts.IN_PROGRESS + counts.RESOLVED})
          </Link>
          {SUPPORT_STATUS_ORDER.map((status) => (
            <Link
              key={status}
              className="btn btn--ghost btn--sm"
              href={`/admin/soporte?estado=${status}`}
              data-active={filter === status}
            >
              {SUPPORT_STATUS_LABEL[status]} ({counts[status]})
            </Link>
          ))}
        </div>
        <SupportSyncForm />
      </div>

      <div className="support-layout">
        <section className="card">
          <h2 className="card__title" style={{ marginTop: 0 }}>
            Bandeja ({tickets.length})
          </h2>
          {tickets.length === 0 ? (
            <p className="tiny muted">No hay solicitudes con este filtro.</p>
          ) : (
            <div className="stack chat-list" style={{ gap: 8 }}>
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/admin/soporte?t=${ticket.id}${filter ? `&estado=${filter}` : ''}`}
                  className="chat-list__item"
                  data-active={selected?.id === ticket.id}
                  style={{ display: 'block' }}
                >
                  <div className="row row--between" style={{ gap: 8 }}>
                    <span className="mono tiny muted">{ticket.code}</span>
                    <span className={SUPPORT_STATUS_CLASS[ticket.status]}>{SUPPORT_STATUS_LABEL[ticket.status]}</span>
                  </div>
                  <strong style={{ display: 'block', marginTop: 4 }}>{ticket.subject}</strong>
                  <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                    {ticket.userName || 'Cliente'} · {SUPPORT_CATEGORY_LABEL[ticket.category]}
                  </p>
                  <p className="tiny muted" style={{ margin: '2px 0 0' }}>
                    {fecha(ticket.lastMessageAt || ticket.createdAt)}
                    {ticket.unreadForAdmin > 0 ? ` · ${ticket.unreadForAdmin} sin leer` : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

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
                      {SUPPORT_CATEGORY_LABEL[selected.category]} · {fecha(selected.createdAt)}
                    </p>
                  </div>
                  <span className={SUPPORT_STATUS_CLASS[selected.status]}>{SUPPORT_STATUS_LABEL[selected.status]}</span>
                </div>

                <div className="mini-block" style={{ marginTop: 12 }}>
                  <span className="tiny muted">Cliente</span>
                  <strong style={{ display: 'block' }}>{client?.name || selected.userName || 'Cliente'}</strong>
                  <span className="tiny muted">{client?.email || selected.userEmail || '—'}</span>
                  {client?.phone ? (
                    <span className="tiny muted" style={{ display: 'block' }}>
                      Tel. {client.phone}
                    </span>
                  ) : null}
                </div>

                <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {SUPPORT_STATUS_ORDER.map((status) => (
                    <form key={status} action={adminSetSupportStatusAction}>
                      <input type="hidden" name="ticketId" value={selected.id} />
                      <input type="hidden" name="status" value={status} />
                      <button
                        className={`btn btn--sm${selected.status === status ? ' primary' : ' btn--ghost'}`}
                        type="submit"
                      >
                        {SUPPORT_STATUS_LABEL[status]}
                      </button>
                    </form>
                  ))}
                </div>
              </section>

              <SupportChat
                ticketId={selected.id}
                initialMessages={messages}
                initialStatus={selected.status}
                role="ADMIN"
                partnerName={client?.name || selected.userName || 'Cliente'}
                emptyHint="Escribe la primera respuesta al cliente."
              />
            </>
          ) : (
            <section className="card">
              <h2 className="card__title">Bandeja vacía</h2>
              <p className="tiny muted">Cuando un cliente envíe una solicitud aparecerá aquí con su chat privado.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
