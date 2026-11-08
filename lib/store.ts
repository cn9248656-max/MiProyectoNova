import bcrypt from 'bcryptjs';
import { db, id, now } from './db';
import { ensureConversation } from './chat';
import type {
  AdminStats,
  AdminUser,
  CartLine,
  Category,
  NotificationItem,
  Order,
  OrderCustomerData,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductRequest,
  PublicUser,
  StoreSettings,
  Topup,
  TopupStatus,
  WalletTx,
} from './types';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const num = (value: unknown, fallback = 0): number => (typeof value === 'number' ? value : Number(value) || fallback);

function mapUser(row: Row): PublicUser {
  return {
    id: str(row.id),
    email: str(row.email),
    name: str(row.name),
    phone: (row.phone as string | null) ?? null,
    role: str(row.role, 'USER') === 'ADMIN' ? 'ADMIN' : 'USER',
    balanceCents: num(row.balance_cents),
    createdAt: str(row.created_at),
  };
}

function mapProduct(row: Row): Product {
  return {
    id: str(row.id),
    name: str(row.name),
    description: str(row.description),
    priceCents: num(row.price_cents),
    categoryId: str(row.category_id),
    categoryName: str(row.category_name),
    categorySlug: str(row.category_slug),
    imageId: (row.image_id as string | null) ?? null,
    stock: num(row.stock),
    unlimitedStock: num(row.unlimited_stock) === 1,
    active: num(row.active) === 1,
    featured: num(row.featured) === 1,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/* ------------------------------------------------------------------ */
/* Configuración de la tienda                                         */
/* ------------------------------------------------------------------ */

export function getSettings(): StoreSettings {
  const rows = db().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    storeName: map.store_name || 'NovaStore',
    currency: map.currency_symbol || '$',
    agoraAlias: map.agora_alias || '',
    agoraPhone: map.agora_phone || '',
    agoraHolder: map.agora_holder || '',
    agoraNote: map.agora_note || '',
    maintenance: map.maintenance === '1',
    maintenanceMessage: map.maintenance_message || 'Estamos en mantenimiento.',
  };
}

const SETTING_KEYS = [
  'store_name',
  'currency_symbol',
  'agora_alias',
  'agora_phone',
  'agora_holder',
  'agora_note',
  'maintenance',
  'maintenance_message',
] as const;

export function updateSettings(values: Record<string, string>): void {
  const stmt = db().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db().transaction(() => {
    for (const key of SETTING_KEYS) {
      if (typeof values[key] === 'string') stmt.run(key, values[key].slice(0, 600));
    }
  });
  tx();
}

/* ------------------------------------------------------------------ */
/* Usuarios                                                           */
/* ------------------------------------------------------------------ */

export function getUserById(userId: string): PublicUser | null {
  const row = db().prepare('SELECT * FROM users WHERE id = ?').get(userId) as Row | undefined;
  return row ? mapUser(row) : null;
}

export function findUserByEmail(email: string): PublicUser | null {
  const row = db().prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as Row | undefined;
  return row ? mapUser(row) : null;
}

export function countUsers(): number {
  return num((db().prepare('SELECT COUNT(*) AS c FROM users').get() as Row).c);
}

export function createUser(input: {
  email: string;
  name: string;
  phone?: string;
  password: string;
}): { ok: true; user: PublicUser } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'Escribe tu nombre completo.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'El correo no es válido.' };
  if (input.password.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  if (findUserByEmail(email)) return { ok: false, error: 'Ese correo ya está registrado.' };

  const isFirstUser = countUsers() === 0;
  const userId = id('usr_');
  const stamp = now();
  db()
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, phone, role, balance_cents, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(
      userId,
      email,
      bcrypt.hashSync(input.password, 10),
      name,
      input.phone?.trim() || null,
      isFirstUser ? 'ADMIN' : 'USER',
      0,
      stamp,
      stamp
    );
  const user = getUserById(userId);
  return user ? { ok: true, user } : { ok: false, error: 'No se pudo crear la cuenta.' };
}

export function verifyCredentials(email: string, password: string): PublicUser | null {
  const row = db().prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as Row | undefined;
  if (!row) return null;
  const hash = str(row.password_hash);
  if (!hash || !bcrypt.compareSync(password, hash)) return null;
  return mapUser(row);
}

export function updateProfile(
  userId: string,
  input: { name: string; phone?: string }
): { ok: true } | { ok: false; error: string } {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'El nombre es obligatorio.' };
  db()
    .prepare('UPDATE users SET name = ?, phone = ?, updated_at = ? WHERE id = ?')
    .run(name, input.phone?.trim() || null, now(), userId);
  return { ok: true };
}

