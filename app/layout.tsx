import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { getCurrentUser } from '../lib/auth';
import { cartSummary, getSettings } from '../lib/store';
import * as support from '../lib/support';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'NovaStore — Tienda digital',
  description:
    'NovaStore: juegos, streaming, software, servicios digitales y números virtuales con pago por saldo o Agora.',
  applicationName: 'NovaStore',
};

export const viewport: Viewport = {
  themeColor: '#07050c',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') || '/';
  const user = await getCurrentUser();
  const settings = getSettings();
  const cart = user ? cartSummary(user.id) : { lines: [], totalCents: 0, itemCount: 0 };
  const supportUnread = user ? support.unreadForUser(user.id) : 0;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/registro');
  const isAdminArea = pathname.startsWith('/admin');
  const isStaff = user?.role === 'ADMIN';
  const blocked = settings.maintenance && !isStaff && !isAdminArea;

  if (blocked) {
    return (
      <html lang="es">
        <body>
          <div className="maint-screen">
            <div className="maint-card">
              <div className="maint-glyph">🛠️</div>
              <h1>Estamos en mantenimiento</h1>
              <p>{settings.maintenanceMessage}</p>
              <div className="divider" />
              <p className="tiny muted">
                {settings.storeName} volverá pronto. Si eres administrador, inicia sesión para gestionar la tienda.
              </p>
              <div style={{ marginTop: 18 }}>
                <a className="btn btn--ghost" href="/login">
                  Acceso administrador
                </a>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  if (isAdminArea) {
    return (
      <html lang="es">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="es">
      <body>
        <div className="app-shell">
          {isAuthPage ? (
            children
          ) : (
            <>
              <TopBar user={user} settings={settings} />
              <main className="page">{children}</main>
              <BottomNav cartCount={cart.itemCount} supportUnread={supportUnread} />
            </>
          )}
        </div>
      </body>
    </html>
  );
}
