import { useState } from 'react';
import { api } from '@/app/api';
import { rupiah } from '@/app/format';
import { usePaged } from '@/app/usePaged';
import { asset } from '@/lib/asset';
import { Section } from '@/components/ui/Section';
import { Kicker } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, SkeletonList } from '@/components/ui/Feedback';
import { LoadMore } from '@/components/ui/LoadMore';
import { useToast } from '@/components/ui/toastContext';
import { activeBranchId, availableIn, notReleased, releaseLabel, useCart, useShopConfig } from '../cart';
import { CartSheet } from '../parts';
import type { ShopBranch, ShopConfig, ShopProduct } from '../types';
import productStyles from '@/components/sections/Products.module.css';
import styles from '../shop.module.css';

/** Kepala halaman toko + tombol keranjang (dipakai katalog & halaman produk) */
export function ShopFrame({ id, children, title, intro, kicker = 'Cutless Shop', branch }: { id: string; children: React.ReactNode; title?: string; intro?: string; kicker?: string; branch: ShopBranch | null }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <Section id={id} tone="dark" labelledBy={`${id}-title`} className={productStyles.page}>
      <div className={styles.head}>
        {title ? (
          <div className={styles.headText}>
            <Kicker>{kicker}</Kicker>
            <h1 id={`${id}-title`} className={productStyles.pageTitle}>
              {title}
            </h1>
            {intro && <p className={productStyles.pageIntro}>{intro}</p>}
          </div>
        ) : (
          <span />
        )}
        <span className={styles.cartBtn}>
          <Button variant="light" size="sm" icon="tag" onClick={() => setOpen(true)} aria-haspopup="dialog">
            Keranjang
            <span className={styles.count} aria-label={`${count} barang`}>
              {count}
            </span>
          </Button>
        </span>
      </div>
      {children}
      <CartSheet open={open} onClose={() => setOpen(false)} branch={branch} />
    </Section>
  );
}

/** Toko mati / gagal memuat konfigurasi */
export function ShopUnavailable({ error }: { error?: string }) {
  return (
    <Section id="toko" tone="dark" labelledBy="toko-title" className={productStyles.page}>
      <div className={productStyles.pageHead}>
        <Kicker>Cutless Shop</Kicker>
        <h1 id="toko-title" className={productStyles.pageTitle}>
          {error ? 'Toko tidak bisa dimuat.' : 'Toko segera dibuka.'}
        </h1>
        <p className={productStyles.pageIntro}>{error ?? 'Sementara itu, lihat produk kami dan pesan lewat WhatsApp cabang.'}</p>
      </div>
      <Button href="/produk/" variant="light" iconEnd="arrow">
        Lihat produk
      </Button>
    </Section>
  );
}

/** /shop: katalog per cabang + filter kategori */
export function Catalog() {
  const { config, error } = useShopConfig();
  if (error) return <ShopUnavailable error={error} />;
  if (!config) return <SkeletonList count={4} label="Memuat toko…" />;
  if (!config.enabled) return <ShopUnavailable />;
  return <CatalogBody config={config} />;
}

