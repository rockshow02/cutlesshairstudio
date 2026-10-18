/** Admin → Toko → Pengaturan (owner): toko aktif, batas waktu, stempel, ongkir; per cabang: cara terima, rekening/QRIS, kode unik. */
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toastContext';
import { useAdmin } from '../context';
import styles from '../admin.module.css';

export interface ShopSettingsData {
  enabled: boolean;
  payment_window_min: number;
  pickup_window_days: number;
  auto_complete_days: number;
  stamp_min_subtotal: number;
  low_stock_threshold: number;
  return_policy: string;
  shipping_provider: 'manual' | 'rajaongkir';
  shipping_daily_limit: number;
}
export interface BranchShopData {
  branch_id: number;
  name: string;
  pickup_enabled: boolean;
  with_booking_enabled: boolean;
  ship_manual_enabled: boolean;
  ship_auto_enabled: boolean;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  qris_image: string | null;
  payment_note: string | null;
  unique_code_enabled: boolean;
  origin_region_id: string | null;
  origin_label: string | null;
}
export interface ShopAdminState {
  available: boolean;
  autoShipping: boolean;
  settings: ShopSettingsData | null;
  branches: BranchShopData[];
}

export function ShopSettings({ state, onSaved }: { state: ShopAdminState; onSaved: () => void }) {
  const me = useAdmin();
  const isOwner = me.admin.role === 'owner';
  const toast = useToast();
  const [f, setF] = useState<ShopSettingsData>(state.settings!);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const disabled = !isOwner || !state.available;
  const n = (k: keyof ShopSettingsData) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/admin/shop/settings', { method: 'PUT', json: f });
      toast(f.enabled ? 'Pengaturan toko tersimpan. Toko aktif.' : 'Pengaturan toko tersimpan.');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.stack}>
      <Card tone="outline" as="form" onSubmit={save}>
        <div className={styles.cardHead}>
          <h2 className={styles.panelTitle}>Cutless Shop</h2>
          <Badge tone={state.available && f.enabled ? 'success' : 'neutral'}>{state.available && f.enabled ? 'Toko aktif' : 'Toko mati'}</Badge>
        </div>
        {!state.available && <Alert tone="warning">Fitur belum tersedia di server ini (variabel SHOP_ENABLED). Pengaturan hanya bisa dilihat.</Alert>}
        {!isOwner && <Alert tone="info" role="none">Hanya owner yang bisa mengubah pengaturan toko.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <Checkbox checked={f.enabled} disabled={disabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} className={styles.checkRow}>
          Toko aktif: /shop bisa dipakai pelanggan, landing page & /produk membaca produk dari toko
        </Checkbox>
        <FieldGrid>
          <Field label="Batas bayar (menit)" hint="Lewat batas → pesanan kedaluwarsa & stok dilepas. 1440 = 24 jam.">
            <Input type="number" min={30} max={20160} value={f.payment_window_min} disabled={disabled} onChange={n('payment_window_min')} />
          </Field>
          <Field label="Batas ambil (hari)" hint="Sejak siap diambil. Lewat batas → tampil “Belum diambil” + Telegram (tidak batal otomatis).">
            <Input type="number" min={1} max={60} value={f.pickup_window_days} disabled={disabled} onChange={n('pickup_window_days')} />
          </Field>
          <Field label="Selesai otomatis (hari setelah dikirim)">
            <Input type="number" min={1} max={60} value={f.auto_complete_days} disabled={disabled} onChange={n('auto_complete_days')} />
          </Field>
          <Field label="Stempel dari belanja: subtotal minimum (Rp)" hint="Maks. 1 stempel/hari gabungan dengan booking.">
            <Input type="number" min={0} value={f.stamp_min_subtotal} disabled={disabled} onChange={n('stamp_min_subtotal')} />
          </Field>
          <Field label="Peringatan stok menipis (≤)">
            <Input type="number" min={0} max={1000} value={f.low_stock_threshold} disabled={disabled} onChange={n('low_stock_threshold')} />
          </Field>
          <Field label="Ongkir" hint={state.autoShipping ? 'RajaOngkir tersedia di server.' : 'Ongkir otomatis butuh SHIPPING_PROVIDER=rajaongkir + secret RAJAONGKIR_API_KEY.'}>
            <Select value={f.shipping_provider} disabled={disabled} onChange={(e) => setF({ ...f, shipping_provider: e.target.value as ShopSettingsData['shipping_provider'] })}>
              <option value="manual">Manual (admin mengisi ongkir)</option>
              <option value="rajaongkir">Otomatis (RajaOngkir)</option>
            </Select>
          </Field>
          <Field label="Batas hit RajaOngkir per hari" hint="Paket gratis 100/hari; sisakan cadangan.">
            <Input type="number" min={0} max={100000} value={f.shipping_daily_limit} disabled={disabled} onChange={n('shipping_daily_limit')} />
          </Field>
        </FieldGrid>
        <Field label="Kebijakan retur (tampil di halaman produk)">
          <Textarea rows={3} maxLength={2000} value={f.return_policy} disabled={disabled} onChange={(e) => setF({ ...f, return_policy: e.target.value })} />
        </Field>
        {isOwner && (
          <div className={styles.formActions}>
            <Button type="submit" variant="dark" casing="normal" disabled={busy || disabled}>
              Simpan pengaturan toko
            </Button>
          </div>
        )}
      </Card>
      {state.branches.map((b) => (
        <BranchShopForm key={b.branch_id} branch={b} disabled={disabled} autoShipping={state.autoShipping && f.shipping_provider === 'rajaongkir'} onSaved={onSaved} />
      ))}
    </div>
  );
}

