'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clearSessionCookie, getAdminUser, getCurrentUser, setSessionCookie } from '../lib/auth';
import { parseAmountToCents } from '../lib/money';
import * as store from '../lib/store';
import type { OrderStatus, PaymentMethod } from '../lib/types';

export type ActionState = { error?: string; success?: string } | null;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function back(path: string, message: string): never {
  const separator = path.includes('?') ? '&' : '?';
  redirect(`${path}${separator}ok=${encodeURIComponent(message)}`);
}

function fail(path: string, message: string): never {
  const separator = path.includes('?') ? '&' : '?';
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin');
  return admin;
}

/* ------------------------------------------------------------------ */
/* Cuenta                                                             */
/* ------------------------------------------------------------------ */

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = store.createUser({
    name: str(formData, 'name'),
    email: str(formData, 'email'),
    phone: str(formData, 'phone'),
    password: str(formData, 'password'),
  });

  if (!result.ok) return { error: result.error };

  await setSessionCookie(result.user.id);
  revalidatePath('/', 'layout');
  redirect(result.user.role === 'ADMIN' ? '/admin' : '/');
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = store.verifyCredentials(str(formData, 'email'), str(formData, 'password'));
  if (!user) return { error: 'Correo o contraseña incorrectos.' };

  const next = str(formData, 'next');
  await setSessionCookie(user.id);
  revalidatePath('/', 'layout');
  redirect(next.startsWith('/') ? next : user.role === 'ADMIN' ? '/admin' : '/');
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function profileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = store.updateProfile(user.id, { name: str(formData, 'name'), phone: str(formData, 'phone') });
  if (!result.ok) return { error: result.error };
  revalidatePath('/', 'layout');
  return { success: 'Datos personales guardados.' };
}

export async function passwordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const next = str(formData, 'newPassword');
  if (next !== str(formData, 'repeatPassword')) return { error: 'Las contraseñas nuevas no coinciden.' };
  const result = store.changePassword(user.id, str(formData, 'currentPassword'), next);
  if (!result.ok) return { error: result.error };
  return { success: 'Contraseña actualizada correctamente.' };
}

/* ------------------------------------------------------------------ */
/* Carrito                                                            */
/* ------------------------------------------------------------------ */

export async function addToCartAction(formData: FormData): Promise<void> {
  const productId = str(formData, 'productId');
  const quantity = Number.parseInt(str(formData, 'quantity') || '1', 10) || 1;
  const destination = str(formData, 'redirectTo') || '/carrito';
  const user = await getCurrentUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/producto/${productId}`)}`);

  const result = store.addToCart(user.id, productId, quantity);
  revalidatePath('/', 'layout');
  if (!result.ok) fail(destination, result.error || 'No se pudo agregar el producto.');
  back(destination, 'Producto agregado al carrito.');
}

export async function setCartQuantityAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productId = str(formData, 'productId');
  const quantity = Number.parseInt(str(formData, 'quantity') || '0', 10);
  const result = store.setCartQuantity(user.id, productId, quantity);
  revalidatePath('/', 'layout');
  if (!result.ok) fail('/carrito', result.error || 'No se pudo actualizar la cantidad.');
  redirect('/carrito');
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  store.removeCartItem(user.id, str(formData, 'productId'));
  revalidatePath('/', 'layout');
  redirect('/carrito');
}

export async function clearCartAction(): Promise<void> {
  const user = await requireUser();
  store.clearCart(user.id);
  revalidatePath('/', 'layout');
  redirect('/carrito');
}

export async function checkoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Inicia sesión para confirmar tu compra.' };

  const paymentMethod: PaymentMethod = str(formData, 'paymentMethod') === 'AGORA' ? 'AGORA' : 'BALANCE';
  const result = store.checkout(user.id, {
    paymentMethod,
    note: str(formData, 'note'),
    reference: str(formData, 'reference'),
  });

  if (!result.ok) return { error: result.error };

  revalidatePath('/', 'layout');
  redirect(`/compras/${result.orderId}?ok=${encodeURIComponent(`Pedido ${result.code} creado correctamente.`)}`);
}

/* ------------------------------------------------------------------ */
/* Recargas                                                           */
/* ------------------------------------------------------------------ */

export async function topupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Inicia sesión para solicitar una recarga.' };

  const amountCents = parseAmountToCents(str(formData, 'amount'));
  if (amountCents === null) return { error: 'Escribe un monto válido.' };

  const receipt = formData.get('receipt');
  if (!(receipt instanceof File) || receipt.size === 0) {
    return { error: 'Adjunta el comprobante del pago por Agora.' };
  }
  if (!receipt.type.startsWith('image/')) return { error: 'El comprobante debe ser una imagen.' };
  if (receipt.size > 5 * 1024 * 1024) return { error: 'El comprobante no debe superar 5 MB.' };

  const receiptId = store.saveUpload(receipt.type, Buffer.from(await receipt.arrayBuffer()));
  const result = store.createTopup(user.id, {
    amountCents,
    reference: str(formData, 'reference'),
    receiptId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath('/saldo');
  revalidatePath('/admin/recargas');
  revalidatePath('/admin');
  return {
    success: 'Solicitud enviada. El saldo se acreditará cuando el administrador apruebe el comprobante.',
  };
}

/* ------------------------------------------------------------------ */
/* Solicitudes de productos                                          */
/* ------------------------------------------------------------------ */

export async function productRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Inicia sesión para enviar una solicitud.' };
  const result = store.createProductRequest(user.id, {
    productId: str(formData, 'productId') || null,
    productName: str(formData, 'productName'),
    message: str(formData, 'message'),
  });
  if (!result.ok) return { error: result.error || 'No se pudo enviar la solicitud.' };
  revalidatePath('/admin/solicitudes');
  return { success: 'Solicitud enviada. El administrador recibió tu pedido.' };
}

