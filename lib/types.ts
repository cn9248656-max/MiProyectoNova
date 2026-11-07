/** Tipos puros compartidos entre servidor y cliente (sin dependencias de Node). */

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
  imageId: string | null;
  categoryName: string;
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
