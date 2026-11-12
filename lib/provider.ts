/**
 * Integración con PEAKERR (API oficial de panel SMM).
 *
 * Reglas de la integración:
 *  - Todas las peticiones salen del backend; la clave API nunca viaja al cliente.
 *  - La clave se guarda cifrada con AES-256-GCM usando el secreto de sesión persistido.
 *  - La sincronización de servicios NUNCA sobrescribe precios de venta ni ofertas.
 *  - Un pedido sólo se envía cuando el pago está confirmado (payment_status = PAID).
 *  - Cada línea de pedido tiene una única fila en provider_orders (índice UNIQUE),
 *    lo que impide enviar dos veces el mismo pedido.
 *  - Si PEAKERR falla, el pedido se conserva y el administrador recibe aviso.
 */
import crypto from 'node:crypto';
import { db, id, now } from './db';
import { notify } from './store';

export const PROVIDER = 'PEAKERR';
export const PEAKERR_DEFAULT_URL = 'https://peakerr.com/api/v2';

export class ProviderError extends Error {}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Ajustes (settings) — se replican en Supabase con el resto de datos  */
/* ------------------------------------------------------------------ */

function getSetting(key: string): string {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value?: string } | undefined;
  return typeof row?.value === 'string' ? row.value : '';
}

function putSetting(key: string, value: string): void {
  db()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

/** Cifra la clave API con AES-256-GCM derivando la llave del secreto de sesión. */
export function encryptApiKey(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['encv1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join(':');
}

function secretKey(): Buffer {
  const secret = getSetting('session_secret');
  if (!secret) throw new ProviderError('Falta el secreto de sesión para cifrar la clave API.');
  return crypto.scryptSync(secret, 'novastore-peakerr', 32);
}

function decryptApiKey(stored: string): string {
  if (!stored || !stored.startsWith('encv1:')) return '';
  const [, iv, tag, data] = stored.split(':');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export interface ProviderConfig {
  url: string;
  hasKey: boolean;
  connected: boolean;
  currency: string;
  balanceCents: number;
  lastCheck: string | null;
  lastSync: string | null;
  services: number;
  linkedProducts: number;
}

function internalConfig(): { url: string; key: string; connected: boolean; currency: string } {
  return {
    url: getSetting('peakerr_url') || PEAKERR_DEFAULT_URL,
    key: decryptApiKey(getSetting('peakerr_key')),
    connected: getSetting('peakerr_connected') === '1',
    currency: getSetting('peakerr_currency') || 'USD',
  };
}

export function readConfig(): ProviderConfig {
  const cfg = internalConfig();
  const services = db().prepare('SELECT COUNT(*) AS c FROM provider_services WHERE provider = ?').get(PROVIDER) as { c: number };
  const linked = db()
    .prepare("SELECT COUNT(*) AS c FROM products WHERE provider = ? AND provider_service_id IS NOT NULL AND provider_service_id <> ''")
    .get(PROVIDER) as { c: number };
  return {
    url: cfg.url,
    hasKey: cfg.key.length > 0,
    connected: cfg.connected && cfg.key.length > 0,
    currency: cfg.currency,
    balanceCents: Number(getSetting('peakerr_balance_cents') || 0),
    lastCheck: getSetting('peakerr_last_check') || null,
    lastSync: getSetting('peakerr_last_sync') || null,
    services: services.c,
    linkedProducts: linked.c,
  };
}

export function saveConfig(input: { url?: string; apiKey?: string; connected?: boolean }): void {
  const url = (input.url || '').trim() || PEAKERR_DEFAULT_URL;
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new ProviderError('La URL de la API no es válida (debe empezar por https://).');
  putSetting('peakerr_url', url);
  if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    putSetting('peakerr_key', encryptApiKey(input.apiKey.trim()));
  }
  if (typeof input.connected === 'boolean') {
    putSetting('peakerr_connected', input.connected ? '1' : '0');
  }
}

export function disconnect(): void {
  putSetting('peakerr_connected', '0');
  putSetting('peakerr_key', '');
  putSetting('peakerr_balance_cents', '0');
  putSetting('peakerr_last_check', '');
}

/* ------------------------------------------------------------------ */
/* Registro de actividad                                              */
/* ------------------------------------------------------------------ */

export function logEvent(level: 'info' | 'warn' | 'error', action: string, message: string): void {
  try {
    db()
      .prepare('INSERT INTO provider_logs (id, level, action, message, created_at) VALUES (?,?,?,?,?)')
      .run(id('plog_'), level, action, message.slice(0, 600), now());
  } catch {
    // El registro nunca debe romper la operación principal.
  }
}

export interface ProviderLog {
  id: string;
  level: string;
  action: string;
  message: string;
  createdAt: string;
}

export function listLogs(limit = 40): ProviderLog[] {
  const rows = db()
    .prepare('SELECT * FROM provider_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    level: String(row.level),
    action: String(row.action),
    message: String(row.message),
    createdAt: String(row.created_at),
  }));
}

