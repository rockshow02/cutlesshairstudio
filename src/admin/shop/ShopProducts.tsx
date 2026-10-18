/** Admin → Toko → Produk & stok: daftar produk, stok per cabang (admin cabang: cabangnya), tambah/ubah produk (owner). */
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { rupiah } from '@/app/format';
import { usePaged } from '@/app/usePaged';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from '@/components/ui/Field';
import { LoadMore } from '@/components/ui/LoadMore';
import { Sheet } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/toastContext';
import type { ShopProduct, ShopVariant } from '@/shop/types';
import { useAdmin } from '../context';
import styles from '../admin.module.css';
import local from './shopAdmin.module.css';

export function ShopProducts({ lowStock }: { lowStock: number }) {
  const me = useAdmin();
  const isOwner = me.admin.role === 'owner';
  const branches = me.branches.filter((b) => b.status !== 'closed' && (isOwner || b.id === me.admin.branch_id));
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ShopProduct | 'new' | null>(null);
  const [stockFor, setStockFor] = useState<{ product: ShopProduct; variant: ShopVariant } | null>(null);
  const list = usePaged<ShopProduct>(async (cursor) => {
    const p = new URLSearchParams({ limit: '50', q: query });
    if (cursor) p.set('cursor', cursor);
    const r = await api<{ products: ShopProduct[]; nextCursor: string | null }>(`/admin/shop/products?${p}`);
    return { items: r.products, nextCursor: r.nextCursor };
  }, [query]);

  return (
    <div className={styles.stack}>
      <form
        className={styles.searchRow}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <Field label="Cari produk" flush>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama atau kategori" />
        </Field>
        <Button type="submit" variant="outline-dark" casing="normal" icon="search">
          Cari
        </Button>
        {isOwner && (
          <Button variant="dark" casing="normal" icon="plus" onClick={() => setEditing('new')}>
            Produk baru
          </Button>
        )}
      </form>
      {list.error && <Alert tone="danger">{list.error}</Alert>}
      {!list.items ? (
        <SkeletonList label="Memuat produk…" count={3} height={64} />
      ) : list.items.length === 0 ? (
        <EmptyState icon="tag" title="Belum ada produk" compact>
          Jalankan seed sekali (npm run db:seed:shop:staging) atau tambah produk baru.
        </EmptyState>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Produk / varian</th>
                  <th scope="col" className={styles.num}>
                    Harga
                  </th>
                  {branches.map((b) => (
                    <th key={b.id} scope="col" className={styles.num}>
                      Stok {b.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.items.flatMap((p) =>
                  p.variants.map((v, i) => (
                    <tr key={v.id}>
                      <td>
                        {i === 0 && (
                          <span className={styles.cellMain}>
                            {isOwner ? (
                              <button type="button" className={local.textBtn} onClick={() => setEditing(p)}>
                                {p.name}
                              </button>
                            ) : (
                              p.name
                            )}{' '}
                            {!p.isActive && <Badge tone="neutral">Nonaktif</Badge>}
                            {p.releaseAt && Date.parse(p.releaseAt) > Date.now() && <Badge tone="info">Drop</Badge>}
                          </span>
                        )}
                        <span className={styles.cellSub}>
                          {v.name}
                          {v.sku && ` · ${v.sku}`} {!v.isActive && '(nonaktif)'}
                        </span>
                      </td>
                      <td className={styles.num}>{rupiah(v.price)}</td>
                      {branches.map((b) => {
                        const n = v.stock[String(b.id)] ?? 0;
                        return (
                          <td key={b.id} className={styles.num}>
                            <button type="button" className={local.textBtn} onClick={() => setStockFor({ product: p, variant: v })} aria-label={`Atur stok ${p.name} ${v.name} di ${b.name}`}>
                              {n}
                            </button>{' '}
                            {n <= lowStock && <Badge tone={n === 0 ? 'danger' : 'warning'}>{n === 0 ? 'Habis' : 'Menipis'}</Badge>}
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className={styles.muted}>Angka stok = tersedia (stok fisik dikurangi yang sedang dipesan). Klik angka untuk mengubah stok fisik.</p>
          <LoadMore shown={list.items.length} hasMore={list.hasMore} loading={list.loadingMore} onLoad={list.loadMore} noun="produk" />
        </>
      )}
      {stockFor && <StockSheet {...stockFor} branches={branches} onClose={() => setStockFor(null)} onSaved={list.reload} />}
      {editing && <ProductSheet product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={list.reload} />}
    </div>
  );
}

function StockSheet({ product, variant, branches, onClose, onSaved }: { product: ShopProduct; variant: ShopVariant; branches: { id: number; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? 0);
  const [onHand, setOnHand] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ stock: { on_hand: number; reserved: number } }>('/admin/shop/stock', { method: 'PUT', json: { branchId, variantId: variant.id, onHand: Number(onHand), reason } });
      toast(`Stok tersimpan: ${r.stock.on_hand} fisik, ${r.stock.reserved} sedang dipesan.`);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Atur stok" meta={`${product.name} · ${variant.name}`}>
      <form className={styles.stack} onSubmit={save}>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Cabang">
          <Select value={branchId} onChange={(e) => setBranchId(Number(e.target.value))}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (tersedia {variant.stock[String(b.id)] ?? 0})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Stok fisik sekarang" hint="Jumlah barang di rak cabang, termasuk yang sudah dipesan tetapi belum diambil/dikirim.">
          <Input type="number" min={0} max={100000} required value={onHand} onChange={(e) => setOnHand(e.target.value)} />
        </Field>
        <Field label="Alasan" hint="Mis. barang masuk, stock opname, rusak.">
          <Input required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Button type="submit" variant="dark" casing="normal" disabled={busy || onHand === '' || reason.trim().length < 3}>
          Simpan stok
        </Button>
      </form>
    </Sheet>
  );
}

type VariantForm = { id?: number; sku: string; name: string; price: string; compare_at_price: string; weight_gram: string; is_active: boolean };
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 16) : '');

function ProductSheet({ product, onClose, onSaved }: { product: ShopProduct | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    slug: product?.slug ?? '',
    name: product?.name ?? '',
    category: product?.category ?? 'Pomade',
    description: product?.description ?? '',
    notes: product?.notes ?? '',
    badge: product?.badge ?? '',
    is_active: product?.isActive ?? true,
    sort_order: String(product?.sortOrder ?? 100),
    release_at: toLocalInput(product?.releaseAt ?? null),
    per_customer_limit: product?.perCustomerLimit ? String(product.perCustomerLimit) : '',
    images: (product?.images ?? []).map((i) => i.path).join('\n'),
  });
  const [variants, setVariants] = useState<VariantForm[]>(
    product?.variants.map((v) => ({ id: v.id, sku: v.sku ?? '', name: v.name, price: String(v.price), compare_at_price: v.compareAtPrice ? String(v.compareAtPrice) : '', weight_gram: String(v.weightGram), is_active: v.isActive })) ?? [
      { sku: '', name: 'Standar', price: '', compare_at_price: '', weight_gram: '200', is_active: true },
    ],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setV = (i: number, patch: Partial<VariantForm>) => setVariants(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const opt = (s: string) => (s.trim() === '' ? null : s.trim());

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const json = {
        slug: f.slug.trim(),
        name: f.name.trim(),
        category: f.category.trim(),
        description: opt(f.description),
        notes: opt(f.notes),
        badge: opt(f.badge),
        is_active: f.is_active,
        sort_order: Number(f.sort_order) || 0,
        // Input datetime-local dibaca sebagai WIB
        release_at: f.release_at ? new Date(`${f.release_at}:00+07:00`).toISOString() : null,
        per_customer_limit: f.per_customer_limit ? Number(f.per_customer_limit) : null,
        images: f.images.split('\n').map((s) => s.trim()).filter(Boolean).map((path) => ({ path })),
        variants: variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          sku: opt(v.sku),
          name: v.name.trim(),
          options: {},
          price: Number(v.price),
          compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
          weight_gram: Number(v.weight_gram) || 1,
          is_active: v.is_active,
        })),
      };
      await api(product ? `/admin/shop/products/${product.id}` : '/admin/shop/products', { method: product ? 'PUT' : 'POST', json });
      toast(product ? 'Produk tersimpan.' : 'Produk ditambahkan. Isi stok per cabang.');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={product ? `Ubah ${product.name}` : 'Produk baru'}
      footer={
        <Button type="submit" form="form-produk" variant="dark" casing="normal" block disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan produk'}
        </Button>
      }
    >
      <form id="form-produk" className={styles.stack} onSubmit={save}>
        {error && <Alert tone="danger">{error}</Alert>}
        <FieldGrid>
          <Field label="Nama">
            <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: product ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} />
          </Field>
          <Field label="Slug (alamat /shop/…)">
            <Input required value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
          </Field>
          <Field label="Kategori">
            <Input required value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </Field>
          <Field label="Label (opsional)" hint="Mis. Best Seller, Promo, Baru">
            <Input value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })} />
          </Field>
          <Field label="Urutan tampil">
            <Input type="number" min={0} value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} />
          </Field>
          <Field label="Maks. per pelanggan (opsional)" hint="Dihitung dari semua pesanan non-batal pelanggan.">
            <Input type="number" min={1} max={100} value={f.per_customer_limit} onChange={(e) => setF({ ...f, per_customer_limit: e.target.value })} />
          </Field>
          <Field label="Rilis (drop, WIB, opsional)" hint="Sebelum waktu ini produk tampil tetapi belum bisa dipesan.">
            <Input type="datetime-local" value={f.release_at} onChange={(e) => setF({ ...f, release_at: e.target.value })} />
          </Field>
        </FieldGrid>
        <Field label="Deskripsi singkat">
          <Textarea rows={2} maxLength={1000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Detail & cara pakai (opsional)">
          <Textarea rows={3} maxLength={3000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <Field label="Foto (satu path per baris)" hint="Unggah lewat Pages CMS → Media, lalu salin path-nya, mis. /uploads/products/pomade.webp">
          <Textarea rows={3} value={f.images} onChange={(e) => setF({ ...f, images: e.target.value })} />
        </Field>
        <Checkbox checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className={styles.checkRow}>
          Tampil di toko
        </Checkbox>

        <h3 className={styles.sectionLabel}>Varian</h3>
        {variants.map((v, i) => (
          <div key={v.id ?? `baru-${i}`} className={styles.subPanel}>
            <FieldGrid>
              <Field label="Nama varian" hint="Mis. 100 gr, Strong Hold">
                <Input required value={v.name} onChange={(e) => setV(i, { name: e.target.value })} />
              </Field>
              <Field label="SKU (opsional)">
                <Input value={v.sku} onChange={(e) => setV(i, { sku: e.target.value })} />
              </Field>
              <Field label="Harga (Rp)">
                <Input required inputMode="numeric" value={v.price} onChange={(e) => setV(i, { price: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Harga coret (opsional)">
                <Input inputMode="numeric" value={v.compare_at_price} onChange={(e) => setV(i, { compare_at_price: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Berat (gram)" hint="Untuk ongkir">
                <Input required inputMode="numeric" value={v.weight_gram} onChange={(e) => setV(i, { weight_gram: e.target.value.replace(/\D/g, '') })} />
              </Field>
            </FieldGrid>
            <Checkbox checked={v.is_active} onChange={(e) => setV(i, { is_active: e.target.checked })}>
              Varian aktif
            </Checkbox>
            {!v.id && variants.length > 1 && (
              <Button variant="text" casing="normal" size="sm" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>
                Hapus varian ini
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline-dark" casing="normal" size="sm" icon="plus" onClick={() => setVariants([...variants, { sku: '', name: '', price: '', compare_at_price: '', weight_gram: '200', is_active: true }])}>
          Tambah varian
        </Button>
        <p className={styles.muted}>Varian lama tidak dihapus (riwayat pesanan tetap utuh); matikan dengan "Varian aktif".</p>
      </form>
    </Sheet>
  );
}
