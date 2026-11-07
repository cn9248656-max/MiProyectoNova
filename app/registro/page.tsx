import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthForm from '../../components/AuthForm';
import { getCurrentUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/');

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
          Crea tu cuenta
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>
          Tu billetera NovaStore se crea al instante. Recarga cuando quieras y compra en segundos.
        </p>
        <AuthForm mode="register" />
      </div>
    </div>
  );
}
