'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminUser } from '../lib/auth';
import { createSnapshot } from '../lib/backup';
import { restoreMissingCatalog } from '../lib/catalog-recovery';
import { db } from '../lib/db';

/**
 * Repone desde el catálogo guardado (lib/catalog-snapshot.ts) los productos y
 * categorías que falten en la base. Solo agrega: nunca borra, reemplaza ni
 * modifica productos, pedidos, clientes, comprobantes o mensajes existentes.
 */
export async function restoreCatalogAction(): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin');

  let message = 'El catálogo ya tiene todos los productos guardados: no faltaba ninguno.';

  try {
    const conn = db();
    const preview = restoreMissingCatalog(conn, { dryRun: true });

    if (preview.productsAdded > 0 || preview.categoriesAdded > 0) {
      // Precaución extra: copia del estado actual antes de agregar nada.
      try {
        createSnapshot('antes-de-recuperar-catalogo');
      } catch (error) {
        console.error('[nova] No se pudo crear la copia previa a la recuperación:', error);
      }

      const result = restoreMissingCatalog(conn);
      message =
        `Catálogo recuperado: ${result.productsAdded} productos y ${result.categoriesAdded} categorías repuestos` +
        (result.added.length > 0 ? ` (${result.added.join(', ')}).` : '.');
      revalidatePath('/', 'layout');
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'No se pudo recuperar el catálogo.';
    redirect(`/admin/respaldo?error=${encodeURIComponent(text)}`);
  }

  redirect(`/admin/respaldo?ok=${encodeURIComponent(message)}`);
}
