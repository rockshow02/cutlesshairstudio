/**
 * Keranjang di localStorage (per perangkat): hanya cabang + id varian + jumlah. Nama, harga, dan stok selalu dihitung
 * ulang server lewat POST /api/shop/quote. Sinkron antar tab (event storage) dan antar komponen (event lokal).
 */
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import type { Quote, ShopConfig, ShopProduct } from './types';

export interface CartItem {
  variantId: number;
  qty: number;
}
export interface Cart {
  branchId: number | null;
  items: CartItem[];
}

const KEY = 'cutless_cart_v1';
const EVENT = 'cutless-cart';
export const MAX_QTY = 20;

function read(): Cart {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cart | null;
    if (v && Array.isArray(v.items)) return { branchId: typeof v.branchId === 'number' ? v.branchId : null, items: v.items.filter((i) => Number.isInteger(i.variantId) && i.qty > 0) };
  } catch {
    /* penyimpanan diblokir / rusak → keranjang kosong */
  }
  return { branchId: null, items: [] };
}

function write(cart: Cart) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cart));
  } catch {
    /* mode privat: keranjang hanya bertahan di halaman ini */
  }
  memory = cart;
  window.dispatchEvent(new Event(EVENT));
}

let memory: Cart | null = null;
const current = () => memory ?? (memory = read());

export function useCart() {
  const [cart, setCart] = useState<Cart>(current);
  useEffect(() => {
    const sync = () => setCart(current());
    const fromOtherTab = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      memory = read();
      sync();
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', fromOtherTab);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', fromOtherTab);
    };
  }, []);

  const setQty = useCallback((variantId: number, qty: number) => {
    const c = current();
    const items = qty > 0 ? (c.items.some((i) => i.variantId === variantId) ? c.items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(MAX_QTY, qty) } : i)) : [...c.items, { variantId, qty: Math.min(MAX_QTY, qty) }]) : c.items.filter((i) => i.variantId !== variantId);
    write({ ...c, items });
  }, []);
  const add = useCallback((variantId: number, qty = 1) => {
    const have = current().items.find((i) => i.variantId === variantId)?.qty ?? 0;
    setQty(variantId, have + qty);
  }, [setQty]);
  const setBranch = useCallback((branchId: number) => write({ ...current(), branchId }), []);
  const clear = useCallback(() => write({ branchId: current().branchId, items: [] }), []);

  return { cart, count: cart.items.reduce((n, i) => n + i.qty, 0), add, setQty, setBranch, clear };
}

/** Konfigurasi toko (sekali per halaman) */
let configPromise: Promise<ShopConfig> | null = null;
export function useShopConfig() {
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    configPromise ??= api<ShopConfig>('/shop/config');
    configPromise.then(setConfig).catch((e: Error) => {
      configPromise = null;
      setError(e.message);
    });
  }, []);
  return { config, error };
}

/** Cabang aktif keranjang: pilihan tersimpan, atau cabang pertama yang menerima pesanan */
export function activeBranchId(config: ShopConfig | null, cart: Cart): number | null {
  if (!config?.enabled) return null;
  const open = config.branches.filter((b) => b.status === 'active');
  return open.find((b) => b.id === cart.branchId)?.id ?? open[0]?.id ?? null;
}

/** Hitung keranjang di server (harga, stok cabang, batas beli). Berubah bila cabang / isi keranjang berubah. */
export function useQuote(branchId: number | null, items: CartItem[], extra: { fulfillment?: string; regionId?: string | null } = {}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const key = JSON.stringify([branchId, items, extra.fulfillment, extra.regionId]);
  useEffect(() => {
    if (!branchId || !items.length) {
      setQuote(null);
      return;
    }
    let live = true;
    setError('');
    api<Quote>('/shop/quote', { method: 'POST', json: { branch: branchId, items, fulfillment: extra.fulfillment, regionId: extra.regionId ?? null } })
      .then((q) => live && setQuote(q))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
    // key = ringkasan semua masukan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { quote, error };
}

/** Stok tersedia untuk tampilan (varian aktif, cabang terpilih) */
export function availableIn(p: ShopProduct, branchId: number | null) {
  return p.variants.filter((v) => v.isActive).reduce((n, v) => n + (branchId ? (v.stock[String(branchId)] ?? 0) : 0), 0);
}

export const notReleased = (p: Pick<ShopProduct, 'releaseAt'>) => Boolean(p.releaseAt && Date.parse(p.releaseAt) > Date.now());
export const releaseLabel = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
