import Link from 'next/link';
import ProductForm from '../../../components/ProductForm';
import { archiveProductAction, restoreProductAction } from '../../../app/actions';
import { formatMoney } from '../../../lib/money';
import { getProduct, getSettings, listCategories, listProducts } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; ok?: string; error?: string }>;
}) {
  const query = await searchParams;
  const settings = getSettings();
  const categories = listCategories();
  const products = listProducts({ includeInactive: true });
  const editing = query.edit ? getProduct(query.edit) : null;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-subtitle">Crea, edita y elimina productos, precios y stock.</p>
        </div>
      </div>

      {query.ok ? <div className="alert alert--success">{query.ok}</div> : null}
      {query.error ? <div className="alert alert--error">{query.error}</div> : null}

      <section className="card">
        <h2 className="card__title">{editing ? `Editar: ${editing.name}` : 'Nuevo producto'}</h2>
        {categories.length === 0 ? (
          <p className="hint">
            Primero crea una categoría en <Link className="link" href="/admin/categorias">Categorías</Link>.
          </p>
        ) : (
          <ProductForm product={editing} categories={categories} currency={settings.currency} />
        )}
      </section>

      <section className="stack">
        <div className="row row--between">
          <h2 className="section-title" style={{ margin: 0 }}>
            Catálogo ({products.length})
          </h2>
        </div>

        {products.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">📦</div>
            <h3>No hay productos todavía</h3>
            <p>Crea el primero con el formulario de arriba.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <div className="list-item__thumb" style={{ width: 38, height: 38 }}>
                          {product.imageId ? (
                            <img src={`/api/uploads/${product.imageId}`} alt="" />
                          ) : (
                            <span>✦</span>
                          )}
                        </div>
                        <div>
                          <strong style={{ fontSize: 14 }}>{product.name}</strong>
                          {product.featured ? <div className="tiny muted">Destacado</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="tiny">{product.categoryName}</td>
                    <td className="mono">{formatMoney(product.priceCents, settings.currency)}</td>
                    <td>
                      <span className={product.stock <= 3 ? 'status status--pending' : 'status'}>{product.stock}</span>
                    </td>
                    <td>
                      <span className={product.active ? 'status status--approved' : 'status status--cancelled'}>
                        {product.active ? 'Visible' : 'Oculto'}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Link className="btn btn--ghost btn--sm" href={`/admin/productos?edit=${product.id}`}>
                          Editar
                        </Link>
                        {product.active ? (
                          <form action={archiveProductAction}>
                            <input type="hidden" name="productId" value={product.id} />
                            <button className="btn btn--ghost btn--sm" type="submit" title="Deja de mostrarse; no borra pedidos ni imágenes">
                              Archivar
                            </button>
                          </form>
                        ) : (
                          <form action={restoreProductAction}>
                            <input type="hidden" name="productId" value={product.id} />
                            <button className="btn btn--ghost btn--sm" type="submit">
                              Publicar
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