/* ------------------------------------------------------------------ */
/* Cliente HTTP                                                       */
/* ------------------------------------------------------------------ */

async function call(
  action: string,
  params: Record<string, string | number> = {},
  attempt = 0
): Promise<unknown> {
  const cfg = internalConfig();
  if (!cfg.key) throw new ProviderError('Configura la clave API de PEAKERR en el panel.');
  if (!/^https?:\/\//i.test(cfg.url)) throw new ProviderError('La URL de la API no es válida.');

  const body = new URLSearchParams({ key: cfg.key, action });
  for (const [key, value] of Object.entries(params)) body.set(key, String(value));

  // `add` nunca se reintenta automáticamente: un reintento ciego podría duplicar el pedido.
  const canRetry = action !== 'add' && attempt < 2;

  let response: Response;
  try {
    response = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    if (canRetry) {
      await sleep(400 * (attempt + 1));
      return call(action, params, attempt + 1);
    }
    throw new ProviderError(`No se pudo conectar con PEAKERR: ${(error as Error).message}`);
  }

  if (response.status >= 500 && canRetry) {
    await sleep(600 * (attempt + 1));
    return call(action, params, attempt + 1);
  }

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new ProviderError(`PEAKERR devolvió una respuesta no válida (HTTP ${response.status}).`);
  }

  if (!response.ok) throw new ProviderError(`PEAKERR respondió HTTP ${response.status}.`);
  if (json && typeof json === 'object' && !Array.isArray(json) && typeof (json as { error?: unknown }).error === 'string') {
    const message = String((json as { error: string }).error);
    if (message) throw new ProviderError(message);
  }
  return json;
}

/** Prueba la conexión y devuelve el saldo real de la cuenta PEAKERR. */
export async function testConnection(): Promise<{
  ok: boolean;
  balanceCents?: number;
  currency?: string;
  error?: string;
}> {
  try {
    const data = (await call('balance')) as { balance?: number | string; currency?: string } | null;
    const balance = Number(data?.balance ?? 0);
    const currency = String(data?.currency || 'USD');
    const stamp = now();
    putSetting('peakerr_balance_cents', String(Math.round(balance * 100)));
    putSetting('peakerr_currency', currency);
    putSetting('peakerr_last_check', stamp);
    putSetting('peakerr_connected', '1');
    logEvent('info', 'test', `Conexión correcta. Saldo: ${balance} ${currency}.`);
    return { ok: true, balanceCents: Math.round(balance * 100), currency };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo probar la conexión.';
    logEvent('error', 'test', message);
    return { ok: false, error: message };
  }
}

