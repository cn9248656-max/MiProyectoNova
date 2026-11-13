/**
 * Recargas automáticas con Sip como cuenta receptora.
 *
 * Flujo real (sin simular una API que Sip no publica):
 *   1. El cliente pide una recarga y NovaStore genera un código único NOVA####.
 *   2. El cliente transfiere desde Yape, Plin, Sip u otra app compatible usando
 *      ese código como referencia y declara el número de operación.
 *   3. El dinero recibido en la cuenta Sip entra al sistema por el webhook
 *      /api/sip/webhook (si el banco/proveedor lo envía) o porque el
 *      administrador registra la operación que ve en su cuenta Sip.
 *   4. `reconcileSipTransaction` verifica monto y código y, solo entonces,
 *      acredita el saldo una única vez.
 *
 * Garantías:
 *   - `sip_transactions.operation_number` es único: una transferencia no puede
 *     registrarse dos veces ni usarse para dos clientes.
 *   - La acreditación exige que la recarga siga PENDING y que no exista un
 *     movimiento de billetera previo para esa recarga.
 *   - Si el monto no coincide, no se acredita: queda marcado y se avisa al
 *     administrador.
 */

import crypto from 'node:crypto';
import { db, id, now } from './db';
import * as store from './store';
import type { SipAccount, SipStatus, SipTransaction, SipTransactionStatus, Topup } from './types';

type Row = Record<string, unknown>;

export class SipError extends Error {}

const SIP_METHODS = ['YAPE', 'PLIN', 'SIP', 'OTRO'] as const;
export type SipMethod = (typeof SIP_METHODS)[number];

export const SIP_METHOD_LABEL: Record<string, string> = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  SIP: 'Sip',
  OTRO: 'Otra transferencia',
};

const MIN_AMOUNT_CENTS = 100;
const MAX_AMOUNT_CENTS = 100000000;

/* ------------------------------------------------------------------ */
/* Ajustes guardados en la tabla settings (nunca en el frontend)       */
/* ------------------------------------------------------------------ */

const KEYS = {
  holder: 'sip_holder',
  number: 'sip_number',
  alias: 'sip_alias',
  cci: 'sip_cci',
  note: 'sip_note',
  auto: 'sip_auto',
  apiUrl: 'sip_api_url',
  apiKey: 'sip_api_key',
  webhookSecret: 'sip_webhook_secret',
} as const;

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function rawSetting(key: string): string {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as Row | undefined;
  return str(row?.value);
}

function putSetting(key: string, value: string): void {
  db()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value.slice(0, 600));
}

function secretKey(): Buffer {
  const secret = process.env.SESSION_SECRET || rawSetting('session_secret');
  if (!secret) throw new SipError('Falta el secreto de sesión para cifrar los datos de Sip.');
  return crypto.scryptSync(secret, 'novastore-sip', 32);
}

/** Cifra un secreto (clave API o secreto del webhook) con AES-256-GCM. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['sipenc1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join(':');
}

function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith('sipenc1:')) return '';
  const [, iv, tag, data] = stored.split(':');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* Cuenta Sip pública (la que ve el cliente para transferir)           */
/* ------------------------------------------------------------------ */

export function getSipAccount(): SipAccount {
  return {
    holder: rawSetting(KEYS.holder),
    number: rawSetting(KEYS.number),
    alias: rawSetting(KEYS.alias),
    cci: rawSetting(KEYS.cci),
    note: rawSetting(KEYS.note),
    auto: rawSetting(KEYS.auto) !== '0',
  };
}

/** Datos internos para el panel: nunca incluye la clave ni el secreto en claro. */
export function getSipStatus(): SipStatus {
  const account = getSipAccount();
  return {
    ...account,
    configured: Boolean(account.holder && account.number),
    apiUrl: rawSetting(KEYS.apiUrl),
    hasApiKey: Boolean(rawSetting(KEYS.apiKey)),
    hasWebhookSecret: Boolean(rawSetting(KEYS.webhookSecret) || process.env.SIP_WEBHOOK_SECRET),
    webhookPath: '/api/sip/webhook',
  };
}