function CatalogBody({ config }: { config: Extract<ShopConfig, { enabled: true }> }) {
  const { cart, setBranch } = useCart();
  const branchId = activeBranchId(config, cart);
  const branch = config.branches.find((b) => b.id === branchId) ?? null;
  const [category, setCategory] = useState('');
  const page = usePaged<ShopProduct>(async (cursor) => {
    const q = new URLSearchParams({ limit: '20', ...(category ? { category } : {}), ...(cursor ? { cursor } : {}) });
    const r = await api<{ products: ShopProduct[]; nextCursor: string | null }>(`/shop/products?${q}`);
    return { items: r.products, nextCursor: r.nextCursor };
  }, [category]);
  const open = config.branches.filter((b) => b.status === 'active');

  return (
    <ShopFrame id="toko" title="Toko" intro="Produk styling & perawatan pilihan hairstylist kami. Ambil di cabang, saat booking, atau dikirim." branch={branch}>
      <div className={styles.filterRow}>
        {open.length > 1 && (
          <div>
            <p className={styles.filterLabel} id="cabang-label">
              Cabang
            </p>
            <div className={styles.chips} role="group" aria-labelledby="cabang-label">
              {open.map((b) => (
                <button key={b.id} type="button" className={productStyles.chip} aria-pressed={b.id === branchId} onClick={() => setBranch(b.id)}>
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {config.categories.length > 1 && (
          <div className={styles.chips} role="group" aria-label="Filter kategori produk">
            {['', ...config.categories].map((c) => (
              <button key={c || 'all'} type="button" className={productStyles.chip} aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c || 'Semua'}
              </button>
            ))}
          </div>
        )}
      </div>
      {page.error && <Alert tone="danger">{page.error}</Alert>}
      {!page.items ? (
        <SkeletonList count={4} label="Memuat produk…" height={220} />
      ) : page.items.length === 0 ? (
        <p className={productStyles.empty}>Belum ada produk di kategori ini.</p>
      ) : (
        <>
          <ul className={productStyles.grid}>
            {page.items.map((p) => (
              <li key={p.id}>
                <ProductTile product={p} branch={branch} />
              </li>
            ))}
          </ul>
          <LoadMore shown={page.items.length} hasMore={page.hasMore} loading={page.loadingMore} onLoad={page.loadMore} noun="produk" casing="upper" skeletonHeight={220} />
        </>
      )}
    </ShopFrame>
  );
}

function ProductTile({ product: p, branch }: { product: ShopProduct; branch: ShopBranch | null }) {
  const { add } = useCart();
  const toast = useToast();
  const stock = availableIn(p, branch?.id ?? null);
  const single = p.variants.length === 1 ? p.variants[0] : null;
  const drop = notReleased(p);
  const out = !drop && stock <= 0;
  const image = p.images[0];
  return (
    <Card className={`${productStyles.card} ${out ? productStyles.out : ''}`}>
      <a href={`/shop/${p.slug}`} className={productStyles.media} aria-label={p.name}>
        {image ? (
          <img className={productStyles.img} src={asset(image.path)} alt={image.alt ?? p.name} width={500} height={500} loading="lazy" />
        ) : (
          <div className={productStyles.placeholder} aria-hidden="true">
            <span>{p.category}</span>
          </div>
        )}
        {p.badge && <span className={`${productStyles.chipTag} ${productStyles.badge}`}>{p.badge}</span>}
        {drop ? <span className={`${productStyles.chipTag} ${productStyles.stock}`}>Segera</span> : out && <span className={`${productStyles.chipTag} ${productStyles.stock}`}>Stok habis</span>}
      </a>
      <div className={productStyles.body}>
        <p className={productStyles.meta}>
          {p.category}
          {single && ` · ${single.name}`}
        </p>
        <h2 className={productStyles.name}>
          <a href={`/shop/${p.slug}`}>{p.name}</a>
        </h2>
        <p className={productStyles.price}>
          {single?.compareAtPrice && <s>{rupiah(single.compareAtPrice)}</s>}
          <strong>
            {!single && 'Mulai '}
            {p.priceFrom !== null ? rupiah(p.priceFrom) : '-'}
          </strong>
        </p>
        <p className={styles.stockLine} data-low={stock > 0 && stock <= 3}>
          {drop ? `Rilis ${releaseLabel(p.releaseAt!)}` : out ? `Habis di ${branch?.name ?? 'cabang ini'}` : stock <= 3 ? `Sisa ${stock} di ${branch?.name}` : `Tersedia di ${branch?.name}`}
        </p>
        <CardFooter className={productStyles.foot}>
          {single && !drop && !out ? (
            <Button
              size="sm"
              block
              variant="light"
              icon="plus"
              onClick={() => {
                add(single.id);
                toast(`${p.name} masuk keranjang.`);
              }}
            >
              Tambah
              <span className="visually-hidden"> {p.name}</span>
            </Button>
          ) : (
            <Button href={`/shop/${p.slug}`} size="sm" block variant="ghost" iconEnd="arrow">
              {single ? 'Lihat' : 'Pilih varian'}
              <span className="visually-hidden"> {p.name}</span>
            </Button>
          )}
        </CardFooter>
      </div>
    </Card>
  );
}
