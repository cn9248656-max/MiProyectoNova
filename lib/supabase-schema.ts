/**
 * Mapa exacto de las tablas que se replican en Supabase.
 *
 * Cada entrada declara la clave primaria y las columnas que viajan en el JSON.
 * Las columnas marcadas con `hex` se envían como texto hexadecimal y vuelven a
 * ser binario al restaurar (imágenes y comprobantes).
 *
 * Debe coincidir con supabase/persistencia.sql.
 */

export interface SyncColumn {
  name: string;
  hex?: boolean;
}

export interface SyncTableSpec {
  pk: string;
  columns: SyncColumn[];
}

const cols = (...names: string[]): SyncColumn[] => names.map((name) => ({ name }));

export const SYNC_TABLES: Record<string, SyncTableSpec> = {
  users: {
    pk: 'id',
    columns: cols(
      'id',
      'email',
      'password_hash',
      'name',
      'phone',
      'role',
      'balance_cents',
      'created_at',
      'updated_at'
    ),
  },
  categories: {
    pk: 'id',
    columns: cols('id', 'name', 'slug', 'icon', 'position', 'created_at'),
  },
  uploads: {
    pk: 'id',
    columns: [
      { name: 'id' },
      { name: 'mime' },
      { name: 'size' },
      { name: 'data', hex: true },
      { name: 'created_at' },
    ],
  },
  products: {
    pk: 'id',
    columns: cols(
      'id',
      'name',
      'description',
      'price_cents',
      'category_id',
      'image_id',
      'stock',
      'unlimited_stock',
      'active',
      'featured',
      'created_at',
      'updated_at'
    ),
  },
  cart_items: {
    pk: 'id',
    columns: cols('id', 'user_id', 'product_id', 'quantity', 'created_at'),
  },
  orders: {
    pk: 'id',
    columns: cols(
      'id',
      'code',
      'user_id',
      'subtotal_cents',
      'total_cents',
      'status',
      'payment_method',
      'payment_status',
      'reference',
      'note',
      'customer_data',
      'created_at',
      'updated_at'
    ),
  },
  order_items: {
    pk: 'id',
    columns: cols('id', 'order_id', 'product_id', 'name', 'price_cents', 'quantity'),
  },
  topups: {
    pk: 'id',
    columns: cols(
      'id',
      'user_id',
      'amount_cents',
      'method',
      'reference',
      'receipt_id',
      'status',
      'admin_note',
      'created_at',
      'reviewed_at',
      'reviewed_by'
    ),
  },
  wallet_transactions: {
    pk: 'id',
    columns: cols(
      'id',
      'user_id',
      'amount_cents',
      'type',
      'description',
      'order_id',
      'topup_id',
      'balance_after',
      'created_at'
    ),
  },
  settings: {
    pk: 'key',
    columns: cols('key', 'value'),
  },
  product_requests: {
    pk: 'id',
    columns: cols('id', 'user_id', 'product_id', 'product_name', 'message', 'status', 'created_at'),
  },
  notifications: {
    pk: 'id',
    columns: cols('id', 'type', 'title', 'message', 'link', 'read', 'created_at'),
  },
  conversations: {
    pk: 'id',
    columns: cols('id', 'user_id', 'created_at', 'updated_at', 'last_message_at'),
  },
  messages: {
    pk: 'id',
    columns: cols(
      'id',
      'conversation_id',
      'sender_role',
      'sender_id',
      'body',
      'read_by_user',
      'read_by_admin',
      'created_at'
    ),
  },
  support_tickets: {
    pk: 'id',
    columns: cols(
      'id',
      'code',
      'user_id',
      'subject',
      'category',
      'status',
      'created_at',
      'updated_at',
      'last_message_at'
    ),
  },
  support_messages: {
    pk: 'id',
    columns: cols(
      'id',
      'ticket_id',
      'sender_role',
      'sender_id',
      'body',
      'read_by_user',
      'read_by_admin',
      'created_at'
    ),
  },
};

/** Orden de envío: primero las tablas de las que dependen las demás. */
export const SYNC_ORDER: string[] = [
  'categories',
  'uploads',
  'products',
  'users',
  'settings',
  'cart_items',
  'orders',
  'order_items',
  'topups',
  'wallet_transactions',
  'product_requests',
  'notifications',
  'conversations',
  'messages',
  'support_tickets',
  'support_messages',
];

export const SYNC_TABLE_NAMES = Object.keys(SYNC_TABLES);
