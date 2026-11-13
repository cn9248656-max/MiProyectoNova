-- ---------------------------------------------------------------------------
-- NovaStore · Persistencia completa en Supabase
--
-- QUÉ HACE
--   * Crea (solo si no existen) las tablas donde viven de forma permanente
--     usuarios, categorías, imágenes, productos, carrito, pedidos, recargas,
--     movimientos de saldo, configuraciones, solicitudes, notificaciones,
--     conversaciones y soporte.
--   * Activa RLS y retira todos los permisos de `anon` y `authenticated`:
--     nadie puede leer ni escribir las tablas con la clave pública.
--   * Expone únicamente tres funciones RPC para que el SERVIDOR de la tienda
--     sincronice datos: nova_upsert, nova_select y nova_delete.
--
-- SEGURIDAD
--   * Las funciones son SECURITY DEFINER y exigen un secreto de servidor
--     (public.sync_auth.secret) que solo existe en las variables de entorno de
--     la aplicación (SUPABASE_SYNC_SECRET). La Service Role Key, si se añade,
--     también funciona sin secreto.
--   * La clave privada NUNCA se expone al navegador: no hay ninguna variable
--     NEXT_PUBLIC_* implicada en la sincronización.
--
-- COMPATIBILIDAD
--   * Solo CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
--     CREATE INDEX IF NOT EXISTS / CREATE OR REPLACE FUNCTION.
--   * No borra ni reemplaza ninguna tabla ni ningún registro existente.
--   * Es compatible con supabase/soporte.sql (lo incluye y lo completa).
-- ---------------------------------------------------------------------------

-- 1) Tablas del núcleo de la tienda -----------------------------------------

create table if not exists public.users (
  id            text primary key,
  email         text not null unique,
  password_hash text not null,
  name          text not null,
  phone         text,
  role          text not null default 'USER',
  balance_cents integer not null default 0,
  created_at    text not null,
  updated_at    text not null
);

create table if not exists public.categories (
  id         text primary key,
  name       text not null,
  slug       text not null unique,
  icon       text not null default '✦',
  position   integer not null default 0,
  created_at text not null
);

-- Imágenes y comprobantes: se guardan como hexadecimal para viajar seguros
-- por JSON y volver a binario en el servidor.
create table if not exists public.uploads (
  id         text primary key,
  mime       text not null,
  size       integer not null,
  data       text not null,
  created_at text not null
);

create table if not exists public.products (
  id              text primary key,
  name            text not null,
  description     text not null default '',
  price_cents     integer not null,
  category_id     text not null,
  image_id        text,
  stock           integer not null default 0,
  unlimited_stock integer not null default 0,
  active          integer not null default 1,
  featured        integer not null default 0,
  created_at      text not null,
  updated_at      text not null
);

create table if not exists public.cart_items (
  id         text primary key,
  user_id    text not null,
  product_id text not null,
  quantity   integer not null,
  created_at text not null
);

create table if not exists public.orders (
  id             text primary key,
  code           text not null unique,
  user_id        text not null,
  subtotal_cents integer not null,
  total_cents    integer not null,
  status         text not null default 'PENDING',
  payment_method text not null,
  payment_status text not null default 'PENDING',
  reference      text,
  note           text,
  customer_data  text,
  created_at     text not null,
  updated_at     text not null
);

create table if not exists public.order_items (
  id          text primary key,
  order_id    text not null,
  product_id  text,
  name        text not null,
  price_cents integer not null,
  quantity    integer not null
);

create table if not exists public.topups (
  id           text primary key,
  user_id      text not null,
  amount_cents integer not null,
  method       text not null default 'AGORA',
  reference    text,
  receipt_id   text,
  status       text not null default 'PENDING',
  admin_note   text,
  created_at   text not null,
  reviewed_at  text,
  reviewed_by  text
);

create table if not exists public.wallet_transactions (
  id            text primary key,
  user_id       text not null,
  amount_cents  integer not null,
  type          text not null,
  description   text not null,
  order_id      text,
  topup_id      text,
  balance_after integer not null,
  created_at    text not null
);

create table if not exists public.settings (
  key   text primary key,
  value text not null
);

create table if not exists public.product_requests (
  id           text primary key,
  user_id      text not null,
  product_id   text,
  product_name text not null,
  message      text,
  status       text not null default 'OPEN',
  created_at   text not null
);

