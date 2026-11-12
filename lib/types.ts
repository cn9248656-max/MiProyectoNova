/** Tipos puros compartidos entre servidor y cliente (sin dependencias de Node). */

export type ActionState = { error?: string; success?: string } | null;

export type Role = 'USER' | 'ADMIN';
export type OrderStatus = 'PENDING' | 'APPROVED' | 'SENT' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'BALANCE' | 'AGORA';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';
export type TopupStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  balanceCents: number;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  imageId: string | null;
  stock: number;
  /** Si es true, el producto se vende sin límite y no se descuenta stock. */
  unlimitedStock: boolean;
  active: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartLine {
  id: string;
  productId: string;
  quantity: number;
  name: string;
  priceCents: number;
  stock: number;
  unlimitedStock: boolean;
  imageId: string | null;
  categoryName: string;
  /** 'UNIT' = precio por unidad · 'PER_K' = precio por cada 1000 unidades */
  priceMode?: 'UNIT' | 'PER_K';
  offerCents?: number;
  offerEndsAt?: string | null;
  providerServiceId?: string | null;
  /** Total de la línea ya calculado (por unidad o por 1000). */
  lineTotalCents?: number;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  priceCents: number;
  quantity: number;
}

export interface Order {
  id: string;
  code: string;
  userId: string;
  subtotalCents: number;
  totalCents: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  reference: string | null;
  note: string | null;
  customerData: OrderCustomerData | null;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
  userName?: string;
  userEmail?: string;
  items?: OrderItem[];
}

export interface Topup {
  id: string;
  userId: string;
  amountCents: number;
  method: string;
  reference: string | null;
  receiptId: string | null;
  status: TopupStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  userName?: string;
  userEmail?: string;
}

export interface WalletTx {
  id: string;
  userId: string;
  amountCents: number;
  type: string;
  description: string;
  orderId: string | null;
  topupId: string | null;
  balanceAfter: number;
  createdAt: string;
}

/** Datos que el cliente entrega para recibir su producto (ID de Free Fire, etc.). */
export interface OrderCustomerData {
  playerId: string;
  details: string;
  /** Enlace o usuario de destino para servicios de proveedor (SMM). */
  link?: string;
  updatedAt: string;
}

export type ChatSenderRole = 'USER' | 'ADMIN';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderRole: ChatSenderRole;
  senderName: string;
  body: string;
  readByUser: boolean;
  readByAdmin: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessage: string | null;
  unreadForAdmin: number;
  unreadForUser: number;
  messageCount: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface ProductRequest {
  id: string;
  userId: string;
  productId: string | null;
  productName: string;
  message: string | null;
  status: 'OPEN' | 'DONE';
  createdAt: string;
  userName?: string;
  userEmail?: string;
}

export interface StoreSettings {
  storeName: string;
  currency: string;
  agoraAlias: string;
  agoraPhone: string;
  agoraHolder: string;
  agoraNote: string;
  maintenance: boolean;
  maintenanceMessage: string;
}

export interface AdminUser extends PublicUser {
  orderCount: number;
  totalSpentCents: number;
}

export interface AdminStats {
  users: number;
  products: number;
  lowStock: number;
  pendingOrders: number;
  pendingTopups: number;
  openRequests: number;
  revenueCents: number;
  walletTotalCents: number;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  SENT: 'Enviado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export const TOPUP_STATUS_LABEL: Record<TopupStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = ['PENDING', 'APPROVED', 'SENT', 'COMPLETED'];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  BALANCE: 'Saldo NovaStore',
  AGORA: 'Agora (pago aparte)',
};

/* ------------------------------------------------------------------ */
/* Soporte al cliente                                                 */
/* ------------------------------------------------------------------ */

export type SupportStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
export type SupportCategory = 'QUESTION' | 'ORDER' | 'PAYMENT' | 'BUG' | 'CLAIM' | 'OTHER';

/** Una solicitud de soporte es un ticket privado con su propio hilo de chat. */
export interface SupportTicket {
  id: string;
  code: string;
  userId: string;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessage: string | null;
  messageCount: number;
  unreadForUser: number;
  unreadForAdmin: number;
  userName?: string;
  userEmail?: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderRole: ChatSenderRole;
  senderName: string;
  body: string;
  readByUser: boolean;
  readByAdmin: boolean;
  createdAt: string;
}

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  RESOLVED: 'Resuelto',
};

/** Clases de color ya existentes en la tienda, reutilizadas para los estados. */
export const SUPPORT_STATUS_CLASS: Record<SupportStatus, string> = {
  PENDING: 'status status--pending',
  IN_PROGRESS: 'status status--sent',
  RESOLVED: 'status status--completed',
};

export const SUPPORT_STATUS_ORDER: SupportStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  QUESTION: 'Consulta',
  ORDER: 'Pedido',
  PAYMENT: 'Pago o saldo',
  BUG: 'Problema técnico',
  CLAIM: 'Reclamo',
  OTHER: 'Otro',
};

export const SUPPORT_CATEGORY_OPTIONS: SupportCategory[] = [
  'QUESTION',
  'ORDER',
  'PAYMENT',
  'BUG',
  'CLAIM',
  'OTHER',
];
