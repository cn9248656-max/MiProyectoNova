-- NovaStore · Recargas automáticas con Sip
-- Migración ADITIVA: solo agrega columnas y una tabla nueva.
-- No borra, no renombra y no reescribe ningún registro existente.

ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS sip_code text;
ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS sip_method text;
ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS sip_operation text;
ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS sip_transaction_id text;
ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS credited_at text;

CREATE UNIQUE INDEX IF NOT EXISTS topups_sip_code_idx
  ON public.topups (sip_code)
  WHERE sip_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sip_transactions (
  id text PRIMARY KEY,
  operation_number text NOT NULL,
  amount_cents bigint NOT NULL,
  reference_code text,
  sender_name text,
  sender_phone text,
  note text,
  source text NOT NULL DEFAULT 'WEBHOOK',
  status text NOT NULL DEFAULT 'RECEIVED',
  applied_topup_id text,
  user_id text,
  raw_payload text,
  received_at text NOT NULL,
  created_at text NOT NULL,
  applied_at text
);

CREATE UNIQUE INDEX IF NOT EXISTS sip_transactions_operation_idx
  ON public.sip_transactions (operation_number);

CREATE UNIQUE INDEX IF NOT EXISTS sip_transactions_applied_idx
  ON public.sip_transactions (applied_topup_id)
  WHERE applied_topup_id IS NOT NULL;

-- NovaStore sincroniza con RPC nova_upsert/nova_select usando el secreto de
-- servidor (SUPABASE_SYNC_SECRET). Las claves nunca se exponen al navegador,
-- por lo que no se agregan políticas RLS públicas para estas tablas.
