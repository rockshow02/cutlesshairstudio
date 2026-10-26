const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID');

/** 75000 -> "Rp 75.000" */
export function formatRupiah(value: number): string {
  return rupiahFormatter.format(value);
}

/** Harga dengan awalan "mulai" bila perlu. */
export function formatPrice(value: number, from: boolean | undefined, fromLabel: string): string {
  const price = formatRupiah(value);
  return from ? `${fromLabel} ${price}` : price;
}

/**
 * Format ribuan "K" khusus Daftar Harga (tanpa "Rp", tanpa pemisah ribuan):
 * 100000 → "100K", 1500000 → "1500K", 12500 → "12,5K", 500 → "0,5K".
 */
export function formatThousandsK(value: number): string {
  const k = Math.round(value / 100) / 10;
  return `${Number.isInteger(k) ? k : k.toFixed(1).replace('.', ',')}K`;
}

/** Harga teks Partner Cuci Sepatu (sudah lolos SHOE_CARE_PRICE_PATTERN) → gaya Daftar Harga: "45k" → "45K", "70 - 120K" → "70–120K" */
export function formatPriceText(value: string): string {
  return value.replace(/\s+/g, '').replace(/-/g, '–').toUpperCase();
}

/** "6281234567890" → "0812-3456-7890" (nomor WhatsApp yang tampil di website) */
export function formatPhoneDisplay(number: string): string {
  const digits = number.replace(/\D/g, '');
  const local = digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
  return [local.slice(0, 4), local.slice(4, 8), local.slice(8)].filter(Boolean).join('-');
}

/** 5000 -> "5.000" */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** "10:00" -> "10.00" (penulisan jam gaya Indonesia) */
export function formatTime(value: string): string {
  return value.replace(':', '.');
}

const jakartaDate = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});

/** ISO (UTC) → "31 Oktober 2026 pukul 23.59 WIB" (selalu zona Asia/Jakarta) */
export function formatDateTimeWIB(iso: string): string {
  return `${jakartaDate.format(new Date(iso))} WIB`;
}
