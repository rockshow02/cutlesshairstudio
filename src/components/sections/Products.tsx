import { useState } from 'react';
import { getProducts } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { formatRupiah } from '@/lib/format';
import { asset } from '@/lib/asset';
import { pageUrl } from '@/lib/navigation';
import { useBooking } from '@/lib/useBooking';
import type { Product, ProductCategory, ProductsContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle, Kicker } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './Products.module.css';

const TEASER_LIMIT = 4;

interface ProductsProps {
  /** teaser = section ringkas di halaman utama; page = halaman /produk/ lengkap */
  variant: 'teaser' | 'page';
}

export function Products({ variant }: ProductsProps) {
  const state = useContent(getProducts);
  const { site } = useSite();

  // Dimatikan dari Pengaturan Situs → section beranda hilang, halaman /produk/ hanya berisi pemberitahuan
  if (!site.features.products) {
    if (variant === 'teaser' || state.status !== 'success') return null;
    return (
      <Section id="produk" tone="dark" labelledBy="produk-title" className={styles.page}>
        <Reveal className={styles.pageHead}>
          <Kicker>{state.data.heading.kicker}</Kicker>
          <h1 id="produk-title" className={styles.pageTitle}>
            {state.data.labels.unavailableTitle}
          </h1>
          <p className={styles.pageIntro}>{state.data.labels.unavailableText}</p>
        </Reveal>
        <Button href={pageUrl('/')} variant="light" iconEnd="arrow">
          {state.data.labels.backHome}
        </Button>
      </Section>
    );
  }

  if (variant === 'teaser') {
    // Section opsional di beranda: tidak dirender bila belum ada produk (tanpa ruang kosong)
    if (state.status !== 'success' || state.data.items.length === 0) return null;
    return <ProductsTeaser data={state.data} />;
  }

  return (
    <Section id="produk" tone="dark" labelledBy="produk-title" className={styles.page}>
      <SectionState state={state} isEmpty={(d) => d.items.length === 0} skeletonCount={4}>
        {(data) => <ProductsPage data={data} />}
      </SectionState>
    </Section>
  );
}

/* ---------- Beranda: 4 produk + tombol ke halaman produk ---------- */

function ProductsTeaser({ data }: { data: ProductsContent }) {
  // Utamakan produk yang tersedia
  const items = [...data.items].sort((a, b) => Number(b.inStock) - Number(a.inStock)).slice(0, TEASER_LIMIT);
  return (
    <Section id="produk" tone="dark" labelledBy="produk-title">
      <SectionTitle
        heading={data.teaserHeading}
        id="produk-title"
        aside={
          <Button href={pageUrl('/produk/')} variant="ghost" iconEnd="arrow">
            {data.labels.viewAll}
          </Button>
        }
      />
      <ProductGrid items={items} data={data} />
    </Section>
  );
}

/* ---------- Halaman /produk/ ---------- */

function ProductsPage({ data }: { data: ProductsContent }) {
  const [filter, setFilter] = useState<ProductCategory | 'all'>('all');
  const items = filter === 'all' ? data.items : data.items.filter((p) => p.category === filter);

  return (
    <>
      <Reveal className={styles.pageHead}>
        <Kicker>{data.heading.kicker}</Kicker>
        <h1 id="produk-title" className={styles.pageTitle}>
          {data.heading.title}
        </h1>
        {data.heading.intro && <p className={styles.pageIntro}>{data.heading.intro}</p>}
      </Reveal>

      {data.categories.length > 1 && (
        <div className={styles.filters} role="group" aria-label={data.labels.filterLabel}>
          {(['all', ...data.categories] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className={styles.chip}
              aria-pressed={filter === cat}
              onClick={() => setFilter(cat)}
            >
              {cat === 'all' ? data.labels.filterAll : cat}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <ProductGrid items={items} data={data} />
      ) : (
        <p className={styles.empty}>{data.labels.empty}</p>
      )}

      <section className={styles.howTo} aria-labelledby="cara-pesan">
        <h2 id="cara-pesan" className={styles.howToTitle}>
          {data.howToOrder.title}
        </h2>
        <ol className={styles.steps}>
          {data.howToOrder.steps.map((step, i) => (
            <li key={step.title}>
              <span className={styles.stepNo} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <strong>{step.title}</strong>
              <span>{step.description}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

/* ---------- Grid & kartu ---------- */

function ProductGrid({ items, data }: { items: Product[]; data: ProductsContent }) {
  return (
    <ul className={styles.grid}>
      {items.map((product, i) => (
        <Reveal as="li" key={product.id} delay={(i % 4) * 0.05}>
          <ProductCard product={product} labels={data.labels} />
        </Reveal>
      ))}
    </ul>
  );
}

function ProductCard({ product, labels }: { product: Product; labels: ProductsContent['labels'] }) {
  const { site } = useSite();
  const book = useBooking();
  const fullName = product.size ? `${product.name} (${product.size})` : product.name;
  // Pesanan ke WhatsApp cabang terpilih (belum memilih → pemilih cabang dulu)
  const order = book({ kind: product.inStock ? 'product' : 'productRestock', vars: { product: fullName } });
  const markets = [
    product.shopeeUrl && { label: 'Shopee', url: product.shopeeUrl },
    product.tokopediaUrl && { label: 'Tokopedia', url: product.tokopediaUrl },
  ].filter((m): m is { label: string; url: string } => Boolean(m));

  return (
    <Card className={`${styles.card} ${product.inStock ? '' : styles.out}`}>
      {/* Gambar + label ditumpuk dalam satu sel grid (tanpa position absolute) */}
      <div className={styles.media}>
        {product.image ? (
          <ResponsiveImage image={product.image} className={styles.img} />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <img src={asset(site.logo.mark.src)} alt="" width={site.logo.mark.width} height={site.logo.mark.height} />
            <span>{product.category}</span>
          </div>
        )}
        {product.badge && <span className={`${styles.chipTag} ${styles.badge}`}>{product.badge}</span>}
        {!product.inStock && <span className={`${styles.chipTag} ${styles.stock}`}>{labels.outOfStock}</span>}
      </div>

      <div className={styles.body}>
        <p className={styles.meta}>
          {product.category}
          {product.size && ` · ${product.size}`}
        </p>
        <h3 className={styles.name}>{product.name}</h3>
        {product.description && <p className={styles.desc}>{product.description}</p>}
        <p className={styles.price}>
          {product.compareAtPrice && (
            <s>
              <span className="visually-hidden">{labels.normalPrice} </span>
              {formatRupiah(product.compareAtPrice)}
            </s>
          )}
          <strong>{formatRupiah(product.price)}</strong>
        </p>

        <CardFooter className={styles.foot}>
          <Button href={order.href} external={order.external} onClick={order.onClick} size="sm" block variant={product.inStock ? 'light' : 'ghost'} icon="whatsapp">
            <span className={styles.longLabel}>{product.inStock ? labels.order : labels.askRestock}</span>
            <span className={styles.shortLabel}>{product.inStock ? labels.orderShort : labels.askRestock}</span>
            <span className="visually-hidden"> {fullName}</span>
          </Button>
          {markets.length > 0 && (
            <p className={styles.markets}>
              {labels.alsoAt}{' '}
              {markets.map((m, i) => (
                <span key={m.label}>
                  {i > 0 && ' · '}
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    {m.label}
                  </a>
                </span>
              ))}
            </p>
          )}
        </CardFooter>
      </div>
    </Card>
  );
}
