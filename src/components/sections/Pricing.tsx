import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { getPricing } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { formatRupiah, formatThousandsK } from '@/lib/format';
import { priceCategoryAnchor } from '@/content/priceCategories';
import { categoryFromHash, PRICE_CATEGORY_EVENT } from '@/lib/priceCategoryEvent';
import { fillTemplate } from '@/lib/whatsapp';
import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { MOBILE_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import type { PriceCategory } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import styles from './Pricing.module.css';

export function Pricing() {
  const { effective, pageBranch, copy, openPicker } = useBranch();
  // Harga sesuai cabang (harga khusus dari branchPrices, atau harga dasar)
  const state = useContent(() => getPricing(effective?.slug), [effective?.slug]);
  const book = useBooking();

  return (
    <Section id="harga" tone="light" labelledBy="harga-title">
      <SectionState
        state={state}
        tone="light"
        isEmpty={(d) => d.categories.every((c) => c.items.length === 0) && d.packages.length === 0}
        skeletonCount={2}
      >
        {(data) => (
          <>
            <SectionTitle heading={data.heading} id="harga-title" tone="light" />

            {(data.branchName || data.hasBranchPrices) && (
              <p className={styles.branchNote}>
                <span>
                  {data.branchName ? fillTemplate(copy.labels.priceFor, { branch: data.branchName }) : copy.labels.priceVaries}
                </span>
                {!pageBranch && (
                  <button type="button" className={styles.branchBtn} onClick={() => openPicker()}>
                    {data.branchName ? copy.labels.changeBranch : copy.labels.pickBranch}
                  </button>
                )}
              </p>
            )}

            <PriceCategories categories={data.categories.filter((c) => c.items.length > 0)} priceFromLabel={data.priceFromLabel} />

            {data.packages.length > 0 && (
              <>
                <h3 className={styles.packagesTitle}>{data.packagesTitle}</h3>
                <ul className={styles.packages}>
                  {data.packages.map((pkg) => {
                    const target = book({ kind: 'package', vars: { package: pkg.name } });
                    return (
                    <li key={pkg.id}>
                      <Card tone={pkg.featured ? 'featured' : 'light'} className={pkg.featured ? styles.featured : undefined}>
                        <p className={styles.tag}>{pkg.tag}</p>
                        <h4 className={styles.pkgName}>{pkg.name}</h4>
                        <p className={styles.pkgPrice}>
                          {formatRupiah(pkg.price)}
                          {pkg.unit && <small>{pkg.unit}</small>}
                        </p>
                        <ul className={styles.features}>
                          {pkg.features.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                        <CardFooter>
                          <Button
                            href={target.href}
                            external={target.external}
                            onClick={target.onClick}
                            block
                            variant={pkg.featured ? 'light' : 'outline-dark'}
                          >
                            {pkg.ctaLabel}
                            <span className="visually-hidden"> {pkg.name}</span>
                          </Button>
                        </CardFooter>
                      </Card>
                    </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </SectionState>
    </Section>
  );
}

export function PriceRows({ category, priceFromLabel }: { category: PriceCategory; priceFromLabel: string }) {
  return (
    <ul>
      {category.items.map((item) => (
        <li key={item.id} className={styles.row}>
          <span className={styles.itemName}>
            {item.name}
            {item.badge && <span className={styles.badge}>{item.badge}</span>}
            {item.description && <small>{item.description}</small>}
          </span>
          {/* Format "K" khusus Daftar Harga (100000 → 100K); "Start from" kecil sebelum harga item "mulai" */}
          <span className={styles.itemPrice}>
            {item.priceFrom && <small className={styles.priceFrom}>{priceFromLabel}</small>}
            {formatThousandsK(item.price)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Desktop/tablet: semua kategori dalam grid 2 kolom. HP: tab per kategori (satu kategori tampil sekaligus) agar
 * daftar panjang tidak memenuhi layar. Tanpa animasi reveal per baris.
 */
function PriceCategories({ categories, priceFromLabel }: { categories: PriceCategory[]; priceFromLabel: string }) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const uid = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  // "Lihat harga" di kartu Layanan / hash #harga-<kategori> → pilih tab kategori itu (HP)
  const ids = categories.map((c) => c.id).join('|');
  useEffect(() => {
    const keys = ids.split('|');
    const fromHash = categoryFromHash(keys);
    if (fromHash) setActiveId(fromHash);
    const onSelect = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (keys.includes(key)) setActiveId(key);
    };
    const onHash = () => {
      const key = categoryFromHash(keys);
      if (key) setActiveId(key);
    };
    window.addEventListener(PRICE_CATEGORY_EVENT, onSelect);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener(PRICE_CATEGORY_EVENT, onSelect);
      window.removeEventListener('hashchange', onHash);
    };
  }, [ids]);

  if (!mobile || categories.length < 2) {
    return (
      <div className={styles.categories}>
        {categories.map((category) => (
          <div key={category.id} id={priceCategoryAnchor(category.id)} className={styles.category}>
            <h3 className={styles.categoryName}>{category.name}</h3>
            <PriceRows category={category} priceFromLabel={priceFromLabel} />
          </div>
        ))}
      </div>
    );
  }

  const tabId = (c: PriceCategory) => `${uid}-tab-${categories.indexOf(c)}`;
  const select = (c: PriceCategory, focus = false) => {
    setActiveId(c.id);
    const el = tabsRef.current?.querySelector<HTMLButtonElement>(`[id="${tabId(c)}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (focus) el?.focus();
  };
  // Panah kiri/kanan, Home/End berpindah tab (pola tablist WAI-ARIA)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = categories.indexOf(active);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: categories.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(categories[(next + categories.length) % categories.length], true);
  };

  return (
    <div className={styles.tabbed}>
      {/* Target anchor #harga-<kategori> di HP (kategori tampil sebagai tab) */}
      {categories.map((c) => (
        <span key={c.id} id={priceCategoryAnchor(c.id)} className={styles.anchor} aria-hidden="true" />
      ))}
      <div ref={tabsRef} className={styles.tabs} role="tablist" aria-label="Kategori harga" onKeyDown={onKeyDown}>
        {categories.map((c) => (
          <button
            key={c.id}
            id={tabId(c)}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={c === active}
            aria-controls={`${uid}-panel`}
            tabIndex={c === active ? 0 : -1}
            onClick={() => select(c)}
          >
            {c.name}
            <span className={styles.tabCount}>{c.items.length}</span>
          </button>
        ))}
      </div>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={tabId(active)} className={styles.category}>
        <PriceRows category={active} priceFromLabel={priceFromLabel} />
      </div>
    </div>
  );
}
