import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../../lib/auth';
import { exportJson } from '../../../../lib/backup-db';

export const dynamic = 'force-dynamic';

/** Exporta productos, pedidos, clientes, saldos y configuración en JSON legible. */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse('No autorizado', { status: 401 });

  const { filename, json } = exportJson();
  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