create table if not exists public.notifications (
  id         text primary key,
  type       text not null,
  title      text not null,
  message    text not null,
  link       text,
  read       integer not null default 0,
  created_at text not null
);

create table if not exists public.conversations (
  id              text primary key,
  user_id         text not null unique,
  created_at      text not null,
  updated_at      text not null,
  last_message_at text
);

create table if not exists public.messages (
  id              text primary key,
  conversation_id text not null,
  sender_role     text not null,
  sender_id       text not null,
  body            text not null,
  read_by_user    integer not null default 0,
  read_by_admin   integer not null default 0,
  created_at      text not null
);

-- 2) Soporte al cliente (compatible con supabase/soporte.sql) ---------------

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
  ticket_id   text not null,
  sender_role text not null check (sender_role in ('USER', 'ADMIN')),
  sender_id   text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Columnas de lectura: se agregan solo si la tabla venía de soporte.sql.
alter table public.support_messages add column if not exists read_by_user integer not null default 0;
alter table public.support_messages add column if not exists read_by_admin integer not null default 0;

-- 3) Índices ---------------------------------------------------------------

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_idx on public.products (active);
create index if not exists cart_items_user_idx on public.cart_items (user_id);
create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists topups_user_idx on public.topups (user_id);
create index if not exists topups_status_idx on public.topups (status);
create index if not exists wallet_user_idx on public.wallet_transactions (user_id);
create index if not exists notifications_read_idx on public.notifications (read);
create index if not exists conversations_last_idx on public.conversations (last_message_at);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- 4) RLS: nada accesible con la clave pública ------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'users','categories','uploads','products','cart_items','orders','order_items',
    'topups','wallet_transactions','settings','product_requests','notifications',
    'conversations','messages','support_tickets','support_messages','sip_transactions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 5) Secreto de servidor ---------------------------------------------------

create table if not exists public.sync_auth (
  id     integer primary key,
  secret text
);

alter table public.sync_auth enable row level security;
revoke all on public.sync_auth from anon, authenticated;

insert into public.sync_auth (id, secret) values (1, null)
on conflict (id) do nothing;

-- Registra el secreto una sola vez (mientras esté vacío). Lo llama el
-- administrador al configurar la tienda; después ya no puede cambiarse así.
create or replace function public.nova_bootstrap_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current text;
begin
  if p_secret is null or length(p_secret) < 32 then
    raise exception 'nova: el secreto debe tener al menos 32 caracteres' using errcode = '22023';
  end if;
  select secret into v_current from public.sync_auth where id = 1;
  if v_current is not null then
    raise exception 'nova: el secreto ya está configurado' using errcode = '42501';
  end if;
  update public.sync_auth set secret = p_secret where id = 1;
end $$;

-- 6) Guardia de autorización ----------------------------------------------

create or replace function public.nova_guard(p_secret text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected text;
  v_role text;
begin
  -- La Service Role Key (si existe) se salta el secreto: es una credencial
  -- privada que solo vive en el servidor.
  v_role := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
  if v_role = 'service_role' then
    return;
  end if;

  select secret into v_expected from public.sync_auth where id = 1;
  if v_expected is null or p_secret is null or p_secret <> v_expected then
    raise exception 'nova: no autorizado' using errcode = '42501';
  end if;
end $$;

-- 7) Funciones de sincronización ------------------------------------------

