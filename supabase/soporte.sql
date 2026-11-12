-- ---------------------------------------------------------------------------
-- NovaStore · Soporte al cliente en Supabase
--
-- Ejecuta este archivo en el SQL Editor de tu proyecto Supabase.
-- Solo crea tablas nuevas y activa RLS: no toca ninguna tabla existente.
--
-- Modelo de seguridad
--   * RLS activado en ambas tablas y SIN políticas públicas: `anon` y
--     `authenticated` no pueden leer ni escribir nada, ni siquiera con la
--     anon key. Toda lectura/escritura pasa por el servidor de la tienda,
--     que usa la Service Role Key (nunca en el frontend).
--   * La tienda NovaStore autentica con su propia sesión firmada (cookie
--     nova_session), no con Supabase Auth. Por eso la propiedad de cada
--     conversación se verifica en el servidor comparando user_id.
--   * Si más adelante activas Supabase Auth, las políticas comentadas del
--     final permiten que cada usuario lea solo sus filas (auth.uid()).
-- ---------------------------------------------------------------------------

create table if not exists public.support_tickets (
  id              text primary key,
  code            text not null unique,
  user_id         text not null,
  user_email      text,
  user_name       text,
  subject         text not null,
  category        text not null default 'QUESTION',
  status          text not null default 'PENDING'
                  check (status in ('PENDING', 'IN_PROGRESS', 'RESOLVED')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.support_messages (
  id          text primary key,
  ticket_id   text not null references public.support_tickets (id) on delete cascade,
  sender_role text not null check (sender_role in ('USER', 'ADMIN')),
  sender_id   text not null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets (user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- Sin políticas para anon/authenticated: acceso únicamente desde el servidor
-- con la Service Role Key, que se salta RLS. Nada queda expuesto al navegador.
revoke all on public.support_tickets from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;

-- ---------------------------------------------------------------------------
-- OPCIONAL · si usas Supabase Auth con user_id = auth.uid()::text
-- Descomenta para que cada usuario pueda leer solo su conversación.
-- ---------------------------------------------------------------------------
-- create policy "support_tickets_own_read"
--   on public.support_tickets for select
--   to authenticated
--   using (user_id = auth.uid()::text);
--
-- create policy "support_messages_own_read"
--   on public.support_messages for select
--   to authenticated
--   using (
--     exists (
--       select 1 from public.support_tickets t
--       where t.id = support_messages.ticket_id
--         and t.user_id = auth.uid()::text
--     )
--   );
