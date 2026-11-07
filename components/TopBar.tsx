import Link from 'next/link';
import type { PublicUser, StoreSettings } from '../lib/types';
import { formatMoney } from '../lib/money';

export default function TopBar({ user, settings }: { user: PublicUser | null; settings: StoreSettings }) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link href="/" className="brand" aria-label={`${settings.storeName} inicio`}>
          <span className="brand__mark">N</span>
          <span className="brand__name">
            {settings.storeName.replace(/Store$/i, '')}
            <span>{/Store$/i.test(settings.storeName) ? 'Store' : ''}</span>
          </span>
        </Link>

        <div className="spacer" />

        {user ? (
          <>
            <Link href="/saldo" className="balance-pill" title="Saldo disponible">
              <small>Saldo</small>
              <span className="mono">{formatMoney(user.balanceCents, settings.currency)}</span>
            </Link>
            {user.role === 'ADMIN' ? (
              <Link href="/admin" className="icon-btn" title="Panel administrador" aria-label="Panel administrador">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3l8 4v5c0 4.4-3.4 8.3-8 9-4.6-.7-8-4.6-8-9V7l8-4z" />
                  <path d="M9.5 12l1.8 1.8 3.4-3.6" />
                </svg>
              </Link>
            ) : null}
            <Link href="/cuenta" className="avatar" title={user.name} aria-label="Mi cuenta">
              {user.name.trim().charAt(0).toUpperCase()}
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn--ghost btn--sm">
              Entrar
            </Link>
            <Link href="/registro" className="btn btn--sm">
              Crear cuenta
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
