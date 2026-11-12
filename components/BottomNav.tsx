'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  {
    href: '/',
    label: 'Tienda',
    match: (path: string) => path === '/' || path.startsWith('/producto'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L5 4h14l2 5.5" />
        <path d="M4 9.5h16V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    href: '/carrito',
    label: 'Carrito',
    match: (path: string) => path.startsWith('/carrito'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.8a2 2 0 002-1.6L21 8H6" />
        <circle cx="10" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
      </svg>
    ),
  },
  {
    href: '/saldo',
    label: 'Añadir saldo',
    match: (path: string) => path.startsWith('/saldo'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="13" rx="3" />
        <path d="M3 10h18" />
        <path d="M12 13.5v4M10 15.5h4" />
      </svg>
    ),
  },
  {
    href: '/compras',
    label: 'Compras',
    match: (path: string) => path.startsWith('/compras'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l2 4v13a1 1 0 01-1 1H5a1 1 0 01-1-1V7l2-4z" />
        <path d="M4 7h16" />
        <path d="M9 11a3 3 0 006 0" />
      </svg>
    ),
  },
  {
    href: '/soporte',
    label: 'Soporte',
    match: (path: string) => path.startsWith('/soporte'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 13v-1a8 8 0 0116 0v1" />
        <path d="M4 13h2.2a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
        <path d="M20 13h-2.2a1 1 0 00-1 1v4a1 1 0 001 1H19a1 1 0 001-1v-5z" />
        <path d="M17.6 19.5a2.6 2.6 0 01-2.6 2.5h-2" />
      </svg>
    ),
  },
  {
    href: '/cuenta',
    label: 'Cuenta',
    match: (path: string) => path.startsWith('/cuenta'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M4.5 20a7.5 7.5 0 0115 0" />
      </svg>
    ),
  },
];

export default function BottomNav({ cartCount = 0, supportUnread = 0 }: { cartCount?: number; supportUnread?: number }) {
  const pathname = usePathname() || '/';

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link key={item.href} href={item.href} className="nav-item" data-active={active} aria-current={active ? 'page' : undefined}>
            {item.icon}
            <span>{item.label}</span>
            {item.href === '/carrito' && cartCount > 0 ? <span className="nav-item__badge">{cartCount > 99 ? '99+' : cartCount}</span> : null}
            {item.href === '/soporte' && supportUnread > 0 ? (
              <span className="nav-item__badge" aria-label={`${supportUnread} respuestas de soporte sin leer`}>
                {supportUnread > 9 ? '9+' : supportUnread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
