'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Resumen', icon: '◈' },
  { href: '/admin/productos', label: 'Productos', icon: '▣' },
  { href: '/admin/categorias', label: 'Categorías', icon: '❖' },
  { href: '/admin/pedidos', label: 'Pedidos', icon: '🧾' },
  { href: '/admin/mensajes', label: 'Mensajes', icon: '💬' },
  { href: '/admin/soporte', label: 'Soporte', icon: '🎧' },
  { href: '/admin/recargas', label: 'Recargas', icon: '💳' },
  { href: '/admin/usuarios', label: 'Usuarios', icon: '👤' },
  { href: '/admin/solicitudes', label: 'Solicitudes', icon: '✉' },
  { href: '/admin/notificaciones', label: 'Notificaciones', icon: '🔔' },
  { href: '/admin/respaldo', label: 'Respaldos', icon: '🛡' },
  { href: '/admin/configuracion', label: 'Configuración', icon: '⚙' },
];

export default function AdminNav({ unread, chatUnread = 0, supportUnread = 0 }: { unread: number; chatUnread?: number; supportUnread?: number }) {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link key={link.href} href={link.href} className="admin-nav__link" data-active={active}>
            <span aria-hidden>{link.icon}</span>
            <span>{link.label}</span>
            {link.href === '/admin/notificaciones' && unread > 0 ? (
              <span className="badge-dot" data-count={unread} />
            ) : null}
            {link.href === '/admin/mensajes' && chatUnread > 0 ? (
              <span className="badge-dot" data-count={chatUnread} />
            ) : null}
            {link.href === '/admin/soporte' && supportUnread > 0 ? (
              <span className="badge-dot" data-count={supportUnread} />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
