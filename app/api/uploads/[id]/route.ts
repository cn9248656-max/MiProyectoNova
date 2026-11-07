import { getUpload } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const upload = getUpload(id);
  if (!upload) {
    return new Response('No encontrado', { status: 404 });
  }

  return new Response(new Uint8Array(upload.data), {
    headers: {
      'Content-Type': upload.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(upload.data.length),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
