'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminUser } from '../lib/auth';
import * as provider from '../lib/provider';

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin/peakerr');
  return admin;
}

function toCents(value: FormDataEntryValue | null): number {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function done(params: { ok?: string; error?: string }): never {
  const query = params.error ? `error=${encodeURIComponent(params.error)}` : `ok=${encodeURIComponent(params.ok ?? 'Listo')}`;
  redirect(`/admin/peakerr?${query}`);
}

function refresh() {
  revalidatePath('/admin/peakerr');
  revalidatePath('/admin');
  revalidatePath('/tienda');
  revalidatePath('/');
}

/** Guarda URL + clave API (cifrada) y comprueba la conexión al instante. */
export async function savePeakerrConfigAction(formData: FormData): Promise<void> {
  await requireAdmin();
  try {
    provider.saveConfig({
      url: String(formData.get('url') ?? ''),
      apiKey: String(formData.get('apiKey') ?? ''),
      connected: true,
    });
    const test = await provider.testConnection();
    refresh();
    if (!test.ok) done({ error: `Configuración guardada, pero la conexión falló: ${test.error}` });
    done({ ok: 'PEAKERR conectado correctamente.' });
  } catch (error) {
    done({ error: error instanceof Error ? error.message : 'No se pudo guardar la configuración.' });
  }
}

export async function testPeakerrAction(): Promise<void> {
  await requireAdmin();
  const result = await provider.testConnection();
  refresh();
  if (!result.ok) done({ error: result.error || 'No se pudo conectar con PEAKERR.' });
  done({ ok: 'Conexión correcta con PEAKERR.' });
}

export async function disconnectPeakerrAction(): Promise<void> {
  await requireAdmin();
  provider.disconnect();
  provider.logEvent('warn', 'disconnect', 'API de PEAKERR desconectada por el administrador.');
  refresh();
  done({ ok: 'API desconectada. Los productos y pedidos se conservan.' });
}

export async function syncPeakerrServicesAction(): Promise<void> {
  await requireAdmin();
  try {
    const result = await provider.syncServices();
    refresh();
    done({ ok: `Servicios sincronizados: ${result.added} nuevos, ${result.updated} actualizados.` });
  } catch (error) {
    done({ error: error instanceof Error ? error.message : 'No se pudieron sincronizar los servicios.' });
  }
}

export async function linkProductServiceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  try {
    const productId = String(formData.get('productId') ?? '');
    const serviceId = String(formData.get('serviceId') ?? '');
    if (!productId || !serviceId) done({ error: 'Elige un producto y un servicio.' });
    provider.linkProduct(productId, serviceId);
    refresh();
    done({ ok: 'Producto vinculado al servicio de PEAKERR.' });
  } catch (error) {
    done({ error: error instanceof Error ? error.message : 'No se pudo vincular el producto.' });
  }
}

export async function unlinkProductServiceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  provider.unlinkProduct(productId);
  refresh();
  done({ ok: 'Producto desvinculado. No se enviará más a PEAKERR.' });
}

export async function saveProviderPricingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  try {
    provider.savePricing({
      productId: String(formData.get('productId') ?? ''),
      saleCents: toCents(formData.get('salePrice')),
      costCents: toCents(formData.get('costPrice')),
      priceMode: String(formData.get('priceMode') ?? 'UNIT') === 'PER_K' ? 'PER_K' : 'UNIT',
      offerCents: toCents(formData.get('offerPrice')),
      offerEndsAt: String(formData.get('offerEndsAt') ?? '').trim() || null,
      syncCost: formData.get('syncCost') === '1',
    });
    refresh();
    done({ ok: 'Precios guardados. La sincronización no los sobrescribirá.' });
  } catch (error) {
    done({ error: error instanceof Error ? error.message : 'No se pudieron guardar los precios.' });
  }
}

export async function createProductFromServiceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  try {
    provider.createProductFromService({
      serviceId: String(formData.get('serviceId') ?? ''),
      categoryId: String(formData.get('categoryId') ?? ''),
      saleCents: toCents(formData.get('salePrice')),
      description: String(formData.get('description') ?? ''),
    });
    refresh();
    done({ ok: 'Producto creado y publicado en la tienda.' });
  } catch (error) {
    done({ error: error instanceof Error ? error.message : 'No se pudo crear el producto.' });
  }
}

export async function toggleProviderServiceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  provider.setServiceActive(String(formData.get('serviceId') ?? ''), formData.get('active') === '1');
  refresh();
  done({ ok: 'Servicio actualizado.' });
}

export async function retryProviderOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = await provider.retryProviderOrder(String(formData.get('providerOrderId') ?? ''));
  refresh();
  if (!result.ok) done({ error: result.error || 'No se pudo reenviar el pedido.' });
  done({ ok: 'Pedido reenviado a PEAKERR.' });
}

/** Sincroniza estados y reintenta envíos pendientes sin esperar al ciclo automático. */
export async function refreshProviderStatusAction(): Promise<void> {
  await requireAdmin();
  try {
    const dispatched = await provider.dispatchPaidOrders();
    const statuses = await provider.syncStatuses();
    refresh();
    if (statuses.error) done({ error: `No se pudo consultar PEAKERR: ${statuses.error}` });
    done({ ok: `${dispatched} pedidos enviados · ${statuses.updated} estados actualizados.` });
  } catch (error) {
    done({ error: error instanceof Error ? error.message : 'No se pudo actualizar.' });
  }
}