export function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string
): { ok: true } | { ok: false; error: string } {
  if (nextPassword.length < 6) return { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  const row = db().prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as Row | undefined;
  if (!row || !bcrypt.compareSync(currentPassword, str(row.password_hash))) {
    return { ok: false, error: 'La contraseña actual no es correcta.' };
  }
  db().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    bcrypt.hashSync(nextPassword, 10),
    now(),
    userId
  );
  return { ok: true };
}

export function listUsers(): AdminUser[] {
  const rows = db()
    .prepare(
      `SELECT u.*,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
        (SELECT COALESCE(SUM(o.total_cents), 0) FROM orders o WHERE o.user_id = u.id AND o.status != 'CANCELLED') AS total_spent
       FROM users u ORDER BY u.created_at DESC`
    )
    .all() as Row[];
  return rows.map((row) => ({
    ...mapUser(row),
    orderCount: num(row.order_count),
    totalSpentCents: num(row.total_spent),
  }));
}

export function setUserRole(userId: string, role: 'USER' | 'ADMIN'): { ok: boolean; error?: string } {
  if (role === 'USER') {
    const admins = num((db().prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'ADMIN'").get() as Row).c);
    const target = getUserById(userId);
    if (admins <= 1 && target?.role === 'ADMIN') {
      return { ok: false, error: 'Debe existir al menos un administrador.' };
    }
  }
  db().prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, now(), userId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Categorías y productos                                             */
/* ------------------------------------------------------------------ */

export function listCategories(): Category[] {
  const rows = db().prepare('SELECT * FROM categories ORDER BY position ASC, name ASC').all() as Row[];
  return rows.map((row) => ({
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    icon: str(row.icon, '✦'),
    position: num(row.position),
  }));
}

export function createCategory(name: string, icon: string): { ok: boolean; error?: string } {
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: 'El nombre de la categoría es obligatorio.' };
  const slug = slugify(clean);
  if (!slug) return { ok: false, error: 'Nombre de categoría inválido.' };
  if (db().prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) {
    return { ok: false, error: 'Esa categoría ya existe.' };
  }
  const position = num((db().prepare('SELECT COALESCE(MAX(position), 0) AS p FROM categories').get() as Row).p) + 1;
  db()
    .prepare('INSERT INTO categories (id, name, slug, icon, position, created_at) VALUES (?,?,?,?,?,?)')
    .run(id('cat_'), clean, slug, icon.trim() || '✦', position, now());
  return { ok: true };
}

export function updateCategory(categoryId: string, name: string, icon: string): { ok: boolean; error?: string } {
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: 'El nombre de la categoría es obligatorio.' };
  const slug = slugify(clean);
  const existing = db().prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, categoryId);
  if (existing) return { ok: false, error: 'Ya existe otra categoría con ese nombre.' };
  db().prepare('UPDATE categories SET name = ?, slug = ?, icon = ? WHERE id = ?').run(
    clean,
    slug,
    icon.trim() || '✦',
    categoryId
  );
  return { ok: true };
}

