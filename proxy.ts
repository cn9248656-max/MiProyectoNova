import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 16 sustituye la convención `middleware` por `proxy`.
 * Mantiene la cabecera `x-pathname` que consume app/layout.tsx para resaltar
 * el apartado activo del menú inferior.
 */
/** Cookie de sesión emitida en lib/auth.ts. */
const SESSION_COOKIE = 'nova_session';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * Defensa en profundidad: sin cookie de sesión no se renderiza nada del panel.
   * Se corta aquí (307 antes de renderizar) para no transmitir HTML ni datos del
   * administrador a un visitante anónimo. La comprobación real del rol y de la
   * sesión sigue ocurriendo en app/admin/layout.tsx.
   */
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!request.cookies.get(SESSION_COOKIE)?.value) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.search = '';
      loginUrl.searchParams.set('next', '/admin');
      return NextResponse.redirect(loginUrl, 307);
    }
  }

  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/uploads).*)'],
};
