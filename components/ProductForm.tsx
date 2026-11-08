'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { productSaveAction } from '../app/actions';
import type { ActionState, Category, Product } from '../lib/types';

export default function ProductForm({
  product,
  categories,
  currency,
}: {
  product?: Product | null;
  categories: Category[];
  currency: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(productSaveAction, null);

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="alert alert--error">{state.error}</div> : null}
      {state?.success ? <div className="alert alert--success">{state.success}</div> : null}

      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <input type="hidden" name="currentImageId" value={product?.imageId || ''} />

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="product-name">
            Nombre
          </label>
          <input className="input" id="product-name" name="name" defaultValue={product?.name || ''} required minLength={2} />
        </div>

        <div className="field">
          <label className="label" htmlFor="product-category">
            Categoría
          </label>
          <select className="select" id="product-category" name="categoryId" defaultValue={product?.categoryId || ''} required>
            <option value="" disabled>
              Selecciona una categoría
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="product-description">
          Descripción
        </label>
        <textarea
          className="textarea"
          id="product-description"
          name="description"
          rows={3}
          defaultValue={product?.description || ''}
          required
          minLength={5}
          maxLength={600}
        />
      </div>

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="product-price">
            Precio ({currency})
          </label>
          <input
            className="input"
            id="product-price"
            name="price"
            inputMode="decimal"
            defaultValue={product ? (product.priceCents / 100).toFixed(2) : ''}
            placeholder="9.99"
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="product-stock">
            Stock
          </label>
          <input
            className="input"
            id="product-stock"
            name="stock"
            type="number"
            min={0}
            step={1}
            defaultValue={product?.stock ?? 10}
            required
          />
          <label className="checkbox" htmlFor="product-unlimited" style={{ marginTop: 10 }}>
            <input
              id="product-unlimited"
              name="unlimited"
              type="checkbox"
              defaultChecked={Boolean(product?.unlimitedStock)}
            />
            <span>Ilimitado (∞)</span>
          </label>
          <span className="hint">
            Con «Ilimitado (∞)» el producto siempre está disponible y no se descuenta stock. El número
            de arriba se conserva para cuando vuelvas a stock numérico.
          </span>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="product-image">
          Imagen {product?.imageId ? '(deja vacío para conservar la actual)' : ''}
        </label>
        <input className="input" id="product-image" name="image" type="file" accept="image/*" />
        <span className="hint">JPG o PNG, máximo 5 MB. Se guarda en la base de datos.</span>
      </div>

      <div className="row row--wrap" style={{ gap: 18 }}>
        <label className="checkbox">
          <input type="checkbox" name="active" defaultChecked={product ? product.active : true} />
          <span>Visible en la tienda</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" name="featured" defaultChecked={product?.featured || false} />
          <span>Destacado</span>
        </label>
      </div>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
        </button>
        {product ? (
          <Link className="btn btn--ghost" href="/admin/productos">
            Cancelar edición
          </Link>
        ) : null}
      </div>
    </form>
  );
}