/* ------------------------------------------------------------------ */
/* Administración: productos                                          */
/* ------------------------------------------------------------------ */

export async function productSaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const productId = str(formData, 'productId');
  const priceCents = parseAmountToCents(str(formData, 'price'));
  const stock = Number.parseInt(str(formData, 'stock') || '0', 10);

  if (priceCents === null) return { error: 'Escribe un precio válido.' };
  if (!Number.isFinite(stock) || stock < 0) return { error: 'El stock debe ser un número igual o mayor a cero.' };

  let imageId = str(formData, 'currentImageId') || null;
  const image = formData.get('image');
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith('image/')) return { error: 'La imagen debe ser un archivo de imagen.' };
    if (image.size > 5 * 1024 * 1024) return { error: 'La imagen no debe superar 5 MB.' };
    imageId = store.saveUpload(image.type, Buffer.from(await image.arrayBuffer()));
  }

  const input = {
    name: str(formData, 'name'),
    description: str(formData, 'description'),
    priceCents,
    categoryId: str(formData, 'categoryId'),
    stock,
    imageId,
    active: str(formData, 'active') === 'on',
    featured: str(formData, 'featured') === 'on',
  };

  const result = productId ? store.updateProduct(productId, input) : store.createProduct(input);
  if (!result.ok) return { error: result.error };

  revalidatePath('/', 'layout');
  revalidatePath('/admin/productos');
  return { success: productId ? 'Producto actualizado y guardado.' : 'Producto creado y guardado.' };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = store.deleteProduct(str(formData, 'productId'));
  revalidatePath('/', 'layout');
  if (!result.ok) fail('/admin/productos', result.error || 'No se pudo eliminar el producto.');
  back('/admin/productos', 'Producto eliminado.');
}

export async function saveCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const categoryId = str(formData, 'categoryId');
  const name = str(formData, 'name');
  const icon = str(formData, 'icon');
  const result = categoryId ? store.updateCategory(categoryId, name, icon) : store.createCategory(name, icon);
  revalidatePath('/', 'layout');
  if (!result.ok) fail('/admin/categorias', result.error || 'No se pudo guardar la categoría.');
  back('/admin/categorias', categoryId ? 'Categoría actualizada.' : 'Categoría creada.');
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = store.deleteCategory(str(formData, 'categoryId'));
  revalidatePath('/', 'layout');
  if (!result.ok) fail('/admin/categorias', result.error || 'No se pudo eliminar la categoría.');
  back('/admin/categorias', 'Categoría eliminada.');
}

/* ------------------------------------------------------------------ */
/* Administración: pedidos, recargas, usuarios, solicitudes           */
/* ------------------------------------------------------------------ */

export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const status = str(formData, 'status') as OrderStatus;
  const result = store.updateOrderStatus(str(formData, 'orderId'), status);
  revalidatePath('/admin/pedidos');
  revalidatePath('/compras');
  if (!result.ok) fail('/admin/pedidos', result.error || 'No se pudo actualizar el pedido.');
  back('/admin/pedidos', 'Estado del pedido actualizado.');
}

export async function reviewTopupAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const decision = str(formData, 'decision') === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  const result = store.reviewTopup(str(formData, 'topupId'), decision, str(formData, 'adminNote'), admin.id);
  revalidatePath('/', 'layout');
  revalidatePath('/admin/recargas');
  revalidatePath('/saldo');
  if (!result.ok) fail('/admin/recargas', result.error || 'No se pudo procesar la recarga.');
  back('/admin/recargas', decision === 'APPROVED' ? 'Recarga aprobada y saldo acreditado.' : 'Recarga rechazada.');
}

export async function setUserRoleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const role = str(formData, 'role') === 'ADMIN' ? 'ADMIN' : 'USER';
  const result = store.setUserRole(str(formData, 'userId'), role);
  if (!result.ok) fail('/admin/usuarios', result.error || 'No se pudo actualizar el usuario.');
  back('/admin/usuarios', 'Rol del usuario actualizado.');
}

export async function resolveRequestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  store.resolveProductRequest(str(formData, 'requestId'));
  revalidatePath('/admin/solicitudes');
  back('/admin/solicitudes', 'Solicitud marcada como atendida.');
}

export async function markNotificationsReadAction(): Promise<void> {
  await requireAdmin();
  store.markNotificationsRead();
  revalidatePath('/admin', 'layout');
  redirect('/admin/notificaciones');
}

/* ------------------------------------------------------------------ */
/* Administración: configuración                                      */
/* ------------------------------------------------------------------ */

export async function settingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const storeName = str(formData, 'storeName').trim();
  if (storeName.length < 2) return { error: 'El nombre de la tienda es obligatorio.' };

  store.updateSettings({
    store_name: storeName,
    currency_symbol: str(formData, 'currency').trim().slice(0, 4) || '$',
    agora_alias: str(formData, 'agoraAlias').trim(),
    agora_phone: str(formData, 'agoraPhone').trim(),
    agora_holder: str(formData, 'agoraHolder').trim(),
    agora_note: str(formData, 'agoraNote').trim(),
    maintenance: str(formData, 'maintenance') === 'on' ? '1' : '0',
    maintenance_message: str(formData, 'maintenanceMessage').trim(),
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/configuracion');
  return { success: 'Configuración guardada. Los cambios ya están activos.' };
}
