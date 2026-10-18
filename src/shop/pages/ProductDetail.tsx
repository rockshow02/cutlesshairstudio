import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { rupiah } from '@/app/format';
import { asset } from '@/lib/asset';
import { Button } from '@/components/ui/Button';
import { Alert, SkeletonList } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/toastContext';
import { activeBranchId, notReleased, releaseLabel, useCart, useShopConfig } from '../cart';
import { Stepper } from '../parts';
import { ShopFrame, ShopUnavailable } from './Catalog';
import type { ShopConfig, ShopProduct } from '../types';
import productStyles from '@/components/sections/Products.module.css';
import styles from '../shop.module.css';

/** /shop/:slug */
export function ProductDetail({ slug }: { slug: string }) {
  const { config, error } = useShopConfig();
  if (error) return <ShopUnavailable error={error} />;
  if (!config) return <SkeletonList count={2} label="Memuat produk…" />;
  if (!config.enabled) return <ShopUnavailable />;
  return <DetailBody config={config} slug={slug} />;
}

function DetailBody({ config, slug }: { config: Extract<ShopConfig, { enabled: true }>; slug: string }) {
  const { cart, add, setBranch } = useCart();
  const toast = useToast();
  const branchId = activeBranchId(config, cart);
  const branch = config.branches.find((b) => b.id === branchId) ?? null;
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [error, setError] = useState('');
  const [variantId, setVariantId] = useState<number | null>(null);
  const [imageIdx, setImageIdx] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    api<{ product: ShopProduct }>(`/shop/products/${encodeURIComponent(slug)}`)
      .then((r) => {
        setProduct(r.product);
        document.title = `${r.product.name} · Cutless Shop`;
      })
      .catch((e) => setError(errorMessage(e)));
  }, [slug]);

  if (error) {
    return (
      <ShopFrame id="produk-toko" branch={branch}>
        <Alert tone="danger">{error}</Alert>
        <a href="/shop/" className={styles.back}>
          ← Kembali ke toko
        </a>
      </ShopFrame>
    );
  }
  if (!product) return <SkeletonList count={2} label="Memuat produk…" height={280} />;

  const variants = product.variants.filter((v) => v.isActive);
  const variant = variants.find((v) => v.id === variantId) ?? variants.find((v) => (v.stock[String(branchId)] ?? 0) > 0) ?? variants[0];
  const stock = variant && branchId ? (variant.stock[String(branchId)] ?? 0) : 0;
  const inCart = cart.items.find((i) => i.variantId === variant?.id)?.qty ?? 0;
  const drop = notReleased(product);
  const maxQty = Math.max(1, Math.min(stock - inCart, product.perCustomerLimit ?? Infinity));
  const canBuy = Boolean(variant) && !drop && stock - inCart > 0;
  const image = product.images[imageIdx] ?? product.images[0];
  const open = config.branches.filter((b) => b.status === 'active');

  return (
    <ShopFrame id="produk-toko" branch={branch}>
      <a href="/shop/" className={styles.back}>
        ← Semua produk
      </a>
      <div className={styles.detail}>
        <div className={styles.gallery}>
          <div className={styles.mainImg}>
            {image ? (
              <img src={asset(image.path)} alt={image.alt ?? product.name} width={900} height={900} />
            ) : (
              <div className={productStyles.placeholder} aria-hidden="true">
                <span>{product.category}</span>
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className={styles.thumbs}>
              {product.images.map((img, i) => (
                <button key={img.id} type="button" className={styles.thumb} aria-pressed={i === imageIdx} aria-label={`Foto ${i + 1}`} onClick={() => setImageIdx(i)}>
                  <img src={asset(img.path)} alt="" width={64} height={64} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.info}>
          <p className={productStyles.meta}>
            {product.category}
            {product.badge && ` · ${product.badge}`}
          </p>
          <h1 id="produk-toko-title" className={styles.title}>
            {product.name}
          </h1>
          {variant && (
            <p className={styles.bigPrice}>
              {variant.compareAtPrice && (
                <s>
                  <span className="visually-hidden">Harga normal </span>
                  {rupiah(variant.compareAtPrice)}
                </s>
              )}
              <strong>{rupiah(variant.price)}</strong>
            </p>
          )}
          {product.description && <p className={styles.prose}>{product.description}</p>}

          {variants.length > 1 && (
            <div>
              <p className={styles.optionLabel} id="varian-label">
                Varian
              </p>
              <div className={styles.chips} role="group" aria-labelledby="varian-label">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={productStyles.chip}
                    aria-pressed={v.id === variant?.id}
                    onClick={() => {
                      setVariantId(v.id);
                      setQty(1);
                    }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {open.length > 1 && (
            <div>
              <p className={styles.optionLabel} id="cabang-produk-label">
                Cabang
              </p>
              <div className={styles.chips} role="group" aria-labelledby="cabang-produk-label">
                {open.map((b) => (
                  <button key={b.id} type="button" className={productStyles.chip} aria-pressed={b.id === branchId} onClick={() => setBranch(b.id)}>
                    {b.name} · {variant ? (variant.stock[String(b.id)] ?? 0) : 0}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className={styles.stockLine} data-low={stock > 0 && stock <= 3} role="status">
            {drop ? `Rilis ${releaseLabel(product.releaseAt!)}. Belum bisa dipesan.` : stock <= 0 ? `Stok habis di ${branch?.name ?? 'cabang ini'}.` : `Stok di ${branch?.name}: ${stock}${inCart ? ` (${inCart} di keranjang)` : ''}`}
          </p>
          {product.perCustomerLimit && (
            <p className={styles.note}>
              <strong>Maks. {product.perCustomerLimit} per pelanggan.</strong> Dihitung dari semua pesananmu yang tidak dibatalkan.
            </p>
          )}

          <div className={styles.buyRow}>
            <Stepper value={Math.min(qty, maxQty)} max={maxQty} label={product.name} onChange={setQty} />
            <Button
              variant="light"
              size="lg"
              icon="plus"
              disabled={!canBuy}
              onClick={() => {
                if (!variant) return;
                add(variant.id, Math.min(qty, maxQty));
                setQty(1);
                toast(`${product.name} masuk keranjang.`);
              }}
            >
              Tambah ke keranjang
            </Button>
          </div>

          {product.notes && (
            <section className={styles.prose} aria-labelledby="catatan-produk">
              <h2 id="catatan-produk">Detail & cara pakai</h2>
              {product.notes}
            </section>
          )}
          <section className={styles.prose} aria-labelledby="kebijakan-retur">
            <h2 id="kebijakan-retur">
              <Icon name="info" size={14} /> Retur
            </h2>
            {config.returnPolicy}
          </section>
        </div>
      </div>
    </ShopFrame>
  );
}
