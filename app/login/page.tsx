import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthForm from '../../components/AuthForm';
import { getCurrentUser } from '../../lib/auth';
import { getSettings } from '../../lib/store';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/');

  const params = await searchParams;
  const settings = getSettings();

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="brand" style={{ marginBottom: 22 }}>
          <span className="brand__mark">N</span>
          <span className="brand__name">
            Nova<span>Store</span>
          </span>
        </Link>
        <h1 className="page-title" style={{ fontSize: 24 }}>
          Iniciar sesión
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>
          Bienvenido de nuevo. Accede a tu billetera, tus compras y tu saldo en {settings.storeName}.
        </p>
        <AuthForm mode="login" next={params.next} />
      </div>
    </div>
  );
}
