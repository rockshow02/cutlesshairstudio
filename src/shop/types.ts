/** Bentuk respons API toko (worker/routes/shop.ts) */
import type { Tone } from '@/components/ui/status';

export type Fulfillment = 'pickup' | 'with_booking' | 'ship_manual' | 'ship_auto';
export type OrderStatus = 'awaiting_quote' | 'awaiting_payment' | 'reserved_booking' | 'paid' | 'ready' | 'shipped' | 'completed' | 'cancelled' | 'expired' | 'refunded';
export type OrderAction = 'quote' | 'paid' | 'ready' | 'ship' | 'complete' | 'cancel' | 'refund';

export interface ShopBranch {
  id: number;
  slug: string;
  name: string;
  city: string;
  status: string;
  whatsapp: string;
  fulfillment: Fulfillment[];
  payment: { transfer: boolean; qris: boolean; uniqueCode: boolean };
}

export type ShopConfig =
  | { enabled: false }
  | { enabled: true; branches: ShopBranch[]; categories: string[]; paymentWindowMin: number; pickupWindowDays: number; returnPolicy: string; stampMinSubtotal: number };

export interface ShopVariant {
  id: number;
  sku: string | null;
  name: string;
  options: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  weightGram: number;
  isActive: boolean;
  /** Tersedia per cabang (id cabang → jumlah) */
  stock: Record<string, number>;
}

export interface ShopProduct {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  notes: string | null;
  badge: string | null;
  isActive: boolean;
  sortOrder: number;
  releaseAt: string | null;
  perCustomerLimit: number | null;
  images: { id: number; path: string; alt: string | null }[];
  variants: ShopVariant[];
  priceFrom: number | null;
}

export interface QuoteLine {
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  available: number;
  image: string | null;
  error?: string;
}

export interface Rate {
  courier: string;
  courierName: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  weightGram: number;
  ok: boolean;
  rates: Rate[] | null;
}

export interface OrderItem {
  id: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  unit_price: number;
  qty: number;
  line_total: number;
  image: string | null;
}

export interface PaymentInfo {
  method: 'transfer' | 'qris' | 'cashier' | 'gateway';
  amount: number;
  uniqueCode: number;
  dueAt: string | null;
  bank: { name: string; accountNo: string; accountName: string | null } | null;
  qrisImage: string | null;
  note: string | null;
  whatsapp: string;
}

export interface Order {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string;
  fulfillment: Fulfillment;
  fulfillmentLabel: string;
  booking_id: string | null;
  subtotal: number;
  shipping_fee: number | null;
  unique_code: number;
  total: number;
  payment_method: PaymentInfo['method'];
  payment_due_at: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  address: string | null;
  region_label: string | null;
  courier: string | null;
  courier_service: string | null;
  tracking_no: string | null;
  customer_note: string | null;
  cancel_reason: string | null;
  ready_at: string | null;
  pickup_due_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  paid_at: string | null;
  created_at: string;
  branch: { id: number; slug: string; name: string; whatsapp: string; timezone: string };
  items: OrderItem[];
  payment: PaymentInfo | null;
  pickupOverdue: boolean;
  actions: OrderAction[];
}

/** Ringkas (daftar) */
export type OrderListItem = Pick<Order, 'id' | 'code' | 'status' | 'statusLabel' | 'fulfillment' | 'fulfillmentLabel' | 'total' | 'created_at' | 'payment_due_at' | 'booking_id' | 'items'> & { branch_id: number };

export const ORDER_TONE: Record<OrderStatus, Tone> = {
  awaiting_quote: 'warning',
  awaiting_payment: 'warning',
  reserved_booking: 'info',
  paid: 'info',
  ready: 'success',
  shipped: 'info',
  completed: 'success',
  cancelled: 'neutral',
  expired: 'neutral',
  refunded: 'danger',
};

export const FULFILLMENT_TEXT: Record<Fulfillment, { title: string; meta: string }> = {
  pickup: { title: 'Ambil di cabang', meta: 'Bayar transfer/QRIS, ambil saat siap' },
  with_booking: { title: 'Ambil saat booking', meta: 'Bayar di kasir saat datang' },
  ship_manual: { title: 'Dikirim', meta: 'Ongkir dikonfirmasi admin dulu' },
  ship_auto: { title: 'Dikirim', meta: 'Pilih kurir, ongkir langsung terhitung' },
};
