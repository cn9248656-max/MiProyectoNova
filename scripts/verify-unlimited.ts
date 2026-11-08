/**
 * Prueba de la opción «Ilimitado (∞)»:
 *  - un producto ilimitado se puede comprar siempre y su stock no baja;
 *  - un producto numérico mantiene sus límites y sí descuenta;
 *  - se puede pasar de ilimitado a numérico y volver sin perder el número guardado.
 * Uso: DATA_DIR=/tmp/nova-unlimited tsx scripts/verify-unlimited.ts
 */
import {
  addToCart,
  checkout,
  createCategory,
  createProduct,
  createUser,
  getProduct,
  listCategories,
  updateProduct,
} from '../lib/store';
import type { Product } from '../lib/types';

let checks = 0;

function fail(message: string): never {
  console.error(`FALLO: ${message}`);
  process.exit(1);
}

function check(condition: boolean, message: string) {
  checks += 1;
  if (!condition) fail(message);
  console.log(`  ✓ ${message}`);
}

function inputFrom(product: Product, overrides: { stock?: number; unlimitedStock?: boolean } = {}) {
  return {
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    categoryId: product.categoryId,
    imageId: product.imageId,
    stock: overrides.stock ?? product.stock,
    unlimitedStock: overrides.unlimitedStock ?? product.unlimitedStock,
    active: product.active,
    featured: product.featured,
  };
}

function reload(id: string): Product {
  const product = getProduct(id);
  if (!product) fail(`el producto ${id} no existe`);
  return product;
}

const category = createCategory('Prueba Ilimitado', '∞');
if (!category.ok) fail(`no se pudo crear la categoría: ${category.error}`);
const categoryId = listCategories().find((item) => item.name === 'Prueba Ilimitado')!.id;

const user = createUser({ email: 'ilimitado@nova.test', name: 'Cliente Ilimitado', password: 'secreto123' });
if (!user.ok) fail(`no se pudo crear el cliente: ${user.error}`);

const unlimited = createProduct({
  name: 'Producto Ilimitado',
  description: 'Se vende sin límite.',
  priceCents: 500,
  categoryId,
  stock: 4,
  unlimitedStock: true,
  active: true,
  featured: false,
});
if (!unlimited.ok) fail(`no se pudo crear el producto ilimitado: ${unlimited.error}`);

const limited = createProduct({
  name: 'Producto Numérico',
  description: 'Se vende con stock 2.',
  priceCents: 700,
  categoryId,
  stock: 2,
  unlimitedStock: false,
  active: true,
  featured: false,
});
if (!limited.ok) fail(`no se pudo crear el producto numérico: ${limited.error}`);

console.log('1) Producto ilimitado: compra siempre disponible y sin descuento');
check(reload(unlimited.id).unlimitedStock === true, 'la bandera ilimitado se guarda en la base de datos');
const addUnlimited = addToCart(user.user.id, unlimited.id, 3);
check(addUnlimited.ok, `se agregan 3 unidades de un producto con stock 4 (${addUnlimited.error ?? 'ok'})`);
const saleUnlimited = checkout(user.user.id, { paymentMethod: 'AGORA' });
check(saleUnlimited.ok, `la compra ilimitada se completa (${saleUnlimited.ok ? saleUnlimited.code : saleUnlimited.error})`);
check(reload(unlimited.id).stock === 4, 'el stock del producto ilimitado no se descuenta (sigue en 4)');

console.log('2) Se puede repetir la compra de un ilimitado aunque el stock numérico sea bajo');
const addAgain = addToCart(user.user.id, unlimited.id, 5);
check(addAgain.ok, `se agregan 5 unidades más (${addAgain.error ?? 'ok'})`);
const saleAgain = checkout(user.user.id, { paymentMethod: 'AGORA' });
check(saleAgain.ok, 'la segunda compra ilimitada también se completa');
check(reload(unlimited.id).stock === 4, 'el stock numérico guardado permanece intacto (4)');

console.log('3) Producto numérico: conserva sus límites y descuenta');
const tooMany = addToCart(user.user.id, limited.id, 3);
check(!tooMany.ok, 'no permite agregar 3 unidades cuando solo hay 2');
check(addToCart(user.user.id, limited.id, 2).ok, 'permite agregar las 2 unidades disponibles');
const saleLimited = checkout(user.user.id, { paymentMethod: 'AGORA' });
check(saleLimited.ok, 'la compra numérica se completa');
check(reload(limited.id).stock === 0, 'el stock numérico baja a 0');

console.log('4) Cambio de ilimitado a numérico y de vuelta');
const backToNumber = updateProduct(unlimited.id, inputFrom(reload(unlimited.id), { stock: 2, unlimitedStock: false }));
check(backToNumber.ok, 'se puede volver a stock numérico');
check(reload(unlimited.id).stock === 2, 'el stock numérico elegido se guarda (2)');
check(!addToCart(user.user.id, unlimited.id, 5).ok, 'con stock 2 ya no permite 5 unidades');

const toUnlimitedAgain = updateProduct(unlimited.id, inputFrom(reload(unlimited.id), { stock: 2, unlimitedStock: true }));
check(toUnlimitedAgain.ok, 'se puede volver a ilimitado');
check(addToCart(user.user.id, unlimited.id, 9).ok, 'ya permite 9 unidades otra vez');
const saleFinal = checkout(user.user.id, { paymentMethod: 'AGORA' });
check(saleFinal.ok, 'la compra final se completa');
check(reload(unlimited.id).stock === 2, 'el número 2 se conservó para el futuro stock numérico');

console.log(`\nOK: ${checks} comprobaciones de stock ilimitado pasaron.`);
