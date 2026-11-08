import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../../lib/auth';
import { BACKUP_DIR } from '../../../../lib/paths';

export const dynamic = 'force-dynamic';

/** Descarga una copia de seguridad concreta. Solo administradores. */
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse('No autorizado', { status: 401 });

  const { name } = await context.params;
  if (!/^novastore-[A-Za-z0-9._-]+\.db$/.test(name) || name.includes('..')) {
    return new NextResponse('Copia no válida', { status: 400 });
  }

  const file = path.resolve(BACKUP_DIR, name);
  if (!file.startsWith(path.resolve(BACKUP_DIR) + path.sep) || !fs.existsSync(file)) {
    return new NextResponse('Copia no encontrada', { status: 404 });
  }

  const data = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(data.length),
      'Cache-Control': 'no-store',
    },
  });
}
