import { setUserRoleAction } from '../../../app/actions';
import { formatDate, formatMoney } from '../../../lib/money';
import { getSettings, listUsers } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const query = await searchParams;
  const settings = getSettings();
  const users = listUsers();

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">Consulta clientes y el saldo disponible en sus billeteras.</p>
        </div>
      </div>

      {query.ok ? <div className="alert alert--success">{query.ok}</div> : null}
      {query.error ? <div className="alert alert--error">{query.error}</div> : null}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Saldo</th>
              <th>Registro</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong style={{ fontSize: 14 }}>{user.name}</strong>
                  <div className="tiny muted">{user.email}</div>
                  {user.phone ? <div className="tiny muted">{user.phone}</div> : null}
                </td>
                <td className="mono">{formatMoney(user.balanceCents, settings.currency)}</td>
                <td className="tiny">{formatDate(user.createdAt)}</td>
                <td>
                  <span className={user.role === 'ADMIN' ? 'status status--approved' : 'status'}>
                    {user.role === 'ADMIN' ? 'Administrador' : 'Cliente'}
                  </span>
                </td>
                <td>
                  <form action={setUserRoleAction} className="row" style={{ gap: 6 }}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="role" value={user.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN'} />
                    <button className="btn btn--ghost btn--sm" type="submit">
                      {user.role === 'ADMIN' ? 'Quitar admin' : 'Hacer admin'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="hint">
        El saldo solo cambia cuando el administrador aprueba una recarga o cuando el cliente compra con su billetera.
      </p>
    </div>
  );
}