export async function refreshBalance(): Promise<number | null> {
  try {
    const data = (await call('balance')) as { balance?: number | string } | null;
    const cents = Math.round(Number(data?.balance ?? 0) * 100);
    putSetting('peakerr_balance_cents', String(cents));
    putSetting('peakerr_last_check', now());
    return cents;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Servicios                                                          */
/* ------------------------------------------------------------------ */

export interface ProviderService {
  id: string;
  serviceId: string;
  name: string;
  type: string;
  category: string;
  rateCents: number;
  min: number;
  max: number;
  active: boolean;
  syncedAt: string;
}

interface RawService {
  service?: string | number;
  name?: string;
  type?: string;
  category?: string;
  rate?: string | number;
  min?: string | number;
  max?: string | number;
}

function mapService(row: Record<string, unknown>): ProviderService {
  return {
    id: String(row.id),
    serviceId: String(row.service_id),
    name: String(row.name),
    type: String(row.type || ''),
    category: String(row.category || ''),
    rateCents: Number(row.rate_cents || 0),
    min: Number(row.min || 0),
    max: Number(row.max || 0),
    active: Number(row.active) === 1,
    syncedAt: String(row.synced_at),
  };
}

/**
 * Importa el catálogo del proveedor. Sólo actualiza datos del proveedor
 * (nombre, tipo, categoría, costo, mínimo y máximo). No toca price_cents,
 * ofertas ni el estado activo que el administrador haya definido.
 */
export async function syncServices(): Promise<{ added: number; updated: number; total: number }> {
  const data = await call('services');
  if (!Array.isArray(data)) throw new ProviderError('PEAKERR no devolvió una lista de servicios válida.');

  const stamp = now();
  const find = db().prepare('SELECT id FROM provider_services WHERE provider = ? AND service_id = ?');
  const insert = db().prepare(
    `INSERT INTO provider_services (id, provider, service_id, name, type, category, rate_cents, min, max, active, synced_at)
     VALUES (?,?,?,?,?,?,?,?,?,1,?)`
  );
  const update = db().prepare(
    `UPDATE provider_services SET name = ?, type = ?, category = ?, rate_cents = ?, min = ?, max = ?, synced_at = ?
     WHERE provider = ? AND service_id = ?`
  );

  let added = 0;
  let updated = 0;
  const tx = db().transaction(() => {
    for (const raw of data as RawService[]) {
      const serviceId = String(raw.service ?? '').trim();
      if (!serviceId) continue;
      const name = String(raw.name ?? `Servicio ${serviceId}`).slice(0, 200);
      const type = String(raw.type ?? '').slice(0, 80);
      const category = String(raw.category ?? '').slice(0, 120);
      const rateCents = Math.max(0, Math.round(Number(raw.rate ?? 0) * 100));
      const min = Math.max(0, Math.floor(Number(raw.min ?? 0)));
      const max = Math.max(0, Math.floor(Number(raw.max ?? 0)));
      const exists = find.get(PROVIDER, serviceId) as { id?: string } | undefined;
      if (exists?.id) {
        update.run(name, type, category, rateCents, min, max, stamp, PROVIDER, serviceId);
        updated += 1;
      } else {
        insert.run(id('psv_'), PROVIDER, serviceId, name, type, category, rateCents, min, max, stamp);
        added += 1;
      }
    }
  });
  tx();

  putSetting('peakerr_last_sync', stamp);
  putSetting('peakerr_connected', '1');
  logEvent('info', 'services', `Servicios sincronizados: ${added} nuevos, ${updated} actualizados.`);
  return { added, updated, total: added + updated };
}

export function listServices(limit = 400): ProviderService[] {
  const rows = db()
    .prepare('SELECT * FROM provider_services WHERE provider = ? ORDER BY category ASC, name ASC LIMIT ?')
    .all(PROVIDER, limit) as Array<Record<string, unknown>>;
  return rows.map(mapService);
}

export function setServiceActive(serviceId: string, active: boolean): void {
  db()
    .prepare('UPDATE provider_services SET active = ? WHERE provider = ? AND service_id = ?')
    .run(active ? 1 : 0, PROVIDER, serviceId);
}

export function findService(serviceId: string): ProviderService | null {
  const row = db()
    .prepare('SELECT * FROM provider_services WHERE provider = ? AND service_id = ?')
    .get(PROVIDER, serviceId) as Record<string, unknown> | undefined;
  return row ? mapService(row) : null;
}

/* ------------------------------------------------------------------ */
/* Vinculación y precios personalizados                               */
/* ------------------------------------------------------------------ */

export interface ProductProviderInfo {
  productId: string;
  productName: string;
  serviceId: string | null;
  serviceName: string | null;
  costCents: number;
  saleCents: number;
  offerCents: number;
  offerEndsAt: string | null;
  priceMode: string;
  min: number;
  max: number;
  syncCost: boolean;
  providerActive: boolean;
}

export function listLinkedProducts(): ProductProviderInfo[] {
  const rows = db()
    .prepare(
      `SELECT p.id, p.name, p.provider_service_id, p.provider_service_name, p.provider_cost_cents,
              p.price_cents, p.offer_price_cents, p.offer_ends_at, p.provider_price_mode,
              p.provider_min, p.provider_max, p.provider_sync_cost, p.active,
              s.active AS service_active, s.name AS service_name
       FROM products p
       LEFT JOIN provider_services s ON s.provider = p.provider AND s.service_id = p.provider_service_id
       WHERE p.provider = ? AND p.provider_service_id IS NOT NULL AND p.provider_service_id <> ''
       ORDER BY p.name ASC`
    )
    .all(PROVIDER) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    productId: String(row.id),
    productName: String(row.name),
    serviceId: row.provider_service_id ? String(row.provider_service_id) : null,
    serviceName: row.service_name ? String(row.service_name) : row.provider_service_name ? String(row.provider_service_name) : null,
    costCents: Number(row.provider_cost_cents || 0),
    saleCents: Number(row.price_cents || 0),
    offerCents: Number(row.offer_price_cents || 0),
    offerEndsAt: row.offer_ends_at ? String(row.offer_ends_at) : null,
    priceMode: String(row.provider_price_mode || 'UNIT'),
    min: Number(row.provider_min || 0),
    max: Number(row.provider_max || 0),
    syncCost: Number(row.provider_sync_cost) === 1,
    providerActive: Number(row.service_active ?? 1) === 1,
  }));
}

