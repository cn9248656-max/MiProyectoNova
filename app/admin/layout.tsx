import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav from '../../components/AdminNav';
import { getCurrentUser } from '../../lib/auth';
import { getSettings, unreadNotifications } from '../../lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'ADMIN') redirect('/');

  const settings = getSettings();
  const unread = unreadNotifications();

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link href="/admin" className="admin-side__brand">
          <span className="brand__mark">N</span>
          <div>
            <strong>{settings.storeName}</strong>
            <span className="admin-side__label">Panel administrador</span>
          </div>
        </Link>

        <AdminNav unread={unread} />

        <div className="admin-side__footer">
          <Link className="btn btn--ghost btn--sm btn--block" href="/">
            Ver tienda
          </Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-head">
          <div>
            <span className="tiny muted">Sesión de administrador</span>
            <strong style={{ display: 'block' }}>{user.name}</strong>
          </div>
          <Link className="btn btn--ghost btn--sm" href="/cuenta">
            Mi cuenta
          </Link>
        </header>
        {children}
      </main>
    </div>
  );
}
