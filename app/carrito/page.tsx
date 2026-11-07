import Link from 'next/link';
import { redirect } from 'next/navigation';
import CheckoutForm from '../../components/CheckoutForm';
import { getCurrentUser } from '../../lib/auth';
import { formatMoney } from '../../lib/money';
import { cartSummary, getSettings } from '../../lib/store';
import { clearCartAction, removeCartItemAction, setCartQuantityAction } from '../../app/actions';

export const dynamic = 'force-dynamic';

export default async function CartPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/carrito');

  const params = await searchParams;
  const settings = getSettings();
  const cart = cartSummary(user.id);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Carrito</h1>
          <p className="page-subtitle">
            {cart.itemCount === 0
              ? 'Tu carrito está vacío.'
              : `${cart.itemCount} ${cart.itemCount === 1 ? 'artículo' : 'artículos'} listos para comprar.`}
          </p>
        </div>
        {cart.lines.length > 0 ? (
          <form action={clearCartAction}>
            <button className="btn btn--ghost btn--sm" type="submit">
              Vaciar carrito
            </button>
          </form>
        ) : null}
      </div>

      {params.ok ? <div className="alert alert--success">{params.ok}</div> : null}
      {params.error ? <div className="alert alert--error">{params.error}</div> : null}

      {cart.lines.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">🛒</div>
          <h3>Tu carrito está vacío</h3>
          <p>Explora el catálogo y agrega juegos, streaming, software y más.</p>
          <Link className="btn" href="/">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="stack">
            {cart.lines.map((line) => (
              <div key={line.id} className="list-item">
                <div className="list-item__thumb">
                  {line.imageId ? (
                    <img src={`/api/uploads/${line.imageId}`} alt={line.name} />
                  ) : (
                    <span>{line.name.charAt(0)}</span>
                  )}
                </div>

                <div className="list-item__main">
                  <Link href={`/producto/${line.productId}`} className="list-item__title">
                    {line.name}
                  </Link>
                  <span className="list-item__meta">
                    {line.categoryName} · {formatMoney(line.priceCents, settings.currency)} c/u
                  </span>

                  <div className="row row--wrap" style={{ marginTop: 10, gap: 10 }}>
                    <form action={setCartQuantityAction} className="qty">
                      <input type="hidden" name="productId" value={line.productId} />
                      <input
                        className="input"
                        type="number"
                        name="quantity"
                        min={0}
                        max={line.stock}
                        defaultValue={line.quantity}
                        aria-label={`Cantidad de ${line.name}`}
                      />
                      <button className="btn btn--ghost btn--sm" type="submit">
                        Actualizar
                      </button>
                    </form>

                    <form action={removeCartItemAction}>
                      <input type="hidden" name="productId" value={line.productId} />
                      <button className="btn btn--danger btn--sm" type="submit">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>

                <div className="amount">
                  <strong className="mono">{formatMoney(line.priceCents * line.quantity, settings.currency)}</strong>
                </div>
              </div>
            ))}
          </div>

          <aside className="card">
            <h2 className="card__title">Resumen</h2>
            <div className="summary-row">
              <span>Subtotal</span>
              <span className="mono">{formatMoney(cart.totalCents, settings.currency)}</span>
            </div>
            <div className="summary-row summary-row--total">
              <span>Total</span>
              <strong className="mono">{formatMoney(cart.totalCents, settings.currency)}</strong>
            </div>

            <CheckoutForm
              totalCents={cart.totalCents}
              balanceCents={user.balanceCents}
              currency={settings.currency}
              agoraAlias={settings.agoraAlias}
              agoraPhone={settings.agoraPhone}
              agoraHolder={settings.agoraHolder}
              agoraNote={settings.agoraNote}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
