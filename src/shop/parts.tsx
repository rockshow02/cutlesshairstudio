/** Komponen kecil toko: penghitung jumlah, gambar produk, lembar keranjang. */
import { rupiah } from '@/app/format';
import { asset } from '@/lib/asset';
import { Button } from '@/components/ui/Button';
import { Alert, SkeletonList } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Overlay';
import { MAX_QTY, useCart, useQuote } from './cart';
import type { ShopBranch } from './types';
import styles from './shop.module.css';

export function Stepper({ value, onChange, min = 1, max = MAX_QTY, label, small }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string; small?: boolean }) {
  return (
    <div className={`${styles.stepper} ${small ? styles.stepperSm : ''}`} role="group" aria-label={`Jumlah ${label}`}>
      <button type="button" aria-label="Kurangi" onClick={() => onChange(value - 1)} disabled={value <= min}>
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Tambah" onClick={() => onChange(value + 1)} disabled={value >= Math.min(max, MAX_QTY)}>
        +
      </button>
    </div>
  );
}

/** Foto produk (media Pages CMS); tanpa foto → kotak polos */
export function Thumb({ path, className, size = 56 }: { path: string | null | undefined; className: string; size?: number }) {
  return path ? <img className={className} src={asset(path)} alt="" width={size} height={size} loading="lazy" /> : <span className={className} aria-hidden="true" />;
}

/** Lembar keranjang: isi dihitung server; tombol CHECKOUT ke /shop/checkout */
export function CartSheet({ open, onClose, branch }: { open: boolean; onClose: () => void; branch: ShopBranch | null }) {
  const { cart, setQty } = useCart();
  const { quote, error } = useQuote(open ? (branch?.id ?? null) : null, cart.items);
  const empty = cart.items.length === 0;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Keranjang"
      meta={branch ? `Cabang ${branch.name}` : undefined}
      footer={
        !empty && (
          <Button href="/shop/checkout" variant="dark" block size="lg" iconEnd="arrow" aria-disabled={!quote?.ok} onClick={(e) => !quote?.ok && e.preventDefault()}>
            Checkout
          </Button>
        )
      }
    >
      {empty ? (
        <p className={styles.lineMeta}>Keranjang masih kosong. Pilih produk dulu, ya.</p>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : !quote ? (
        <SkeletonList count={2} label="Menghitung keranjang…" />
      ) : (
        <>
          {!quote.ok && <Alert tone="warning">Ada produk yang perlu disesuaikan sebelum checkout.</Alert>}
          <ul className={styles.lines}>
            {quote.lines.map((l) => (
              <li key={l.variantId} className={styles.line}>
                <Thumb className={styles.lineImg} path={l.image} />
                <div className={styles.lineMain}>
                  <span className={styles.lineName}>{l.productName}</span>
                  <span className={styles.lineMeta}>
                    {l.variantName} · {rupiah(l.unitPrice)}
                  </span>
                  {l.error && <span className={styles.lineError}>{l.error}</span>}
                  <div className={styles.lineFoot}>
                    <Stepper small value={l.qty} max={Math.max(l.qty, l.available)} label={l.productName} onChange={(n) => setQty(l.variantId, n)} />
                    <button type="button" className={styles.remove} onClick={() => setQty(l.variantId, 0)}>
                      Hapus
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <dl className={styles.totals}>
            <div className={styles.grand}>
              <dt>Subtotal</dt>
              <dd>{rupiah(quote.subtotal)}</dd>
            </div>
          </dl>
          <p className={styles.lineMeta}>Ongkir & cara bayar dipilih saat checkout.</p>
        </>
      )}
    </Sheet>
  );
}