export function saveSipSettings(input: {
  holder?: string;
  number?: string;
  alias?: string;
  cci?: string;
  note?: string;
  auto?: boolean;
  apiUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  webhookSecret?: string;
  generateWebhookSecret?: boolean;
}): { ok: boolean; error?: string; webhookSecret?: string } {
  try {
    if (input.holder !== undefined) putSetting(KEYS.holder, input.holder.trim().slice(0, 120));
    if (input.number !== undefined) putSetting(KEYS.number, input.number.trim().slice(0, 40));
    if (input.alias !== undefined) putSetting(KEYS.alias, input.alias.trim().slice(0, 60));
    if (input.cci !== undefined) putSetting(KEYS.cci, input.cci.trim().slice(0, 40));
    if (input.note !== undefined) putSetting(KEYS.note, input.note.trim().slice(0, 400));
    if (input.auto !== undefined) putSetting(KEYS.auto, input.auto ? '1' : '0');
    if (input.apiUrl !== undefined) putSetting(KEYS.apiUrl, input.apiUrl.trim().slice(0, 300));

    if (input.clearApiKey) putSetting(KEYS.apiKey, '');
    if (input.apiKey && input.apiKey.trim()) putSetting(KEYS.apiKey, encryptSecret(input.apiKey.trim()));

    let generated: string | undefined;
    if (input.generateWebhookSecret) {
      generated = `sipwh_${crypto.randomBytes(24).toString('base64url')}`;
      putSetting(KEYS.webhookSecret, encryptSecret(generated));
    } else if (input.webhookSecret && input.webhookSecret.trim()) {
      putSetting(KEYS.webhookSecret, encryptSecret(input.webhookSecret.trim()));
    }
    return { ok: true, webhookSecret: generated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar la configuración de Sip.' };
  }
}

/** Secreto con el que se valida el webhook (settings cifrado o variable de entorno). */
export function webhookSecret(): string {
  const stored = decryptSecret(rawSetting(KEYS.webhookSecret));
  if (stored) return stored;
  return process.env.SIP_WEBHOOK_SECRET || '';
}

export function verifyWebhookSecret(provided: string): boolean {
  const expected = webhookSecret();
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function sipApiKey(): string {
  return decryptSecret(rawSetting(KEYS.apiKey));
}

export function sipApiUrl(): string {
  return rawSetting(KEYS.apiUrl);
}

/* ------------------------------------------------------------------ */
/* Códigos únicos                                                      */
/* ------------------------------------------------------------------ */

function codeExists(code: string): boolean {
  const row = db().prepare('SELECT id FROM topups WHERE sip_code = ?').get(code) as Row | undefined;
  return Boolean(row);
}

/** Genera un código único tipo NOVA5821 (nunca reutiliza uno existente). */
export function generateSipCode(): string {
  for (const digits of [4, 4, 4, 4, 5, 6]) {
    const max = 10 ** digits;
    const code = `NOVA${String(crypto.randomInt(0, max)).padStart(digits, '0')}`;
    if (!codeExists(code)) return code;
  }
  // Salida improbable: código derivado del tiempo, siempre único.
  let candidate = '';
  do {
    candidate = `NOVA${String(Date.now()).slice(-6)}${String(crypto.randomInt(0, 100)).padStart(2, '0')}`;
  } while (codeExists(candidate));
  return candidate;
}

/** Extrae el código NovaStore de un texto libre (referencia, glosa, concepto). */
export function extractCode(text: string): string {
  const match = text.toUpperCase().match(/NOVA[\s-]*(\d{4,8})/);
  return match ? `NOVA${match[1]}` : '';
}

function normalizeMethod(value: string): SipMethod {
  const upper = value.trim().toUpperCase();
  return (SIP_METHODS as readonly string[]).includes(upper) ? (upper as SipMethod) : 'OTRO';
}

/* ------------------------------------------------------------------ */
/* Solicitudes de recarga                                              */
/* ------------------------------------------------------------------ */

export function createSipTopup(
  userId: string,
  input: { amountCents: number; method: string; receiptId?: string | null }
): { ok: true; id: string; code: string } | { ok: false; error: string } {
  if (!Number.isFinite(input.amountCents) || input.amountCents < MIN_AMOUNT_CENTS) {
    return { ok: false, error: 'El monto mínimo de recarga es de 1,00.' };
  }
  if (input.amountCents > MAX_AMOUNT_CENTS) return { ok: false, error: 'El monto excede el límite permitido.' };

  const user = store.getUserById(userId);
  if (!user) return { ok: false, error: 'Debes iniciar sesión.' };

  const method = normalizeMethod(input.method);
  const code = generateSipCode();
  const topupId = id('top_');

  db()
    .prepare(
      `INSERT INTO topups (id, user_id, amount_cents, method, reference, receipt_id, status, created_at, sip_code, sip_method)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(topupId, userId, input.amountCents, 'SIP', code, input.receiptId || null, 'PENDING', now(), code, method);

  store.notify(
    'TOPUP',
    'Nueva recarga Sip pendiente',
    `${user.name} solicitó ${(input.amountCents / 100).toFixed(2)} por ${SIP_METHOD_LABEL[method]} con el código ${code}.`,
    '/admin/recargas'
  );

  return { ok: true, id: topupId, code };
}

/** El cliente declara el número de operación (y comprobante) de su transferencia. */
export function attachSipOperation(input: {
  topupId: string;
  userId: string;
  operation: string;
  receiptId?: string | null;
}): { ok: boolean; error?: string; message?: string; credited?: boolean } {
  const row = db().prepare('SELECT * FROM topups WHERE id = ?').get(input.topupId) as Row | undefined;
  if (!row) return { ok: false, error: 'Recarga no encontrada.' };
  if (str(row.user_id) !== input.userId) return { ok: false, error: 'Esta recarga no te pertenece.' };
  if (str(row.status) !== 'PENDING') return { ok: false, error: 'Esta recarga ya fue procesada.' };

  const operation = input.operation.trim().slice(0, 80);
  if (operation.length < 3) return { ok: false, error: 'Escribe el número de operación de tu transferencia.' };

  const taken = db()
    .prepare('SELECT id FROM sip_transactions WHERE operation_number = ?')
    .get(operation) as Row | undefined;
  if (taken) {
    const owner = db().prepare('SELECT applied_topup_id FROM sip_transactions WHERE id = ?').get(str(taken.id)) as Row | undefined;
    if (owner && str(owner.applied_topup_id) && str(owner.applied_topup_id) !== input.topupId) {
      return { ok: false, error: 'Esa operación ya fue usada en otra recarga.' };
    }
  }

  db()
    .prepare('UPDATE topups SET sip_operation = ?, receipt_id = COALESCE(?, receipt_id) WHERE id = ?')
    .run(operation, input.receiptId || null, input.topupId);

  store.notify(
    'TOPUP',
    'Operación Sip informada',
    `El cliente informó la operación ${operation} para la recarga ${str(row.sip_code)}.`,
    '/admin/recargas'
  );

  const result = verifySipTopup(input.topupId);
  if (result.credited) return { ok: true, credited: true, message: 'Pago verificado: tu saldo fue acreditado.' };
  return {
    ok: true,
    credited: false,
    message: 'Registramos tu operación. El saldo se acredita en cuanto se confirme el pago en la cuenta Sip.',
  };
}

/* ------------------------------------------------------------------ */
/* Operaciones Sip recibidas                                           */
/* ------------------------------------------------------------------ */

function mapTransaction(row: Row): SipTransaction {
  return {
    id: str(row.id),
    operationNumber: str(row.operation_number),
    amountCents: num(row.amount_cents),
    referenceCode: str(row.reference_code),
    senderName: str(row.sender_name),
    senderPhone: str(row.sender_phone),
    note: str(row.note),
    source: str(row.source, 'WEBHOOK'),
    status: str(row.status, 'RECEIVED') as SipTransactionStatus,
    appliedTopupId: (row.applied_topup_id as string | null) ?? null,
    userId: (row.user_id as string | null) ?? null,
    receivedAt: str(row.received_at),
    createdAt: str(row.created_at),
    appliedAt: (row.applied_at as string | null) ?? null,
  };
}

export function listSipTransactions(limit = 80): SipTransaction[] {
  const rows = db()
    .prepare('SELECT * FROM sip_transactions ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Row[];
  return rows.map(mapTransaction);
}

export function sipTransactionForTopup(topupId: string): SipTransaction | null {
  const row = db()
    .prepare('SELECT * FROM sip_transactions WHERE applied_topup_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(topupId) as Row | undefined;
  return row ? mapTransaction(row) : null;
}

export function getSipTopup(topupId: string): Topup | null {
  const row = db()
    .prepare(
      `SELECT t.*, (SELECT name FROM users u WHERE u.id = t.user_id) AS user_name,
         (SELECT email FROM users u WHERE u.id = t.user_id) AS user_email
       FROM topups t WHERE t.id = ?`
    )
    .get(topupId) as Row | undefined;
  return row ? store.mapTopupRow(row) : null;
}

/**
 * Registra un dinero recibido en la cuenta Sip. Es idempotente por número de
 * operación: si ya existe, no se duplica ni se vuelve a acreditar.
 */
export function registerSipTransaction(input: {
  operationNumber: string;
  amountCents: number;
  referenceCode?: string;
  senderName?: string;
  senderPhone?: string;
  note?: string;
  source?: 'WEBHOOK' | 'ADMIN' | 'API';
  rawPayload?: string;
}): { ok: boolean; error?: string; transactionId?: string; duplicate?: boolean; status?: SipTransactionStatus; topupId?: string | null } {
  const operation = input.operationNumber.trim().slice(0, 120);
  if (operation.length < 3) return { ok: false, error: 'El número de operación es obligatorio.' };
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: 'El monto recibido no es válido.' };
  }

  const existing = db().prepare('SELECT * FROM sip_transactions WHERE operation_number = ?').get(operation) as Row | undefined;
  if (existing) {
    const transactionId = str(existing.id);
    const status = str(existing.status) as SipTransactionStatus;
    if (!str(existing.applied_topup_id)) reconcileSipTransaction(transactionId);
    const refreshed = db().prepare('SELECT * FROM sip_transactions WHERE id = ?').get(transactionId) as Row;
    return {
      ok: true,
      duplicate: true,
      transactionId,
      status: str(refreshed.status, status) as SipTransactionStatus,
      topupId: (refreshed.applied_topup_id as string | null) ?? null,
    };
  }

  const transactionId = id('siptx_');
  db()
    .prepare(
      `INSERT INTO sip_transactions
        (id, operation_number, amount_cents, reference_code, sender_name, sender_phone, note, source, status, raw_payload, received_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      transactionId,
      operation,
      Math.round(input.amountCents),
      (input.referenceCode || '').trim().slice(0, 120) || null,
      (input.senderName || '').trim().slice(0, 120) || null,
      (input.senderPhone || '').trim().slice(0, 40) || null,
      (input.note || '').trim().slice(0, 400) || null,
      input.source || 'WEBHOOK',
      'RECEIVED',
      (input.rawPayload || '').slice(0, 4000) || null,
      now(),
      now()
    );

  const result = reconcileSipTransaction(transactionId);
  return {
    ok: result.ok,
    error: result.error,
    transactionId,
    status: result.status,
    topupId: result.topupId ?? null,
  };
}

/**
 * Verifica una operación contra las recargas pendientes y acredita el saldo
 * una sola vez. Devuelve el estado final de la operación.
 */
export function reconcileSipTransaction(transactionId: string): {
  ok: boolean;
  error?: string;
  status?: SipTransactionStatus;
  topupId?: string | null;
  credited?: boolean;
} {
  const run = db().transaction(() => {
    const row = db().prepare('SELECT * FROM sip_transactions WHERE id = ?').get(transactionId) as Row | undefined;
    if (!row) return { ok: false as const, error: 'Operación Sip no encontrada.' };

    const appliedTopupId = (row.applied_topup_id as string | null) ?? null;
    if (appliedTopupId) {
      return { ok: true as const, status: str(row.status) as SipTransactionStatus, topupId: appliedTopupId, credited: false };
    }

    const amount = num(row.amount_cents);
    const operation = str(row.operation_number);
    const code = extractCode(`${str(row.reference_code)} ${str(row.note)}`);

    let topup: Row | undefined;
    if (code) {
      topup = db()
        .prepare("SELECT * FROM topups WHERE sip_code = ? AND status = 'PENDING' ORDER BY created_at ASC LIMIT 1")
        .get(code) as Row | undefined;
    }
    if (!topup) {
      topup = db()
        .prepare("SELECT * FROM topups WHERE sip_operation = ? AND status = 'PENDING' ORDER BY created_at ASC LIMIT 1")
        .get(operation) as Row | undefined;
    }

    if (!topup) {
      // ¿Ya se había aprobado esa recarga? Se enlaza sin volver a acreditar.
      const already = code
        ? (db()
            .prepare("SELECT * FROM topups WHERE sip_code = ? AND status = 'APPROVED' ORDER BY created_at DESC LIMIT 1")
            .get(code) as Row | undefined)
        : undefined;
      if (already) {
        db()
          .prepare("UPDATE sip_transactions SET status='APPLIED', applied_topup_id=?, user_id=?, applied_at=? WHERE id=? AND applied_topup_id IS NULL")
          .run(str(already.id), str(already.user_id), now(), transactionId);
        return { ok: true as const, status: 'APPLIED' as SipTransactionStatus, topupId: str(already.id), credited: false };
      }

      db().prepare("UPDATE sip_transactions SET status='UNMATCHED' WHERE id=?").run(transactionId);
      store.notify(
        'TOPUP',
        'Operación Sip sin recarga asociada',
        `Se recibió ${(amount / 100).toFixed(2)} con la operación ${operation}${code ? ` (código ${code})` : ''} y no coincide con ninguna recarga pendiente.`,
        '/admin/recargas'
      );
      return { ok: true as const, status: 'UNMATCHED' as SipTransactionStatus, topupId: null, credited: false };
    }

    const expected = num(topup.amount_cents);
    if (expected !== amount) {
      db().prepare("UPDATE sip_transactions SET status='AMOUNT_MISMATCH' WHERE id=?").run(transactionId);
      store.notify(
        'TOPUP',
        'Monto Sip no coincide',
        `La operación ${operation} llegó por ${(amount / 100).toFixed(2)} pero la recarga ${str(topup.sip_code)} es de ${(expected / 100).toFixed(2)}. No se acreditó saldo.`,
        '/admin/recargas'
      );
      return { ok: true as const, status: 'AMOUNT_MISMATCH' as SipTransactionStatus, topupId: str(topup.id), credited: false };
    }

    // Reclamo atómico de la operación: evita que dos procesos la apliquen.
    const claim = db()
      .prepare("UPDATE sip_transactions SET status='MATCHED', applied_topup_id=?, user_id=?, applied_at=? WHERE id=? AND applied_topup_id IS NULL")
      .run(str(topup.id), str(topup.user_id), now(), transactionId);
    if (claim.changes !== 1) {
      return { ok: true as const, status: 'MATCHED' as SipTransactionStatus, topupId: str(topup.id), credited: false };
    }

    const approve = db()
      .prepare(
        "UPDATE topups SET status='APPROVED', sip_transaction_id=?, reviewed_at=?, admin_note=? WHERE id=? AND status='PENDING'"
      )
      .run(transactionId, now(), `Acreditado automáticamente por Sip (operación ${operation})`, str(topup.id));
    if (approve.changes !== 1) throw new SipError('La recarga ya fue procesada.');

    const credit = store.creditTopupOnce(str(topup.id), `Recarga Sip confirmada (${str(topup.sip_code)})`);
    if (!credit.ok) throw new SipError(credit.error || 'No se pudo acreditar el saldo.');

    db().prepare("UPDATE sip_transactions SET status='APPLIED' WHERE id=?").run(transactionId);

    const user = store.getUserById(str(topup.user_id));
    if (user) {
      store.notify(
        'TOPUP',
        'Recarga acreditada',
        `Tu recarga ${str(topup.sip_code)} de ${(amount / 100).toFixed(2)} fue confirmada por Sip y ya está en tu saldo.`,
        '/saldo'
      );
    }

    return { ok: true as const, status: 'APPLIED' as SipTransactionStatus, topupId: str(topup.id), credited: true };
  });

  try {
    return run.immediate();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo verificar la operación Sip.' };
  }
}

/**
 * Verificación manual solicitada por el administrador o por el cliente:
 * busca operaciones Sip registradas con el código o el número de operación.
 */
export function verifySipTopup(topupId: string): {
  ok: boolean;
  error?: string;
  credited?: boolean;
  status?: SipTransactionStatus;
} {
  const row = db().prepare('SELECT * FROM topups WHERE id = ?').get(topupId) as Row | undefined;
  if (!row) return { ok: false, error: 'Recarga no encontrada.' };
  if (str(row.status) !== 'PENDING') return { ok: true, credited: false };

  const code = str(row.sip_code);
  const operation = str(row.sip_operation);
  const candidates = db()
    .prepare(
      `SELECT id FROM sip_transactions
        WHERE applied_topup_id IS NULL
          AND (operation_number = ? OR (reference_code IS NOT NULL AND reference_code LIKE ?) OR (note IS NOT NULL AND note LIKE ?))
        ORDER BY created_at ASC`
    )
    .all(operation || '-', code ? `%${code}%` : '-', code ? `%${code}%` : '-') as Row[];

  if (candidates.length === 0) {
    return { ok: false, error: 'Aún no hay ninguna operación Sip registrada con ese código u operación.' };
  }

  let credited = false;
  let status: SipTransactionStatus | undefined;
  for (const candidate of candidates) {
    const result = reconcileSipTransaction(str(candidate.id));
    if (!result.ok) return { ok: false, error: result.error };
    status = result.status;
    if (result.credited) credited = true;
    if (result.topupId === topupId) break;
  }
  return { ok: true, credited, status };
}

/** Conteos para el panel administrativo. */
export function sipSummary(): { pending: number; unmatched: number; appliedToday: number; receivedCents: number } {
  const pending = num((db().prepare("SELECT COUNT(*) AS c FROM topups WHERE status='PENDING' AND method='SIP'").get() as Row).c);
  const unmatched = num((db().prepare("SELECT COUNT(*) AS c FROM sip_transactions WHERE status IN ('UNMATCHED','AMOUNT_MISMATCH')").get() as Row).c);
  const appliedToday = num(
    (
      db()
        .prepare("SELECT COUNT(*) AS c FROM sip_transactions WHERE status='APPLIED' AND substr(applied_at,1,10) = ?")
        .get(now().slice(0, 10)) as Row
    ).c
  );
  const receivedCents = num(
    (
      db()
        .prepare("SELECT COALESCE(SUM(amount_cents),0) AS s FROM sip_transactions WHERE status='APPLIED'")
        .get() as Row
    ).s
  );
  return { pending, unmatched, appliedToday, receivedCents };
}

/* ------------------------------------------------------------------ */
/* Normalización del webhook                                           */
/* ------------------------------------------------------------------ */

function pick(payload: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') return payload[key];
  }
  return undefined;
}

/** Convierte un monto de texto ("S/ 50.00", "50,00", 50) a céntimos. */
export function parseAmountToCents(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value * 100);
  }
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export interface NormalizedSipPayment {
  operationNumber: string;
  amountCents: number;
  referenceCode: string;
  senderName: string;
  senderPhone: string;
  note: string;
}

/** Acepta los nombres de campo habituales de pasarelas y bancos. */
export function normalizeSipPayload(payload: Record<string, unknown>): NormalizedSipPayment | null {
  const operation = pick(payload, ['operation_number', 'operationNumber', 'operation', 'numero_operacion', 'nro_operacion', 'transactionId', 'transaction_id', 'id', 'reference']);
  if (operation === undefined) return null;

  const explicitCents = pick(payload, ['amount_cents', 'amountCents', 'monto_centimos']);
  const amountCents = explicitCents !== undefined ? Math.round(num(explicitCents)) : parseAmountToCents(pick(payload, ['amount', 'monto', 'importe', 'total', 'valor']));
  if (!amountCents || amountCents <= 0) return null;

  const reference = pick(payload, ['code', 'codigo', 'reference_code', 'referenceCode', 'referencia', 'concepto', 'glosa', 'description', 'detail']);
  const sender = pick(payload, ['sender_name', 'senderName', 'nombre', 'payer', 'from', 'origin']);
  const phone = pick(payload, ['sender_phone', 'senderPhone', 'telefono', 'celular', 'phone']);

  return {
    operationNumber: String(operation),
    amountCents,
    referenceCode: reference === undefined ? '' : String(reference),
    senderName: sender === undefined ? '' : String(sender),
    senderPhone: phone === undefined ? '' : String(phone),
    note: JSON.stringify(payload).slice(0, 400),
  };
}