function BranchShopForm({ branch, disabled, autoShipping, onSaved }: { branch: BranchShopData; disabled: boolean; autoShipping: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(branch);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [regionQ, setRegionQ] = useState('');
  const [regions, setRegions] = useState<{ id: string; label: string }[]>([]);
  const t = (k: keyof BranchShopData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value || null });
  const c = (k: keyof BranchShopData) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.checked });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { branch_id: _id, name: _n, ...json } = f;
      await api(`/admin/shop/branches/${branch.branch_id}`, { method: 'PUT', json });
      toast(`Pengaturan toko ${branch.name} tersimpan.`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const search = async () => {
    try {
      setRegions((await api<{ regions: { id: string; label: string }[] }>(`/admin/shop/regions?q=${encodeURIComponent(regionQ)}`)).regions);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Card tone="outline" as="form" onSubmit={save}>
      <h2 className={styles.panelTitle}>Toko · {branch.name}</h2>
      {error && <Alert tone="danger">{error}</Alert>}
      <h3 className={styles.sectionLabel}>Cara terima</h3>
      <div className={styles.checkList}>
        <Checkbox checked={f.pickup_enabled} disabled={disabled} onChange={c('pickup_enabled')}>
          Ambil di cabang (bayar transfer/QRIS dulu)
        </Checkbox>
        <Checkbox checked={f.with_booking_enabled} disabled={disabled} onChange={c('with_booking_enabled')}>
          Ambil saat booking (bayar di kasir)
        </Checkbox>
        <Checkbox checked={f.ship_manual_enabled} disabled={disabled} onChange={c('ship_manual_enabled')}>
          Dikirim, ongkir diisi admin
        </Checkbox>
        <Checkbox checked={f.ship_auto_enabled} disabled={disabled} onChange={c('ship_auto_enabled')}>
          Dikirim, ongkir otomatis (RajaOngkir; gagal/kuota habis → manual)
        </Checkbox>
      </div>
      {f.ship_auto_enabled && (
        <div className={styles.subPanel}>
          <p className={styles.muted}>Asal pengiriman: {f.origin_label ?? 'belum diisi'}</p>
          {autoShipping ? (
            <>
              <div className={styles.searchRow}>
                <Field label="Cari kecamatan asal" flush>
                  <Input value={regionQ} disabled={disabled} onChange={(e) => setRegionQ(e.target.value)} />
                </Field>
                <Button variant="outline-dark" casing="normal" disabled={disabled || regionQ.trim().length < 3} onClick={search}>
                  Cari
                </Button>
              </div>
              {regions.map((r) => (
                <Button key={r.id} variant="text" casing="normal" size="sm" onClick={() => setF({ ...f, origin_region_id: r.id, origin_label: r.label })}>
                  {r.label}
                </Button>
              ))}
            </>
          ) : (
            <Alert tone="info" role="none">Ongkir otomatis belum aktif; pesanan kirim memakai ongkir manual.</Alert>
          )}
        </div>
      )}
      <h3 className={styles.sectionLabel}>Pembayaran</h3>
      <FieldGrid>
        <Field label="Bank">
          <Input value={f.bank_name ?? ''} disabled={disabled} onChange={t('bank_name')} placeholder="BCA" />
        </Field>
        <Field label="Nomor rekening">
          <Input value={f.bank_account_no ?? ''} disabled={disabled} onChange={t('bank_account_no')} inputMode="numeric" />
        </Field>
        <Field label="Atas nama">
          <Input value={f.bank_account_name ?? ''} disabled={disabled} onChange={t('bank_account_name')} />
        </Field>
        <Field label="Gambar QRIS statis (opsional)" hint="Path media Pages CMS, mis. /uploads/qris-bogor.png">
          <Input value={f.qris_image ?? ''} disabled={disabled} onChange={t('qris_image')} />
        </Field>
      </FieldGrid>
      <Checkbox checked={f.unique_code_enabled} disabled={disabled} onChange={c('unique_code_enabled')} className={styles.checkRow}>
        Kode unik transfer: tambah Rp 1–999 ke total agar mutasi mudah dicocokkan (QRIS: pelanggan diminta mengetik nominal persis)
      </Checkbox>
      <Field label="Catatan pembayaran (opsional)">
        <Textarea rows={2} maxLength={500} value={f.payment_note ?? ''} disabled={disabled} onChange={t('payment_note')} />
      </Field>
      {!disabled && (
        <div className={styles.formActions}>
          <Button type="submit" variant="dark" casing="normal" disabled={busy}>
            Simpan {branch.name}
          </Button>
        </div>
      )}
    </Card>
  );
}