/** Vincula un producto existente con un servicio de PEAKERR. */
export function linkProduct(productId: string, serviceId: string, options: { useProviderCost?: boolean } = {}): void {
  const service = findService(serviceId);
  if (!service) throw new ProviderError('Primero sincroniza los servicios de PEAKERR.');
  const product = db().prepare('SELECT id, provider_cost_cents FROM products WHERE id = ?').get(productId) as
    | { id: string; provider_cost_cents: number }
    | undefined;
  if (!product) throw new ProviderError('Producto no encontrado.');

  // El costo sólo se rellena si aún no existe, para no pisar un costo ajustado a mano.
  const costCents = Number(product.provider_cost_cents || 0) > 0 ? Number(product.provider_cost_cents) : service.rateCents;

  db()
    .prepare(
      `UPDATE products SET provider = ?, provider_service_id = ?, provider_service_name = ?,
        provider_cost_cents = ?, provider_min = ?, provider_max = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(PROVIDER, service.serviceId, service.name, costCents, service.min, service.max, now(), productId);

  logEvent('info', 'link', `Producto ${productId} vinculado al servicio ${service.serviceId}.`);
}

export function unlinkProduct(productId: string): void {
  db()
    .prepare(
      `UPDATE products SET provider = '', provider_service_id = NULL, provider_service_name = NULL,
        provider_cost_cents = 0, provider_min = 0, provider_max = 0, provider_price_mode = 'UNIT', updated_at = ?
       WHERE id = ?`
    )
    .run(now(), productId);
  logEvent('info', 'unlink', `Producto ${productId} desvinculado de PEAKERR.`);
}

/**
 * Precios propios del administrador: costo del proveedor y precio de venta
 * se guardan por separado. La sincronización nunca los sobrescribe.
 */
export function savePricing(input: {
  productId: string;
  saleCents: number;
  costCents: number;
  priceMode: 'UNIT' | 'PER_K';
  offerCents?: number;
  offerEndsAt?: string | null;
  syncCost?: boolean;
}): void {
  if (!Number.isFinite(input.saleCents) || input.saleCents < 0) throw new ProviderError('Precio de venta inválido.');
  if (!Number.isFinite(input.costCents) || input.costCents < 0) throw new ProviderError('Costo inválido.');
  const offer = Number.isFinite(input.offerCents || 0) ? Math.max(0, Math.floor(input.offerCents || 0)) : 0;
  if (offer > 0 && offer >= input.saleCents) throw new ProviderError('La oferta debe ser menor que el precio de venta.');

  db()
    .prepare(
      `UPDATE products SET price_cents = ?, provider_cost_cents = ?, provider_price_mode = ?,
        offer_price_cents = ?, offer_ends_at = ?, provider_sync_cost = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      Math.floor(input.saleCents),
      Math.floor(input.costCents),
      input.priceMode === 'PER_K' ? 'PER_K' : 'UNIT',
      offer,
      input.offerEndsAt || null,
      input.syncCost ? 1 : 0,
      now(),
      input.productId
    );
}

/** Crea un producto nuevo de la tienda a partir de un servicio importado. */
export function createProductFromService(input: {
  serviceId: string;
  categoryId: string;
  saleCents: number;
  description?: string;
}): string {
  const service = findService(input.serviceId);
  if (!service) throw new ProviderError('Servicio no encontrado. Sincroniza los servicios primero.');
  const category = db().prepare('SELECT id FROM categories WHERE id = ?').get(input.categoryId);
  if (!category) throw new ProviderError('Categoría no encontrada.');

  const productId = id('prd_');
  const stamp = now();
  db()
    .prepare(
      `INSERT INTO products (id, name, description, price_cents, category_id, image_id, stock, unlimited_stock,
         active, featured, provider, provider_service_id, provider_service_name, provider_cost_cents,
         provider_min, provider_max, provider_price_mode, created_at, updated_at)
       VALUES (?,?,?,?,?,NULL,0,1,1,0,?,?,?,?,?,?,'PER_K',?,?)`
    )
    .run(
      productId,
      service.name.slice(0, 120),
      (input.description || `${service.name} · ${service.category} (${service.type}).`).slice(0, 800),
      Math.max(0, Math.floor(input.saleCents)),
      input.categoryId,
      PROVIDER,
      service.serviceId,
      service.name,
      service.rateCents,
      service.min,
      service.max,
      stamp,
      stamp
    );
  logEvent('info', 'product', `Producto creado desde el servicio ${service.serviceId}.`);
  return productId;
}