export function deleteCategory(categoryId: string): { ok: boolean; error?: string } {
  const used = num(
    (db().prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ?').get(categoryId) as Row).c
  );
  if (used > 0) return { ok: false, error: 'No puedes eliminar una categoría con productos asignados.' };
  db().prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
  return { ok: true };
}

export function listProducts(options: { categorySlug?: string; search?: string; includeInactive?: boolean } = {}): Product[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (!options.includeInactive) clauses.push('p.active = 1');
  if (options.categorySlug) {
    clauses.push('c.slug = ?');
    params.push(options.categorySlug);
  }
  if (options.search?.trim()) {
    clauses.push('(p.name LIKE ? OR p.description LIKE ?)');
    const term = `%${options.search.trim()}%`;
    params.push(term, term);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.featured DESC, p.created_at DESC`
    )
    .all(...params) as Row[];
  return rows.map(mapProduct);
}

export function getProduct(productId: string): Product | null {
  const row = db()
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
    )
    .get(productId) as Row | undefined;
  return row ? mapProduct(row) : null;
}

export interface ProductInput {
  name: string;
  description: string;
  priceCents: number;
  categoryId: string;
  stock: number;
  /** Opcional para no romper llamadas antiguas: por defecto el stock es numérico. */
  unlimitedStock?: boolean;
  imageId?: string | null;
  active: boolean;
  featured: boolean;
}

export function createProduct(input: ProductInput): { ok: true; id: string } | { ok: false; error: string } {
  if (input.name.trim().length < 2) return { ok: false, error: 'El nombre del producto es obligatorio.' };
  if (input.priceCents <= 0) return { ok: false, error: 'El precio debe ser mayor que cero.' };
  if (input.stock < 0) return { ok: false, error: 'El stock no puede ser negativo.' };
  if (!db().prepare('SELECT id FROM categories WHERE id = ?').get(input.categoryId)) {
    return { ok: false, error: 'Selecciona una categoría válida.' };
  }
  const productId = id('prod_');
  const stamp = now();
  db()
    .prepare(
      `INSERT INTO products (id, name, description, price_cents, category_id, image_id, stock, unlimited_stock, active, featured, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      productId,
      input.name.trim(),
      input.description.trim(),
      input.priceCents,
      input.categoryId,
      input.imageId || null,
      input.stock,
      input.unlimitedStock ? 1 : 0,
      input.active ? 1 : 0,
      input.featured ? 1 : 0,
      stamp,
      stamp
    );
  return { ok: true, id: productId };
}

export function updateProduct(
  productId: string,
  input: ProductInput
): { ok: true } | { ok: false; error: string } {
  if (!getProduct(productId)) return { ok: false, error: 'El producto no existe.' };
  if (input.name.trim().length < 2) return { ok: false, error: 'El nombre del producto es obligatorio.' };
  if (input.priceCents <= 0) return { ok: false, error: 'El precio debe ser mayor que cero.' };
  if (input.stock < 0) return { ok: false, error: 'El stock no puede ser negativo.' };
  db()
    .prepare(
      `UPDATE products SET name = ?, description = ?, price_cents = ?, category_id = ?, image_id = ?,
        stock = ?, unlimited_stock = ?, active = ?, featured = ?, updated_at = ? WHERE id = ?`
    )
    .run(
      input.name.trim(),
      input.description.trim(),
      input.priceCents,
      input.categoryId,
      input.imageId || null,
      input.stock,
      input.unlimitedStock ? 1 : 0,
      input.active ? 1 : 0,
      input.featured ? 1 : 0,
      now(),
      productId
    );
  return { ok: true };
}

/**
 * Archiva un producto sin borrar su registro: deja de mostrarse en la tienda y
 * se puede restaurar. Así los pedidos, imágenes y datos históricos se conservan.
 */
export function archiveProduct(productId: string): { ok: boolean; error?: string } {
  const product = db().prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return { ok: false, error: 'El producto no existe.' };
  const tx = db().transaction(() => {
    db().prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(now(), productId);
    db().prepare('DELETE FROM cart_items WHERE product_id = ?').run(productId);
  });
  tx();
  return { ok: true };
}

/** Vuelve a publicar un producto archivado, conservando su historial. */
export function restoreProduct(productId: string): { ok: boolean; error?: string } {
  const product = db().prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return { ok: false, error: 'El producto no existe.' };
  db().prepare('UPDATE products SET active = 1, updated_at = ? WHERE id = ?').run(now(), productId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Carrito                                                            */
/* ------------------------------------------------------------------ */

export function getCart(userId: string): CartLine[] {
  const rows = db()
    .prepare(
      `SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price_cents, p.stock, p.unlimited_stock, p.image_id, c.name AS category_name
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE ci.user_id = ?
       ORDER BY ci.created_at ASC`
    )
    .all(userId) as Row[];
  return rows.map((row) => ({
    id: str(row.id),
    productId: str(row.product_id),
    quantity: num(row.quantity),
    name: str(row.name),
    priceCents: num(row.price_cents),
    stock: num(row.stock),
    unlimitedStock: num(row.unlimited_stock) === 1,
    imageId: (row.image_id as string | null) ?? null,
    categoryName: str(row.category_name),
  }));
}

export function cartSummary(userId: string): { lines: CartLine[]; totalCents: number; itemCount: number } {
  const lines = getCart(userId);
  return {
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export function addToCart(userId: string, productId: string, quantity = 1): { ok: boolean; error?: string } {
  const product = getProduct(productId);
  if (!product || !product.active) return { ok: false, error: 'Producto no disponible.' };
  if (!product.unlimitedStock && product.stock <= 0) {
    return { ok: false, error: 'Producto agotado. Puedes solicitar aviso al administrador.' };
  }
  const qty = Math.max(1, Math.min(99, Math.floor(quantity)));
  const current = db()
    .prepare('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?')
    .get(userId, productId) as Row | undefined;
  const limit = product.unlimitedStock ? 99 : product.stock;
  const next = Math.min(limit, num(current?.quantity) + qty);
  if (current) {
    db().prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?').run(
      next,
      userId,
      productId
    );
  } else {
    db()
      .prepare('INSERT INTO cart_items (id, user_id, product_id, quantity, created_at) VALUES (?,?,?,?,?)')
      .run(id('cart_'), userId, productId, next, now());
  }
  return { ok: true };
}

export function setCartQuantity(userId: string, productId: string, quantity: number): { ok: boolean; error?: string } {
  if (quantity <= 0) {
    db().prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(userId, productId);
    return { ok: true };
  }
  const product = getProduct(productId);
  if (!product) return { ok: false, error: 'Producto no disponible.' };
  if (!product.unlimitedStock && quantity > product.stock) {
    return { ok: false, error: `Solo hay ${product.stock} unidades disponibles.` };
  }
  const limit = product.unlimitedStock ? 99 : product.stock;
  db()
    .prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?')
    .run(Math.min(Math.floor(quantity), limit), userId, productId);
  return { ok: true };
}

export function removeCartItem(userId: string, productId: string): void {
  db().prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(userId, productId);
}

export function clearCart(userId: string): void {
  db().prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
}

/* ------------------------------------------------------------------ */
/* Billetera                                                          */
/* ------------------------------------------------------------------ */

function insertWalletTx(
  userId: string,
  amountCents: number,
  type: string,
  description: string,
  balanceAfter: number,
  refs: { orderId?: string | null; topupId?: string | null } = {}
): void {
  db()
    .prepare(
      `INSERT INTO wallet_transactions (id, user_id, amount_cents, type, description, order_id, topup_id, balance_after, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(
      id('tx_'),
      userId,
      amountCents,
      type,
      description,
      refs.orderId || null,
      refs.topupId || null,
      balanceAfter,
      now()
    );
}

function creditWalletInTx(
  userId: string,
  amountCents: number,
  type: string,
  description: string,
  refs: { orderId?: string | null; topupId?: string | null } = {}
): number {
  if (amountCents <= 0) throw new Error('Monto inválido.');
  const result = db()
    .prepare('UPDATE users SET balance_cents = balance_cents + ?, updated_at = ? WHERE id = ?')
    .run(amountCents, now(), userId);
  if (result.changes !== 1) throw new Error('Usuario no encontrado.');
  const balance = num((db().prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as Row).balance_cents);
  insertWalletTx(userId, amountCents, type, description, balance, refs);
  return balance;
}

export function listWallet(userId: string, limit = 60): WalletTx[] {
  const rows = db()
    .prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit) as Row[];
  return rows.map((row) => ({
    id: str(row.id),
    userId: str(row.user_id),
    amountCents: num(row.amount_cents),
    type: str(row.type),
    description: str(row.description),
    orderId: (row.order_id as string | null) ?? null,
    topupId: (row.topup_id as string | null) ?? null,
    balanceAfter: num(row.balance_after),
    createdAt: str(row.created_at),
  }));
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                            */
/* ------------------------------------------------------------------ */

function orderCode(): string {
  return `NV-${id().slice(0, 6).toUpperCase()}`;
}

function parseCustomerData(value: unknown): OrderCustomerData | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OrderCustomerData>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      playerId: typeof parsed.playerId === 'string' ? parsed.playerId : '',
      details: typeof parsed.details === 'string' ? parsed.details : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return null;
  }
}

function serializeCustomerData(data?: { playerId?: string; details?: string }): string | null {
  const playerId = data?.playerId?.trim().slice(0, 120) || '';
  const details = data?.details?.trim().slice(0, 600) || '';
  if (!playerId && !details) return null;
  return JSON.stringify({ playerId, details, updatedAt: now() } satisfies OrderCustomerData);
}

function mapOrder(row: Row): Order {
  return {
    id: str(row.id),
    code: str(row.code),
    userId: str(row.user_id),
    subtotalCents: num(row.subtotal_cents),
    totalCents: num(row.total_cents),
    status: str(row.status, 'PENDING') as OrderStatus,
    paymentMethod: str(row.payment_method, 'BALANCE') as PaymentMethod,
    paymentStatus: str(row.payment_status, 'PENDING') as Order['paymentStatus'],
    reference: (row.reference as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    customerData: parseCustomerData(row.customer_data),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    itemsCount: num(row.items_count),
    userName: row.user_name ? str(row.user_name) : undefined,
    userEmail: row.user_email ? str(row.user_email) : undefined,
  };
}

export function checkout(
  userId: string,
  input: {
    paymentMethod: PaymentMethod;
    note?: string;
    reference?: string;
    customerData?: { playerId?: string; details?: string };
  }
): { ok: true; orderId: string; code: string } | { ok: false; error: string } {
  const settings = getSettings();
  const user = getUserById(userId);
  if (!user) return { ok: false, error: 'Debes iniciar sesión para comprar.' };
  if (settings.maintenance && user.role !== 'ADMIN') {
    return { ok: false, error: 'La tienda está en mantenimiento. Intenta más tarde.' };
  }
  if (input.paymentMethod !== 'BALANCE' && input.paymentMethod !== 'AGORA') {
    return { ok: false, error: 'Método de pago inválido.' };
  }

  let result: { ok: true; orderId: string; code: string } | { ok: false; error: string } = {
    ok: false,
    error: 'No se pudo completar la compra.',
  };

  const tx = db().transaction(() => {
    const lines = getCart(userId);
    if (lines.length === 0) {
      result = { ok: false, error: 'Tu carrito está vacío.' };
      return;
    }

    for (const line of lines) {
      const fresh = getProduct(line.productId);
      if (!fresh || !fresh.active) {
        result = { ok: false, error: `El producto "${line.name}" ya no está disponible.` };
        return;
      }
      if (!fresh.unlimitedStock && fresh.stock < line.quantity) {
        result = { ok: false, error: `Stock insuficiente para "${line.name}". Disponible: ${fresh.stock}.` };
        return;
      }
    }

    const subtotal = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
    if (subtotal <= 0) {
      result = { ok: false, error: 'El total del pedido no es válido.' };
      return;
    }

    const currentUser = db().prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as Row;
    const balance = num(currentUser.balance_cents);

    if (input.paymentMethod === 'BALANCE' && balance < subtotal) {
      result = {
        ok: false,
        error: 'Saldo insuficiente. Puedes pagar aparte con Agora o recargar tu saldo.',
      };
      return;
    }

    const orderId = id('ord_');
    let code = orderCode();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const exists = db().prepare('SELECT id FROM orders WHERE code = ?').get(code);
      if (!exists) break;
      code = orderCode();
    }

    const stamp = now();
    db()
      .prepare(
        `INSERT INTO orders (id, code, user_id, subtotal_cents, total_cents, status, payment_method, payment_status, reference, note, customer_data, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        orderId,
        code,
        userId,
        subtotal,
        subtotal,
        'PENDING',
        input.paymentMethod,
        input.paymentMethod === 'BALANCE' ? 'PAID' : 'PENDING',
        input.reference?.trim() || null,
        input.note?.trim().slice(0, 400) || null,
        serializeCustomerData(input.customerData),
        stamp,
        stamp
      );

    const itemStmt = db().prepare(
      'INSERT INTO order_items (id, order_id, product_id, name, price_cents, quantity) VALUES (?,?,?,?,?,?)'
    );
    const stockStmt = db().prepare(
      'UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?'
    );

    for (const line of lines) {
      // Los productos con stock ilimitado nunca descuentan unidades.
      if (!line.unlimitedStock) {
        const stockResult = stockStmt.run(line.quantity, stamp, line.productId, line.quantity);
        if (stockResult.changes !== 1) throw new Error(`No hay stock suficiente de "${line.name}".`);
      }
      itemStmt.run(id('oi_'), orderId, line.productId, line.name, line.priceCents, line.quantity);
    }

    if (input.paymentMethod === 'BALANCE') {
      const debit = db()
        .prepare('UPDATE users SET balance_cents = balance_cents - ?, updated_at = ? WHERE id = ? AND balance_cents >= ?')
        .run(subtotal, stamp, userId, subtotal);
      if (debit.changes !== 1) throw new Error('Saldo insuficiente.');
      const newBalance = num(
        (db().prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as Row).balance_cents
      );
      insertWalletTx(userId, -subtotal, 'PURCHASE', `Compra ${code}`, newBalance, { orderId });
    }

    db().prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);

    notifyInTx(
      'ORDER',
      'Nuevo pedido recibido',
      `${user.name} realizó el pedido ${code} por ${(subtotal / 100).toFixed(2)} (${input.paymentMethod === 'BALANCE' ? 'saldo' : 'Agora'}).`,
      '/admin/pedidos'
    );

    result = { ok: true, orderId, code };
  });

  try {
    tx.immediate();
    try {
      ensureConversation(userId);
    } catch {
      // Si falla aquí, la conversación se crea al abrir el chat.
    }
    return result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo completar la compra.' };
  }
}

export function listOrders(userId: string): Order[] {
  const rows = db()
    .prepare(
      `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
       FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC`
    )
    .all(userId) as Row[];
  return rows.map(mapOrder);
}

export function listAllOrders(status?: OrderStatus): Order[] {
  const rows = status
    ? (db()
        .prepare(
          `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
             (SELECT name FROM users u WHERE u.id = o.user_id) AS user_name,
             (SELECT email FROM users u WHERE u.id = o.user_id) AS user_email
           FROM orders o WHERE o.status = ? ORDER BY o.created_at DESC`
        )
        .all(status) as Row[])
    : (db()
        .prepare(
          `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
             (SELECT name FROM users u WHERE u.id = o.user_id) AS user_name,
             (SELECT email FROM users u WHERE u.id = o.user_id) AS user_email
           FROM orders o ORDER BY o.created_at DESC`
        )
        .all() as Row[]);
  return rows.map(mapOrder);
}

export function getOrder(orderId: string, userId?: string): Order | null {
  const row = db()
    .prepare(
      `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
         (SELECT name FROM users u WHERE u.id = o.user_id) AS user_name,
         (SELECT email FROM users u WHERE u.id = o.user_id) AS user_email
       FROM orders o WHERE o.id = ?`
    )
    .get(orderId) as Row | undefined;
  if (!row) return null;
  if (userId && str(row.user_id) !== userId) return null;
  const order = mapOrder(row);
  const items = db().prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC').all(orderId) as Row[];
  order.items = items.map(
    (item): OrderItem => ({
      id: str(item.id),
      productId: (item.product_id as string | null) ?? null,
      name: str(item.name),
      priceCents: num(item.price_cents),
      quantity: num(item.quantity),
    })
  );
  return order;
}

const STATUS_ORDER: Record<string, number> = { PENDING: 0, APPROVED: 1, SENT: 2, COMPLETED: 3 };

export function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus
): { ok: boolean; error?: string } {
  const tx = db().transaction(() => {
    const row = db().prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Row | undefined;
    if (!row) return { ok: false, error: 'Pedido no encontrado.' };
    const current = str(row.status) as OrderStatus;
    if (current === nextStatus) return { ok: true };

    if (nextStatus === 'CANCELLED') {
      if (current === 'COMPLETED') return { ok: false, error: 'Un pedido completado no se puede cancelar.' };
      db().prepare("UPDATE orders SET status = 'CANCELLED', updated_at = ? WHERE id = ?").run(now(), orderId);
      if (str(row.payment_status) === 'PAID' && str(row.payment_method) === 'BALANCE') {
        const alreadyRefunded = db()
          .prepare("SELECT id FROM wallet_transactions WHERE order_id = ? AND type = 'REFUND'")
          .get(orderId);
        if (!alreadyRefunded) {
          creditWalletInTx(
            str(row.user_id),
            num(row.total_cents),
            'REFUND',
            `Reembolso del pedido ${str(row.code)}`,
            { orderId }
          );
          db().prepare("UPDATE orders SET payment_status = 'REFUNDED' WHERE id = ?").run(orderId);
        }
      }
      const items = db().prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId) as Row[];
      for (const item of items) {
        if (item.product_id) {
          db()
            .prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND unlimited_stock = 0')
            .run(num(item.quantity), now(), str(item.product_id));
        }
      }
      return { ok: true };
    }

    if (!(nextStatus in STATUS_ORDER)) return { ok: false, error: 'Estado inválido.' };
    if (STATUS_ORDER[nextStatus] <= STATUS_ORDER[current]) {
      return { ok: false, error: 'El pedido no puede retroceder de estado.' };
    }
    if (nextStatus === 'APPROVED') {
      db().prepare("UPDATE orders SET status = 'APPROVED', updated_at = ? WHERE id = ?").run(now(), orderId);
      if (str(row.payment_method) === 'AGORA' && str(row.payment_status) === 'PENDING') {
        db().prepare("UPDATE orders SET payment_status = 'PAID' WHERE id = ?").run(orderId);
      }
      return { ok: true };
    }
    if (nextStatus === 'SENT') {
      if (str(row.payment_status) !== 'PAID') {
        return { ok: false, error: 'Primero debes confirmar el pago del pedido.' };
      }
      db().prepare("UPDATE orders SET status = 'SENT', updated_at = ? WHERE id = ?").run(now(), orderId);
      return { ok: true };
    }
    if (nextStatus === 'COMPLETED') {
      db().prepare("UPDATE orders SET status = 'COMPLETED', updated_at = ? WHERE id = ?").run(now(), orderId);
      return { ok: true };
    }
    return { ok: false, error: 'Estado inválido.' };
  });

  try {
    return tx.immediate();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo actualizar el pedido.' };
  }
}

/* ------------------------------------------------------------------ */
/* Recargas (Agora)                                                   */
/* ------------------------------------------------------------------ */

function mapTopup(row: Row): Topup {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    amountCents: num(row.amount_cents),
    method: str(row.method, 'AGORA'),
    reference: (row.reference as string | null) ?? null,
    receiptId: (row.receipt_id as string | null) ?? null,
    status: str(row.status, 'PENDING') as TopupStatus,
    adminNote: (row.admin_note as string | null) ?? null,
    createdAt: str(row.created_at),
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    userName: row.user_name ? str(row.user_name) : undefined,
    userEmail: row.user_email ? str(row.user_email) : undefined,
  };
}

