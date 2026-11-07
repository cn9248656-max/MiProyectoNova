import Link from 'next/link';
import ProductCard from '../components/ProductCard';
import { getCurrentUser } from '../lib/auth';
import { formatMoney } from '../lib/money';
import { cartSummary, getSettings, listCategories, listProducts } from '../lib/store';

export const dynamic = 'force-dynamic';

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const params = await searchParams;
  const settings = getSettings();
  const categories = listCategories();
  const products = listProducts({ search: params.q, categorySlug: params.cat });
  const user = await getCurrentUser();
  const cart = user ? cartSummary(user.id) : { lines: [], totalCents: 0, itemCount: 0 };

  const activeCategory = categories.find((category) => category.slug === params.cat);
  const search = (params.q || '').trim();

  return (
    <div className="stack" style={{ gap: 26 }}>
      <section className="hero">
        <span className="hero__eyebrow">
          <span className="badge-dot" /> Tienda digital verificada
        </span>
        <h1 className="page-title">
          Todo lo digital, <span style={{ color: 'var(--purple)' }}>en un solo lugar</span>
        </h1>
        <p className="page-subtitle">
          Juegos, streaming, software, servicios digitales y números virtuales. Paga con tu saldo {settings.storeName} o
          aparte mediante Agora.
        </p>

        <div className="hero__actions">
          <Link href="/saldo" className="btn">
            Añadir saldo
          </Link>
          <Link href="/compras" className="btn btn--ghost">
            Mis compras
          </Link>
        </div>

        <div className="hero__stats">
          <div className="hero__stat">
            <strong>{products.length}</strong>
            <span>productos activos</span>
          </div>
          <div className="hero__stat">
            <strong>{categories.length}</strong>
            <span>categorías</span>
          </div>
          <div className="hero__stat">
            <strong className="mono">{user ? formatMoney(user.balanceCents, settings.currency) : '—'}</strong>
            <span>tu saldo</span>
          </div>
          <div className="hero__stat">
            <strong>{cart.itemCount}</strong>
            <span>en el carrito</span>
          </div>
        </div>
      </section>

      <form className="search-bar" action="/" method="get">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" strokeLinecap="round" />
        </svg>
        <input
          name="q"
          defaultValue={search}
          placeholder="Buscar juegos, streaming, software…"
          aria-label="Buscar productos"
        />
        {params.cat ? <input type="hidden" name="cat" value={params.cat} /> : null}
        <button className="btn btn--sm" type="submit">
          Buscar
        </button>
      </form>

      <div className="chips">
        <Link href="/" className="chip-filter" data-active={!params.cat}>
          Todos
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/?cat=${category.slug}`}
            className="chip-filter"
            data-active={params.cat === category.slug}
          >
            <span aria-hidden>{category.icon}</span> {category.name}
          </Link>
        ))}
      </div>

      {search || activeCategory ? (
        <div className="row row--between row--wrap">
          <h2 className="section-title">
            {activeCategory ? activeCategory.name : `Resultados para “${search}”`}
            <span className="muted tiny"> · {products.length} encontrados</span>
          </h2>
          <Link className="link tiny" href="/">
            Limpiar filtros
          </Link>
        </div>
      ) : (
        <h2 className="section-title">Catálogo destacado</h2>
      )}

      {products.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">🔍</div>
          <h3>No encontramos productos</h3>
          <p>Prueba con otra búsqueda o revisa otra categoría del catálogo.</p>
          <Link className="btn btn--ghost btn--sm" href="/">
            Ver todo el catálogo
          </Link>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} currency={settings.currency} />
          ))}
        </div>
      )}

      <section className="card card--flat">
        <div className="row row--between row--wrap">
          <div>
            <h2 className="card__title">¿No encuentras lo que buscas?</h2>
            <p className="hint">
              Envíanos una solicitud y el administrador recibirá una notificación para conseguir ese producto.
            </p>
          </div>
          <Link className="btn btn--outline btn--sm" href="/cuenta#solicitud">
            Solicitar un producto
          </Link>
        </div>
      </section>
    </div>
  );
}
