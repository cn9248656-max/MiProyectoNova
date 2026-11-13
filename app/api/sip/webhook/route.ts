import { NextResponse } from 'next/server';
import { normalizeSipPayload, registerSipTransaction, verifyWebhookSecret, webhookSecret } from '../../../../lib/sip';

export const dynamic = 'force-dynamic';

/**
 * Notificaciones de pago Sip.
 *
 * El banco/proveedor debe enviar aquí cada transferencia recibida en la cuenta
 * Sip. La autenticación es obligatoria: se acepta el secreto configurado en
 * Administración → Configuración → Sip (cifrado en la base de datos) o la
 * variable de entorno SIP_WEBHOOK_SECRET, enviado como:
 *   - cabecera `x-sip-secret` o `x-webhook-secret`
 *   - cabecera `Authorization: Bearer <secreto>`
 *   - parámetro `?secret=<secreto>` si el proveedor no permite cabeceras
 *
 * La operación es idempotente: el mismo número de operación no se registra ni
 * acredita dos veces, y una operación ya aplicada nunca suma saldo de nuevo.
 */

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'novastore-sip',
    configured: Boolean(webhookSecret()),
  });
}

export async function POST(request: Request) {
  if (!webhookSecret()) {
    return NextResponse.json(
      { ok: false, error: 'El webhook Sip no tiene secreto configurado.' },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const authorization = request.headers.get('authorization') || '';
  const provided =
    request.headers.get('x-sip-secret') ||
    request.headers.get('x-webhook-secret') ||
    authorization.replace(/^Bearer\s+/i, '') ||
    url.searchParams.get('secret') ||
    '';

  if (!verifyWebhookSecret(provided)) {
    return NextResponse.json({ ok: false, error: 'Firma del webhook inválida.' }, { status: 401 });
  }

  const raw = await request.text();
  if (raw.length > 20000) {
    return NextResponse.json({ ok: false, error: 'Notificación demasiado grande.' }, { status: 413 });
  }

  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
  } catch {
    payload = Object.fromEntries(new URLSearchParams(raw)) as Record<string, unknown>;
  }

  const nested = (payload.data ?? payload.payment ?? payload.transaction ?? payload.payload) as
    | Record<string, unknown>
    | undefined;
  const merged = nested && typeof nested === 'object' ? { ...payload, ...nested } : payload;

  const normalized = normalizeSipPayload(merged);
  if (!normalized) {
    return NextResponse.json(
      { ok: false, error: 'La notificación no incluye número de operación o monto reconocible.' },
      { status: 422 }
    );
  }

  const result = registerSipTransaction({ ...normalized, source: 'WEBHOOK', rawPayload: raw });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    status: result.status,
    topupId: result.topupId ?? null,
    duplicate: Boolean(result.duplicate),
  });
}
