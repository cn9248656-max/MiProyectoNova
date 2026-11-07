import { deleteCategoryAction, saveCategoryAction } from '../../../app/actions';
import { listCategories, listProducts } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const query = await searchParams;
  const categories = listCategories();
  const products = listProducts({ includeInactive: true });

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="page-subtitle">Organiza el catálogo en secciones.</p>
        </div>
      </div>

      {query.ok ? <div className="alert alert--success">{query.ok}</div> : null}
      {query.error ? <div className="alert alert--error">{query.error}</div> : null}

      <section className="card">
        <h2 className="card__title">Nueva categoría</h2>
        <form action={saveCategoryAction} className="form-grid">
          <div className="field">
            <label className="label" htmlFor="category-name">
              Nombre
            </label>
            <input className="input" id="category-name" name="name" placeholder="Ej. Gift Cards" required minLength={2} />
          </div>
          <div className="field">
            <label className="label" htmlFor="category-icon">
              Icono <span className="muted tiny">(emoji o símbolo)</span>
            </label>
            <input className="input" id="category-icon" name="icon" placeholder="🎁" maxLength={4} />
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <button className="btn" type="submit">
              Crear categoría
            </button>
          </div>
        </form>
      </section>

      <section className="stack">
        <h2 className="section-title">Categorías existentes ({categories.length})</h2>

        <div className="stack">
          {categories.map((category) => {
            const count = products.filter((product) => product.categoryId === category.id).length;
            return (
              <div key={category.id} className="card card--flat">
                <form action={saveCategoryAction} className="row row--between row--wrap" style={{ gap: 12 }}>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <div className="row" style={{ gap: 10, flex: 1, minWidth: 220 }}>
                    <span style={{ fontSize: 20 }}>{category.icon}</span>
                    <input className="input" name="name" defaultValue={category.name} required minLength={2} />
                    <input className="input" name="icon" defaultValue={category.icon} maxLength={4} style={{ maxWidth: 90 }} />
                  </div>
                  <span className="tiny muted">{count} productos</span>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn--ghost btn--sm" type="submit">
                      Guardar
                    </button>
                  </div>
                </form>

                <form action={deleteCategoryAction} style={{ marginTop: 8 }}>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <button className="btn btn--danger btn--sm" type="submit" disabled={count > 0}>
                    {count > 0 ? 'Tiene productos' : 'Eliminar'}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
