import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logoutAction } from '../../app/actions';
import { PasswordForm, ProductRequestForm, ProfileForm } from '../../components/ProfileForms';
import { getCurrentUser } from '../../lib/auth';
import { formatDate, formatMoney } from '../../lib/money';
import { getSettings, listWallet } from '../../lib/store';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/cuenta');

  const settings = getSettings();
  const movements = listWallet(user.id, 40);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Mi cuenta</h1>
          <p className="page-subtitle">Perfil, saldo disponible e historial de movimientos.</p>
        </div>
        <form action={logoutAction}>
          <button className="btn btn--ghost btn--sm" type="submit">
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="row" style={{ gap: 14 }}>
            <span className="avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            <div>
              <h2 className="card__title" style={{ margin: 0 }}>
                {user.name}
              </h2>
              <span className="tiny muted">{user.email}</span>
            </div>
          </div>

          <div className="divider" />

          <div className="kv">
            <span>Saldo disponible</span>
            <strong className="mono">{formatMoney(user.balanceCents, settings.currency)}</strong>
          </div>
          <div className="kv">
            <span>Teléfono</span>
            <strong>{user.phone || 'No registrado'}</strong>
          </div>
          <div className="kv">
            <span>Miembro desde</span>
            <strong>{formatDate(user.createdAt)}</strong>
          </div>
          <div className="kv">
            <span>Rol</span>
            <strong>{user.role === 'ADMIN' ? 'Administrador' : 'Cliente'}</strong>
          </div>

          <div className="form-actions" style={{ marginTop: 16 }}>
            <Link className="btn btn--sm" href="/saldo">
              Añadir saldo
            </Link>
            {user.role === 'ADMIN' ? (
              <Link className="btn btn--ghost btn--sm" href="/admin">
                Panel administrador
              </Link>
            ) : null}
          </div>
        </section>

        <section className="card">
          <h2 className="card__title">Datos personales</h2>
          <ProfileForm name={user.name} phone={user.phone} />
        </section>
      </div>

      <section className="card">
        <div className="row row--between row--wrap">
          <h2 className="card__title" style={{ margin: 0 }}>
            Historial de movimientos
          </h2>
          <span className="tiny muted">{movements.length} registros</span>
        </div>

        {movements.length === 0 ? (
          <div className="empty" style={{ marginTop: 16 }}>
            <div className="empty__icon">📊</div>
            <h3>Sin movimientos todavía</h3>
            <p>Las recargas aprobadas y las compras con saldo aparecerán aquí.</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 8, marginTop: 14 }}>
            {movements.map((movement) => (
              <div key={movement.id} className="row row--between" style={{ gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{movement.description}</strong>
                  <div className="tiny muted">{formatDate(movement.createdAt)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong className={`mono ${movement.amountCents >= 0 ? 'amount--in' : 'amount--out'}`}>
                    {movement.amountCents >= 0 ? '+' : '−'}
                    {formatMoney(Math.abs(movement.amountCents), settings.currency)}
                  </strong>
                  <div className="tiny muted mono">Saldo: {formatMoney(movement.balanceAfter, settings.currency)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="card__title">Solicitar un producto</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Si no encuentras algo en el catálogo, pídelo y el administrador recibirá una notificación.
          </p>
          <ProductRequestForm />
        </section>

        <section className="card">
          <h2 className="card__title">Seguridad</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Cambia tu contraseña periódicamente para proteger tu saldo.
          </p>
          <PasswordForm />
        </section>
      </div>
    </div>
  );
}