/* ------------------------------------------------------------------ */
/* Pedidos al proveedor                                               */
/* ------------------------------------------------------------------ */

export type ProviderOrderStatus =
  | 'QUEUED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'CANCELED'
  | 'ERROR'
  | 'FAILED';

export const PROVIDER_STATUS_LABEL: Record<ProviderOrderStatus, string> = {
  QUEUED: 'En cola',
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  COMPLETED: 'Completado',
  PARTIAL: 'Parcial',
  CANCELED: 'Cancelado',
  ERROR: 'Error',
  FAILED: 'No enviado',
};

const FINAL_STATUSES = new Set<ProviderOrderStatus>(['COMPLETED', 'PARTIAL', 'CANCELED', 'ERROR']);

export interface ProviderOrder {
  id: string;
  orderId: string;
  orderCode: string;
  orderItemId: string;
  serviceId: string;
  link: string;
  quantity: number;
  chargeCents: number;
  costCents: number;
  profitCents: number;
  providerOrderId: string | null;
  status: ProviderOrderStatus;
  startCount: number | null;
  remains: number | null;
  error: string | null;
  attempts: number;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userEmail?: string;
}

function mapProviderOrder(row: Record<string, unknown>): ProviderOrder {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    orderCode: String(row.order_code || ''),
    orderItemId: String(row.order_item_id),
    serviceId: String(row.service_id),
    link: String(row.link || ''),
    quantity: Number(row.quantity || 0),
    chargeCents: Number(row.charge_cents || 0),
    costCents: Number(row.cost_cents || 0),
    profitCents: Number(row.profit_cents || 0),
    providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
    status: String(row.status || 'QUEUED') as ProviderOrderStatus,
    startCount: row.start_count === null || row.start_count === undefined ? null : Number(row.start_count),
    remains: row.remains === null || row.remains === undefined ? null : Number(row.remains),
    error: row.error ? String(row.error) : null,
    attempts: Number(row.attempts || 0),
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    userName: row.user_name ? String(row.user_name) : undefined,
    userEmail: row.user_email ? String(row.user_email) : undefined,
  };
}

export function listProviderOrders(limit = 100): ProviderOrder[] {
  const rows = db()
    .prepare(
      `SELECT po.*, o.code AS order_code, u.name AS user_name, u.email AS user_email
       FROM provider_orders po
       LEFT JOIN orders o ON o.id = po.order_id
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY po.created_at DESC LIMIT ?`
    )
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map(mapProviderOrder);
}

export function listOrderProviderInfo(orderId: string): ProviderOrder[] {
  const rows = db()
    .prepare('SELECT * FROM provider_orders WHERE order_id = ? ORDER BY created_at ASC')
    .all(orderId) as Array<Record<string, unknown>>;
  return rows.map(mapProviderOrder);
}

function orderLink(customerData: unknown): string {
  if (!customerData || typeof customerData !== 'object') return '';
  const data = customerData as { link?: string; playerId?: string; details?: string };
  const candidate = (data.link || data.details || data.playerId || '').trim();
  return candidate.slice(0, 500);
}

