/**
 * Cliente de Supabase para el SERVIDOR de NovaStore.
 *
 * - La conexión se toma de variables de entorno del servidor:
 *     SUPABASE_URL            (o NEXT_PUBLIC_SUPABASE_URL)
 *     SUPABASE_ANON_KEY       (o NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *     SUPABASE_SYNC_SECRET    secreto de servidor que valida las RPC
 *     SUPABASE_SERVICE_ROLE_KEY  opcional; si existe, se usa y no hace falta secreto
 * - Ninguna de estas claves se envía al navegador.
 * - Solo se llaman funciones RPC (nova_upsert / nova_select / nova_delete):
 *   las tablas tienen RLS y no aceptan lectura ni escritura directa.
 */

import { spawnSync } from 'node:child_process';

export type SyncMode = 'service' | 'secret';

export interface SyncConfig {
  url: string;
  key: string;
  secret: string | null;
  mode: SyncMode;
}

export interface RemoteOp {
  path: string;
  body: Record<string, unknown>;
}

export interface RemoteResult {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

const TRIM = (value: string | undefined): string => (value ?? '').trim();

/** Configuración efectiva, o null si la sincronización no está disponible. */
export function syncConfig(): SyncConfig | null {
  const url = TRIM(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
  if (!url) return null;

  const service = TRIM(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anon = TRIM(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const secret = TRIM(process.env.SUPABASE_SYNC_SECRET) || null;

  if (service) return { url, key: service, secret, mode: 'service' };
  if (anon && secret) return { url, key: anon, secret, mode: 'secret' };
  return null;
}

export function syncEnabled(): boolean {
  return syncConfig() !== null;
}

/** Estado legible (sin exponer claves) para diagnóstico. */
export function syncStatus(): {
  enabled: boolean;
  mode: SyncMode | 'off';
  url: string | null;
  hasSecret: boolean;
} {
  const config = syncConfig();
  if (!config) {
    return {
      enabled: false,
      mode: 'off',
      url: TRIM(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) || null,
      hasSecret: TRIM(process.env.SUPABASE_SYNC_SECRET).length > 0,
    };
  }
  return { enabled: true, mode: config.mode, url: config.url, hasSecret: Boolean(config.secret) };
}

/**
 * Script que ejecuta las peticiones en un proceso hijo.
 * Así el arranque puede restaurar los datos de forma bloqueante sin usar
 * peticiones síncronas (que Node ya no permite) y sin retrasar el event loop.
 * La clave viaja por stdin, nunca por argumentos de línea de comandos.
 */
const CHILD_SCRIPT = `
const fs = require('node:fs');
let payload;
try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); }
catch (error) { process.stdout.write(JSON.stringify({ results: [], error: 'payload invalido' })); process.exit(0); }

(async () => {
  const results = [];
  for (const op of payload.ops) {
    try {
      const response = await fetch(payload.url + op.path, {
        method: 'POST',
        headers: {
          apikey: payload.key,
          Authorization: 'Bearer ' + payload.key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(op.body || {}),
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      results.push({ ok: response.ok, status: response.status, data });
    } catch (error) {
      results.push({ ok: false, status: 0, data: null, error: String((error && error.message) || error) });
    }
  }
  process.stdout.write(JSON.stringify({ results }));
})();
`;

function buildPayload(config: SyncConfig, ops: RemoteOp[]) {
  return JSON.stringify({
    url: config.url,
    key: config.key,
    ops: ops.map((op) => ({
      path: op.path,
      body: op.body.p_secret === undefined && config.secret ? { ...op.body, p_secret: config.secret } : op.body,
    })),
  });
}

/** Ejecuta operaciones RPC de forma asíncrona (usada por el bucle de sincronización). */
export async function runOps(ops: RemoteOp[]): Promise<RemoteResult[]> {
  const config = syncConfig();
  if (!config) return ops.map(() => ({ ok: false, status: 0, data: null, error: 'sin configuracion' }));

  const results: RemoteResult[] = [];
  for (const op of ops) {
    try {
      const response = await fetch(config.url + op.path, {
        method: 'POST',
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_secret: config.secret, ...op.body }),
        cache: 'no-store',
      });
      const text = await response.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      results.push({ ok: response.ok, status: response.status, data });
    } catch (error) {
      results.push({
        ok: false,
        status: 0,
        data: null,
        error: String((error as Error)?.message ?? error),
      });
    }
  }
  return results;
}

/** Ejecuta operaciones RPC de forma bloqueante (arranque del servidor / apagado). */
export function runOpsSync(ops: RemoteOp[], timeoutMs = 25000): RemoteResult[] {
  const config = syncConfig();
  if (!config) return ops.map(() => ({ ok: false, status: 0, data: null, error: 'sin configuracion' }));

  const child = spawnSync(process.execPath, ['-e', CHILD_SCRIPT], {
    input: buildPayload(config, ops),
    encoding: 'utf8',
    maxBuffer: 96 * 1024 * 1024,
    timeout: timeoutMs,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });

  if (child.error) {
    return ops.map(() => ({ ok: false, status: 0, data: null, error: child.error?.message }));
  }
  try {
    const parsed = JSON.parse(child.stdout || '{"results":[]}') as { results?: RemoteResult[] };
    const results = parsed.results ?? [];
    while (results.length < ops.length) {
      results.push({ ok: false, status: 0, data: null, error: 'sin respuesta' });
    }
    return results.slice(0, ops.length);
  } catch {
    return ops.map(() => ({ ok: false, status: 0, data: null, error: 'respuesta ilegible' }));
  }
}

export function upsertOp(table: string, rows: Array<Record<string, unknown>>): RemoteOp {
  return { path: '/rest/v1/rpc/nova_upsert', body: { p_table: table, p_rows: rows } };
}

export function selectOp(table: string, limit = 20000): RemoteOp {
  return { path: '/rest/v1/rpc/nova_select', body: { p_table: table, p_limit: limit } };
}

export function deleteOp(table: string, keys: string[]): RemoteOp {
  return { path: '/rest/v1/rpc/nova_delete', body: { p_table: table, p_keys: keys } };
}
