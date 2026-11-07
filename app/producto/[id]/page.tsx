import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addToCartAction } from '../../../app/actions';
import { getCurrentUser } from '../../../lib/auth';
import { formatMoney } from '../../../lib/money';
import { getProduct, getSettings, listProducts } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();

  const settings = getSettings();
  const user = await getCurrentUser();
  const related = listProducts({ categorySlug: product.categorySlug })
    .filter((item) => item.id !== product.id)
    .slice(0, 3);

  const outOfStock = product.stock <= 0;
  const canAfford = Boolean(user && user.balanceCents >= product.priceCents);

  return (
    <div className="stack" style={{ gap: 26 }}>
      <Link className="link tiny" href={`/?cat=${product.categorySlug}`}>
        ← Volver a {product.categoryName}
      </Link>

      <article className="detail">
        <div className="detail__media">
          {product.imageId ? (
            <img src={`/api/uploads/${product.imageId}`} alt={product.name} />
          ) : (
            <div className="product-card__placeholder">{product.name.charAt(0)}</div>
          )}
        </div>

        <div className="detail__info">
          <span className="product-card__cat">{product.categoryName}</span>
          <h1 className="page-title" style={{ fontSize: 'clamp(24px, 4vw, 34px)' }}>
            {product.name}
          </h1>
          <p className="detail__desc">{product.description}</p>

          <div className="detail__price">{formatMoney(product.priceCents, settings.currency)}</div>
          <span className={`stock-line ${outOfStock ? 'stock-dot--out' : product.stock <= 3 ? 'stock-dot--low' : ''}`}>
            <i className="stock-dot" />
            {outOfStock ? 'Producto agotado' : `${product.stock} unidades disponibles`}
          </span>

          <form action={addToCartAction} className="form-actions" style={{ marginTop: 20 }}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="redirectTo" value="/carrito" />
            <div className="qty">
              <input
                className="input"
                type="number"
                name="quantity"
                min={1}
                max={Math.max(product.stock, 1)}
                defaultValue={1}
                aria-label="Cantidad"
                disabled={outOfStock}
              />
            </div>
            <button className="btn" type="submit" disabled={outOfStock}>
              {outOfStock ? 'Agotado' : 'Agregar al carrito'}
            </button>
            <Link className="btn btn--ghost" href="/carrito">
              Ver carrito
            </Link>
          </form>

          <div className="details-panel">
            <div className="details-panel__body">
              <div className="kv">
                <span>Categoría</span>
                <strong>{product.categoryName}</strong>
              </div>
              <div className="kv">
                <span>Entrega</span>
                <strong>Digital, tras aprobación</strong>
              </div>
              <div className="kv">
                <span>Pago</span>
                <strong>{canAfford ? 'Saldo disponible' : 'Saldo o Agora'}</strong>
              </div>
              {user ? (
                <div className="kv">
                  <span>Tu saldo</span>
                  <strong className="mono">{formatMoney(user.balanceCents, settings.currency)}</strong>
                </div>
              ) : null}
            </div>
          </div>

          {!user ? (
            <p className="hint" style={{ marginTop: 16 }}>
              <Link className="link" href={`/login?next=/producto/${product.id}`}>
                Inicia sesión
              </Link>{' '}
              para comprar con saldo o mediante Agora.
            </p>
          ) : !canAfford ? (
            <p className="hint" style={{ marginTop: 16 }}>
              Tu saldo no cubre este producto. Puedes{' '}
              <Link className="link" href="/saldo">
                añadir saldo
              </Link>{' '}
              o pagar aparte mediante Agora al confirmar la compra.
            </p>
          ) : null}
        </div>
      </article>

      {related.length > 0 ? (
        <section className="stack">
          <h2 className="section-title">También en {product.categoryName}</h2>
          <div className="product-grid">
            {related.map((item) => (
              <article key={item.id} className="product-card">
                <Link href={`/producto/${item.id}`} className="product-card__media">
                  {item.imageId ? (
                    <img src={`/api/uploads/${item.imageId}`} alt={item.name} loading="lazy" />
                  ) : (
                    <div className="product-card__placeholder">{item.name.charAt(0)}</div>
                  )}
                </Link>
                <div className="product-card__body">
                  <span className="product-card__cat">{item.categoryName}</span>
                  <Link href={`/producto/${item.id}`} className="product-card__name">
                    {item.name}
                  </Link>
                  <div className="product-card__foot">
                    <span className="price">{formatMoney(item.priceCents, settings.currency)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