create or replace function public.nova_upsert(p_secret text, p_table text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pk   text;
  v_cols text;
  v_sets text;
  v_sql  text;
  v_rows integer;
begin
  perform public.nova_guard(p_secret);

  if p_table is null or not (p_table = any (array[
    'users','categories','uploads','products','cart_items','orders','order_items',
    'topups','wallet_transactions','settings','product_requests','notifications',
    'conversations','messages','support_tickets','support_messages','sip_transactions'
  ])) then
    raise exception 'nova_upsert: tabla no permitida' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;

  select a.attname into v_pk
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
   where i.indrelid = format('public.%I', p_table)::regclass
     and i.indisprimary
   limit 1;

  if v_pk is null then
    raise exception 'nova_upsert: la tabla % no tiene clave primaria', p_table;
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg(format('%I = excluded.%I', column_name, column_name), ', ' order by ordinal_position)
           filter (where column_name <> v_pk)
    into v_cols, v_sets
    from information_schema.columns
   where table_schema = 'public'
     and table_name = p_table
     and is_generated <> 'ALWAYS';

  v_sql := format(
    'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (%I) do update set %s',
    p_table, v_cols, v_cols, p_table, v_pk, coalesce(v_sets, format('%I = excluded.%I', v_pk, v_pk))
  );

  execute v_sql using p_rows;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

create or replace function public.nova_select(p_secret text, p_table text, p_limit integer default 5000)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sql  text;
  v_json jsonb;
  v_limit integer;
begin
  perform public.nova_guard(p_secret);

  if p_table is null or not (p_table = any (array[
    'users','categories','uploads','products','cart_items','orders','order_items',
    'topups','wallet_transactions','settings','product_requests','notifications',
    'conversations','messages','support_tickets','support_messages','sip_transactions'
  ])) then
    raise exception 'nova_select: tabla no permitida' using errcode = '42501';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 5000), 20000));
  v_sql := format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from public.%I limit %s) t', p_table, v_limit);
  execute v_sql into v_json;
  return coalesce(v_json, '[]'::jsonb);
end $$;

create or replace function public.nova_delete(p_secret text, p_table text, p_keys jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pk   text;
  v_sql  text;
  v_rows integer;
begin
  perform public.nova_guard(p_secret);

  if p_table is null or not (p_table = any (array[
    'users','categories','uploads','products','cart_items','orders','order_items',
    'topups','wallet_transactions','settings','product_requests','notifications',
    'conversations','messages','support_tickets','support_messages','sip_transactions'
  ])) then
    raise exception 'nova_delete: tabla no permitida' using errcode = '42501';
  end if;

  if p_keys is null or jsonb_typeof(p_keys) <> 'array' then
    return 0;
  end if;

  select a.attname into v_pk
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
   where i.indrelid = format('public.%I', p_table)::regclass
     and i.indisprimary
   limit 1;

  v_sql := format(
    'delete from public.%I where %I in (select value from jsonb_array_elements_text($1))',
    p_table, v_pk
  );
  execute v_sql using p_keys;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

-- 8) Permisos: solo ejecutar las funciones, nunca tocar tablas -------------

revoke all on function public.nova_bootstrap_secret(text) from public;
revoke all on function public.nova_guard(text) from public;
revoke all on function public.nova_upsert(text, text, jsonb) from public;
revoke all on function public.nova_select(text, text, integer) from public;
revoke all on function public.nova_delete(text, text, jsonb) from public;

grant execute on function public.nova_upsert(text, text, jsonb) to anon, authenticated;
grant execute on function public.nova_select(text, text, integer) to anon, authenticated;
grant execute on function public.nova_delete(text, text, jsonb) to anon, authenticated;
grant execute on function public.nova_bootstrap_secret(text) to anon, authenticated;


-- 9) Recargas Sip (aditivo): columnas nuevas y operaciones recibidas --------

alter table public.topups add column if not exists sip_code          text;
alter table public.topups add column if not exists sip_method        text;
alter table public.topups add column if not exists sip_operation     text;
alter table public.topups add column if not exists sip_transaction_id text;
alter table public.topups add column if not exists credited_at       text;

create table if not exists public.sip_transactions (
  id               text primary key,
  operation_number text not null,
  amount_cents     integer not null,
  reference_code   text,
  sender_name      text,
  sender_phone     text,
  note             text,
  source           text not null default 'WEBHOOK',
  raw_payload      text,
  status           text not null default 'PENDING',
  user_id          text,
  applied_topup_id text,
  applied_at       text,
  created_at       text not null,
  updated_at       text not null
);

create unique index if not exists sip_transactions_operation_key on public.sip_transactions (operation_number);
create index if not exists sip_transactions_status_idx on public.sip_transactions (status, created_at);
create index if not exists topups_sip_code_idx on public.topups (sip_code);

alter table public.sip_transactions enable row level security;
revoke all on public.sip_transactions from anon, authenticated;

-- Fin. NovaStore sigue usando su base local como caché rápida y Supabase como
-- almacenamiento permanente: cada cambio se replica y, al arrancar un
-- contenedor nuevo, todo se recupera desde aquí.