export function createTopup(
  userId: string,
  input: { amountCents: number; reference?: string; receiptId?: string | null }
): { ok: true; id: string } | { ok: false; error: string } {
  if (!Number.isFinite(input.amountCents) || input.amountCents < 100) {
    return { ok: false, error: 'El monto mínimo de recarga es de 1,00.' };
  }
  if (input.amountCents > 100000000) return { ok: false, error: 'El monto excede el límite permitido.' };
  const user = getUserById(userId);
  if (!user) return { ok: false, error: 'Debes iniciar sesión.' };
  const topupId = id('top_');
  db()
    .prepare(
      `INSERT INTO topups (id, user_id, amount_cents, method, reference, receipt_id, status, created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      topupId,
      userId,
      input.amountCents,
      'AGORA',
      input.reference?.trim().slice(0, 120) || null,
      input.receiptId || null,
      'PENDING',
      now()
    );
  notify(
    'TOPUP',
    'Nueva recarga pendiente',
    `${user.name} solicitó una recarga de ${(input.amountCents / 100).toFixed(2)} por Agora.`,
    '/admin/recargas'
  );
  return { ok: true, id: topupId };
}

export function listTopups(userId: string): Topup[] {
  const rows = db()
    .prepare('SELECT * FROM topups WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Row[];
  return rows.map(mapTopup);
}

export function listAllTopups(status?: TopupStatus): Topup[] {
  const rows = status
    ? (db()
        .prepare(
          `SELECT t.*, (SELECT name FROM users u WHERE u.id = t.user_id) AS user_name,
             (SELECT email FROM users u WHERE u.id = t.user_id) AS user_email
           FROM topups t WHERE t.status = ? ORDER BY t.created_at DESC`
        )
        .all(status) as Row[])
    : (db()
        .prepare(
          `SELECT t.*, (SELECT name FROM users u WHERE u.id = t.user_id) AS user_name,
             (SELECT email FROM users u WHERE u.id = t.user_id) AS user_email
           FROM topups t ORDER BY t.created_at DESC`
        )
        .all() as Row[]);
  return rows.map(mapTopup);
}

export function reviewTopup(
  topupId: string,
  decision: 'APPROVED' | 'REJECTED',
  adminNote: string,
  adminId: string
): { ok: boolean; error?: string } {
  const tx = db().transaction(() => {
    const row = db().prepare('SELECT * FROM topups WHERE id = ?').get(topupId) as Row | undefined;
    if (!row) return { ok: false, error: 'Recarga no encontrada.' };
    if (str(row.status) !== 'PENDING') return { ok: false, error: 'Esta recarga ya fue procesada.' };

    const update = db()
      .prepare("UPDATE topups SET status = ?, admin_note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ? AND status = 'PENDING'")
      .run(decision, adminNote.trim().slice(0, 300) || null, now(), adminId, topupId);
    if (update.changes !== 1) return { ok: false, error: 'Esta recarga ya fue procesada.' };

    if (decision === 'APPROVED') {
      const amount = num(row.amount_cents);
      creditWalletInTx(str(row.user_id), amount, 'TOPUP', 'Recarga aprobada por Agora', { topupId });
    }
    return { ok: true };
  });

  try {
    return tx.immediate();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo procesar la recarga.' };
  }
}

/* ------------------------------------------------------------------ */
/* Notificaciones y solicitudes                                       */
/* ------------------------------------------------------------------ */

function notifyInTx(type: string, title: string, message: string, link?: string): void {
  db()
    .prepare('INSERT INTO notifications (id, type, title, message, link, read, created_at) VALUES (?,?,?,?,?,0,?)')
    .run(id('ntf_'), type, title, message, link || null, now());
}

export function notify(type: string, title: string, message: string, link?: string): void {
  notifyInTx(type, title, message, link);
}

export function listNotifications(limit = 40): NotificationItem[] {
  const rows = db()
    .prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Row[];
  return rows.map((row) => ({
    id: str(row.id),
    type: str(row.type),
    title: str(row.title),
    message: str(row.message),
    link: (row.link as string | null) ?? null,
    read: num(row.read) === 1,
    createdAt: str(row.created_at),
  }));
}

export function unreadNotifications(): number {
  return num((db().prepare('SELECT COUNT(*) AS c FROM notifications WHERE read = 0').get() as Row).c);
}

export function markNotificationsRead(): void {
  db().prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
}

export function createProductRequest(
  userId: string,
  input: { productId?: string | null; productName: string; message?: string }
): { ok: boolean; error?: string } {
  const name = input.productName.trim();
  if (name.length < 2) return { ok: false, error: 'Indica qué producto necesitas.' };
  const user = getUserById(userId);
  if (!user) return { ok: false, error: 'Debes iniciar sesión.' };
  db()
    .prepare(
      'INSERT INTO product_requests (id, user_id, product_id, product_name, message, status, created_at) VALUES (?,?,?,?,?,?,?)'
    )
    .run(
      id('req_'),
      userId,
      input.productId || null,
      name.slice(0, 140),
      input.message?.trim().slice(0, 400) || null,
      'OPEN',
      now()
    );
  notify(
    'REQUEST',
    'Un cliente quiere un producto',
    `${user.name} (${user.email}) solicitó: ${name}.`,
    '/admin/solicitudes'
  );
  return { ok: true };
}

export function listProductRequests(): ProductRequest[] {
  const rows = db()
    .prepare(
      `SELECT r.*, (SELECT name FROM users u WHERE u.id = r.user_id) AS user_name,
         (SELECT email FROM users u WHERE u.id = r.user_id) AS user_email
       FROM product_requests r ORDER BY r.created_at DESC`
    )
    .all() as Row[];
  return rows.map((row) => ({
    id: str(row.id),
    userId: str(row.user_id),
    productId: (row.product_id as string | null) ?? null,
    productName: str(row.product_name),
    message: (row.message as string | null) ?? null,
    status: str(row.status, 'OPEN') === 'DONE' ? 'DONE' : 'OPEN',
    createdAt: str(row.created_at),
    userName: row.user_name ? str(row.user_name) : undefined,
    userEmail: row.user_email ? str(row.user_email) : undefined,
  }));
}

export function resolveProductRequest(requestId: string): void {
  db().prepare("UPDATE product_requests SET status = 'DONE' WHERE id = ?").run(requestId);
}

/* ------------------------------------------------------------------ */
/* Archivos (imágenes y comprobantes)                                 */
/* ------------------------------------------------------------------ */

export function saveUpload(mime: string, data: Buffer): string {
  const uploadId = id('upl_');
  db()
    .prepare('INSERT INTO uploads (id, mime, size, data, created_at) VALUES (?,?,?,?,?)')
    .run(uploadId, mime, data.length, data, now());
  return uploadId;
}

export function getUpload(uploadId: string): { mime: string; data: Buffer } | null {
  const row = db().prepare('SELECT mime, data FROM uploads WHERE id = ?').get(uploadId) as
    | { mime: string; data: Buffer }
    | undefined;
  if (!row) return null;
  return { mime: row.mime, data: Buffer.from(row.data) };
}

/* ------------------------------------------------------------------ */
/* Estadísticas                                                       */
/* ------------------------------------------------------------------ */

export function adminStats(): AdminStats {
  const one = (sql: string): number => num((db().prepare(sql).get() as Row).c);
  return {
    users: one('SELECT COUNT(*) AS c FROM users'),
    products: one('SELECT COUNT(*) AS c FROM products'),
    lowStock: one('SELECT COUNT(*) AS c FROM products WHERE active = 1 AND unlimited_stock = 0 AND stock <= 3'),
    pendingOrders: one("SELECT COUNT(*) AS c FROM orders WHERE status = 'PENDING'"),
    pendingTopups: one("SELECT COUNT(*) AS c FROM topups WHERE status = 'PENDING'"),
    openRequests: one("SELECT COUNT(*) AS c FROM product_requests WHERE status = 'OPEN'"),
    revenueCents: one("SELECT COALESCE(SUM(total_cents), 0) AS c FROM orders WHERE status != 'CANCELLED'"),
    walletTotalCents: one('SELECT COALESCE(SUM(balance_cents), 0) AS c FROM users'),
  };
}

/** El cliente completa o corrige los datos de entrega de su pedido. */
export function saveOrderCustomerData(
  orderId: string,
  userId: string,
  data: { playerId?: string; details?: string }
): { ok: boolean; error?: string } {
  const order = db().prepare('SELECT id, user_id FROM orders WHERE id = ?').get(orderId) as Row | undefined;
  if (!order) return { ok: false, error: 'El pedido no existe.' };
  if (str(order.user_id) !== userId) return { ok: false, error: 'No puedes modificar este pedido.' };
  db()
    .prepare('UPDATE orders SET customer_data = ?, updated_at = ? WHERE id = ?')
    .run(serializeCustomerData(data), now(), orderId);
  return { ok: true };
}
