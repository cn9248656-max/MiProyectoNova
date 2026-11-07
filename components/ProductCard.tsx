import Link from 'next/link';
import { formatMoney } from '../lib/money';
import type { Product } from '../lib/types';
import { addToCartAction } from '../app/actions';

export default function ProductCard({ product, currency }: { product: Product; currency: string }) {
  const outOfStock = product.stock <= 0;

  return (
    <article className="product-card">
      <Link href={`/producto/${product.id}`} className="product-card__media">
        {product.imageId ? (
          <img src={`/api/uploads/${product.imageId}`} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-card__placeholder">{product.name.charAt(0)}</div>
        )}
        {product.featured ? <span className="pill-tag pill-tag--featured">Destacado</span> : null}
        {outOfStock ? <span className="pill-tag pill-tag--sold">Agotado</span> : null}
      </Link>

      <div className="product-card__body">
        <span className="product-card__cat">{product.categoryName}</span>
        <Link href={`/producto/${product.id}`} className="product-card__name">
          {product.name}
        </Link>
        <p className="product-card__desc">{product.description}</p>

        <div className="product-card__foot">
          <span className="price">{formatMoney(product.priceCents, currency)}</span>
          <form action={addToCartAction}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="quantity" value="1" />
            <input type="hidden" name="redirectTo" value="/" />
            <button className="btn btn--sm" type="submit" disabled={outOfStock}>
              {outOfStock ? 'Agotado' : 'Agregar'}
            </button>
          </form>
        </div>

        <span className={`stock-line ${outOfStock ? 'stock-dot--out' : product.stock <= 3 ? 'stock-dot--low' : ''}`}>
          <i className="stock-dot" />
          {outOfStock ? 'Sin stock' : `${product.stock} disponibles`}
        </span>
      </div>
    </article>
  );
}