function parseCustomerData(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Envía a PEAKERR las líneas de un pedido ya pagado.
 * Idempotente: el índice UNIQUE(order_item_id) impide duplicados y una fila
 * QUEUED se crea antes de llamar a la API.
 */
export async function dispatchOrder(orderId: string): Promise<{ sent: number; pending: number; error?: string }> {
  const order = db().prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
    | Record<string, unknown>
    | undefined;
  if (!order) return { sent: 0, pending: 0, error: 'Pedido no encontrado.' };
  if (String(order.payment_status) !== 'PAID') return { sent: 0, pending: 0, error: 'El pago aún no está confirmado.' };
  if (String(order.status) === 'CANCELLED') return { sent: 0, pending: 0, error: 'El pedido está cancelado.' };

  const cfg = internalConfig();
  if (!cfg.key) return { sent: 0, pending: 0, error: 'PEAKERR no está configurado.' };

  const link = orderLink(parseCustomerData(order.customer_data));
  const items = db()
    .prepare(
      `SELECT oi.id, oi.name, oi.quantity, oi.price_cents, p.provider_service_id,
              p.provider_cost_cents, p.provider_price_mode
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? AND p.provider_service_id IS NOT NULL AND p.provider_service_id <> ''
       ORDER BY oi.rowid ASC`
    )
    .all(orderId) as Array<Record<string, unknown>>;

  let sent = 0;
  let pending = 0;

  for (const item of items) {
    const orderItemId = String(item.id);
    const existing = db().prepare('SELECT id, status FROM provider_orders WHERE order_item_id = ?').get(orderItemId) as
      | { id: string; status: string }
      | undefined;
    // Ya enviado (o en curso): nunca se reenvía.
    if (existing) {
      pending += 1;
      continue;
    }
    if (!link) {
      logEvent('warn', 'add', `Pedido ${String(order.code)}: falta el enlace o usuario del cliente.`);
      notify(
        'PROVIDER',
        'Falta el enlace del cliente',
        `El pedido ${String(order.code)} está pagado pero no tiene enlace/usuario para enviarlo a PEAKERR.`,
        '/admin/pedidos'
      );
      pending += 1;
      continue;
    }

    const quantity = Number(item.quantity || 0);
    const perK = String(item.provider_price_mode || 'UNIT') === 'PER_K';
    const costCents = perK
      ? Math.round((Number(item.provider_cost_cents || 0) * quantity) / 1000)
      : Number(item.provider_cost_cents || 0) * quantity;
    const chargeCents = perK
      ? Math.round((Number(item.price_cents || 0) * quantity) / 1000)
      : Number(item.price_cents || 0) * quantity;

    const rowId = id('por_');
    const stamp = now();
    db()
      .prepare(
        `INSERT INTO provider_orders (id, provider, order_id, order_item_id, service_id, link, quantity,
           charge_cents, cost_cents, profit_cents, provider_order_id, status, attempts, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,NULL,'QUEUED',0,?,?)`
      )
      .run(
        rowId,
        PROVIDER,
        orderId,
        orderItemId,
        String(item.provider_service_id),
        link,
        quantity,
        chargeCents,
        costCents,
        chargeCents - costCents,
        stamp,
        stamp
      );

    try {
      const response = (await call('add', {
        service: String(item.provider_service_id),
        link,
        quantity,
      })) as { order?: number | string; error?: string } | null;

      const externalId = response?.order ? String(response.order) : '';
      if (!externalId) throw new ProviderError(response?.error || 'PEAKERR no devolvió el ID del pedido.');

      db()
        .prepare(
          `UPDATE provider_orders SET provider_order_id = ?, status = 'PENDING', attempts = attempts + 1,
             error = NULL, updated_at = ? WHERE id = ?`
        )
        .run(externalId, now(), rowId);
      sent += 1;
      logEvent('info', 'add', `Pedido ${String(order.code)} enviado a PEAKERR (#${externalId}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al enviar el pedido.';
      db()
        .prepare(
          `UPDATE provider_orders SET status = 'FAILED', attempts = attempts + 1, error = ?, updated_at = ? WHERE id = ?`
        )
        .run(message.slice(0, 400), now(), rowId);
      logEvent('error', 'add', `Pedido ${String(order.code)}: ${message}`);
      notify(
        'PROVIDER',
        'Pedido no enviado a PEAKERR',
        `El pedido ${String(order.code)} no se pudo enviar: ${message}. Queda guardado para reintentar.`,
        '/admin/peakerr'
      );
      pending += 1;
    }
  }

  if (sent > 0) {
    db().prepare("UPDATE orders SET status = CASE WHEN status = 'PENDING' THEN 'APPROVED' ELSE status END, updated_at = ? WHERE id = ?").run(now(), orderId);
    void refreshBalance();
  }
  return { sent, pending };
}

/** Reintento manual desde el panel (seguro: sólo filas FAILED sin ID externo). */
export async function retryProviderOrder(providerOrderId: string): Promise<{ ok: boolean; error?: string }> {
  const row = db().prepare('SELECT * FROM provider_orders WHERE id = ?').get(providerOrderId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return { ok: false, error: 'Registro no encontrado.' };
  if (row.provider_order_id) return { ok: false, error: 'Este pedido ya fue enviado a PEAKERR.' };
  if (String(row.status) !== 'FAILED' && String(row.status) !== 'QUEUED') {
    return { ok: false, error: 'Sólo se pueden reintentar pedidos no enviados.' };
  }
  if (Number(row.attempts || 0) >= 5) return { ok: false, error: 'Demasiados intentos. Revisa la configuración.' };

  try {
    const response = (await call('add', {
      service: String(row.service_id),
      link: String(row.link),
      quantity: Number(row.quantity),
    })) as { order?: number | string } | null;
    const externalId = response?.order ? String(response.order) : '';
    if (!externalId) throw new ProviderError('PEAKERR no devolvió el ID del pedido.');
    db()
      .prepare(
        `UPDATE provider_orders SET provider_order_id = ?, status = 'PENDING', attempts = attempts + 1,
           error = NULL, updated_at = ? WHERE id = ?`
      )
      .run(externalId, now(), providerOrderId);
    logEvent('info', 'retry', `Pedido reenviado a PEAKERR (#${externalId}).`);
    void refreshBalance();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo reenviar.';
    db()
      .prepare('UPDATE provider_orders SET attempts = attempts + 1, error = ?, updated_at = ? WHERE id = ?')
      .run(message.slice(0, 400), now(), providerOrderId);
    logEvent('error', 'retry', message);
    return { ok: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/* Seguimiento de estados                                             */
/* ------------------------------------------------------------------ */

function mapRemoteStatus(value: string): ProviderOrderStatus {
  const status = value.trim().toLowerCase();
  if (status.includes('complet')) return 'COMPLETED';
  if (status.includes('partial')) return 'PARTIAL';
  if (status.includes('cancel')) return 'CANCELED';
  if (status.includes('refund')) return 'CANCELED';
  if (status.includes('fail') || status.includes('error')) return 'ERROR';
  if (status.includes('progress') || status.includes('process')) return 'IN_PROGRESS';
  if (status.includes('pend') || status.includes('queue') || status.includes('await')) return 'PENDING';
  return 'IN_PROGRESS';
}

/**
 * Consulta el estado de los pedidos abiertos en PEAKERR y actualiza NovaStore.
 * Devuelve cuántos pedidos se revisaron.
 */
export async function syncStatuses(): Promise<{ checked: number; updated: number; error?: string }> {
  const rows = db()
    .prepare(
      `SELECT id, provider_order_id, status FROM provider_orders
       WHERE provider_order_id IS NOT NULL AND provider_order_id <> ''`
    )
    .all() as Array<Record<string, unknown>>;

  const open = rows.filter((row) => !FINAL_STATUSES.has(String(row.status) as ProviderOrderStatus));
  if (open.length === 0) return { checked: 0, updated: 0 };

  let updated = 0;
  for (let index = 0; index < open.length; index += 90) {
    const chunk = open.slice(index, index + 90);
    const ids = chunk.map((row) => String(row.provider_order_id));
    let data: unknown;
    try {
      data = await call('status', { orders: ids.join(',') });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo consultar el estado.';
      logEvent('warn', 'status', message);
      return { checked: 0, updated, error: message };
    }

    const map: Record<string, { status?: string; remains?: number | string; start_count?: number | string; error?: string; charge?: number | string }> =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, { status?: string; remains?: number | string; start_count?: number | string; error?: string }>)
        : {};

    for (const row of chunk) {
      const externalId = String(row.provider_order_id);
      const entry = map[externalId];
      if (!entry) continue;

      if (entry.error && !entry.status) {
        db()
          .prepare("UPDATE provider_orders SET status = 'ERROR', error = ?, updated_at = ? WHERE id = ?")
          .run(String(entry.error).slice(0, 400), now(), String(row.id));
        updated += 1;
        continue;
      }

      const status = mapRemoteStatus(String(entry.status || ''));
      db()
        .prepare(
          `UPDATE provider_orders SET status = ?, start_count = ?, remains = ?, error = NULL,
             last_checked_at = ?, updated_at = ? WHERE id = ?`
        )
        .run(
          status,
          entry.start_count === undefined ? null : Number(entry.start_count),
          entry.remains === undefined ? null : Number(entry.remains),
          now(),
          now(),
          String(row.id)
        );
      updated += 1;

      if (FINAL_STATUSES.has(status)) {
        logEvent('info', 'status', `Pedido PEAKERR #${externalId} finalizado como ${status}.`);
      }
    }
  }

  syncOrderStatusesFromProvider();
  return { checked: open.length, updated };
}

/** Refleja el estado del proveedor en el pedido del cliente. */
function syncOrderStatusesFromProvider(): void {
  const orders = db()
    .prepare(
      `SELECT DISTINCT po.order_id FROM provider_orders po
       JOIN orders o ON o.id = po.order_id
       WHERE o.status NOT IN ('CANCELLED')`
    )
    .all() as Array<{ order_id: string }>;

  for (const { order_id: orderId } of orders) {
    const rows = db().prepare('SELECT status FROM provider_orders WHERE order_id = ?').all(orderId) as Array<{
      status: string;
    }>;
    if (rows.length === 0) continue;

    const statuses = rows.map((row) => row.status as ProviderOrderStatus);
    let aggregate: ProviderOrderStatus = 'PENDING';
    if (statuses.every((status) => status === 'COMPLETED')) aggregate = 'COMPLETED';
    else if (statuses.some((status) => status === 'PARTIAL')) aggregate = 'PARTIAL';
    else if (statuses.some((status) => status === 'ERROR' || status === 'FAILED')) aggregate = 'ERROR';
    else if (statuses.every((status) => status === 'CANCELED')) aggregate = 'CANCELED';
    else if (statuses.some((status) => status === 'IN_PROGRESS')) aggregate = 'IN_PROGRESS';
    else aggregate = 'PENDING';

    const order = db().prepare('SELECT status, payment_status FROM orders WHERE id = ?').get(orderId) as
      | { status: string; payment_status: string }
      | undefined;
    if (!order) continue;

    let nextStatus = order.status;
    if (aggregate === 'COMPLETED' && order.status !== 'COMPLETED') nextStatus = 'COMPLETED';
    else if ((aggregate === 'IN_PROGRESS' || aggregate === 'PENDING') && (order.status === 'APPROVED' || order.status === 'PENDING') && order.payment_status === 'PAID') {
      nextStatus = 'SENT';
    } else if (aggregate === 'CANCELED' && order.status !== 'COMPLETED') {
      nextStatus = 'CANCELLED';
    }

    db()
      .prepare('UPDATE orders SET status = ?, provider_status = ?, updated_at = ? WHERE id = ?')
      .run(nextStatus, aggregate, now(), orderId);
  }
}

/* ------------------------------------------------------------------ */
/* Envío de pedidos pagados pendientes (worker)                       */
/* ------------------------------------------------------------------ */

export async function dispatchPaidOrders(): Promise<number> {
  const rows = db()
    .prepare(
      `SELECT o.id FROM orders o
       WHERE o.payment_status = 'PAID' AND o.status <> 'CANCELLED'
         AND EXISTS (
           SELECT 1 FROM order_items oi
           JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = o.id AND p.provider_service_id IS NOT NULL AND p.provider_service_id <> ''
         )
         AND NOT EXISTS (
           SELECT 1 FROM provider_orders po WHERE po.order_id = o.id
         )
       ORDER BY o.created_at ASC LIMIT 5`
    )
    .all() as Array<{ id: string }>;

  let sent = 0;
  for (const row of rows) {
    const result = await dispatchOrder(row.id);
    sent += result.sent;
  }
  return sent;
}

/* ------------------------------------------------------------------ */
/* Ganancias                                                          */
/* ------------------------------------------------------------------ */

export interface ProviderStats {
  orders: number;
  completed: number;
  inProgress: number;
  failed: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
}

export function providerStats(): ProviderStats {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS orders,
              SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status IN ('PENDING','IN_PROGRESS','QUEUED') THEN 1 ELSE 0 END) AS in_progress,
              SUM(CASE WHEN status IN ('FAILED','ERROR') THEN 1 ELSE 0 END) AS failed,
              COALESCE(SUM(charge_cents), 0) AS revenue,
              COALESCE(SUM(cost_cents), 0) AS cost,
              COALESCE(SUM(profit_cents), 0) AS profit
       FROM provider_orders`
    )
    .get() as Record<string, unknown>;
  return {
    orders: Number(row.orders || 0),
    completed: Number(row.completed || 0),
    inProgress: Number(row.in_progress || 0),
    failed: Number(row.failed || 0),
    revenueCents: Number(row.revenue || 0),
    costCents: Number(row.cost || 0),
    profitCents: Number(row.profit || 0),
  };
}
