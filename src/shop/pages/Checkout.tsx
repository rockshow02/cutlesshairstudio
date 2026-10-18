import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiClientError, errorMessage } from '@/app/api';
import { longDate, clock, rupiah } from '@/app/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { Field, FieldGrid, Input, Textarea } from '@/components/ui/Field';
import { Page, Loading } from '@/booking/Page';
import { Turnstile } from '@/booking/Turnstile';
import { completeProfileUrl, loginUrl, useAuthConfig, useMe } from '@/booking/hooks';
import type { CustomerBooking } from '@/booking/types';
import { activeBranchId, useCart, useQuote, useShopConfig } from '../cart';
import { Thumb } from '../parts';
import { FULFILLMENT_TEXT, type Fulfillment, type Order, type Rate, type ShopConfig } from '../types';
import bookingStyles from '@/booking/booking.module.css';
import styles from '../shop.module.css';

/** /shop/checkout: wajib login & profil lengkap */
export function Checkout() {
  const { config, error } = useShopConfig();
  const { loading, me } = useMe();
  useEffect(() => {
    if (!loading && me && !me.profileComplete) window.location.replace(completeProfileUrl());
  }, [loading, me]);

  if (error) return <CheckoutShell><Alert tone="danger">{error}</Alert></CheckoutShell>;
  if (!config || loading) return <CheckoutShell><Loading count={2} /></CheckoutShell>;
  if (!config.enabled) {
    return (
      <CheckoutShell>
        <EmptyState icon="tag" title="Toko belum dibuka" action={<Button href="/produk/" variant="dark" size="sm">Lihat produk</Button>} />
      </CheckoutShell>
    );
  }
  if (!me) {
    return (
      <CheckoutShell>
        <EmptyState
          icon="user"
          title="Masuk dulu untuk checkout"
          action={
            <Button href={loginUrl('/shop/checkout')} variant="dark" icon="user">
              Masuk
            </Button>
          }
        >
          Pesanan tersimpan di akunmu, jadi kamu bisa cek status & instruksi bayar kapan saja. Keranjangmu tetap aman.
        </EmptyState>
      </CheckoutShell>
    );
  }
  if (!me.profileComplete) return <CheckoutShell><Loading count={2} /></CheckoutShell>;
  return <CheckoutForm config={config} me={{ name: me.name, phone: me.phone ?? '' }} />;
}

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <Page
      id="checkout"
      kicker="Cutless Shop"
      title="Checkout"
      actions={
        <Button href="/shop/" variant="outline-dark" size="sm" icon="tag">
          Kembali ke toko
        </Button>
      }
    >
      {children}
    </Page>
  );
}

type Config = Extract<ShopConfig, { enabled: true }>;

function CheckoutForm({ config, me }: { config: Config; me: { name: string; phone: string } }) {
  const { cart, clear } = useCart();
  const auth = useAuthConfig();
  const branchId = activeBranchId(config, cart);
  const branch = config.branches.find((b) => b.id === branchId) ?? null;
  const options = branch?.fulfillment ?? [];
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const chosen = fulfillment && options.includes(fulfillment) ? fulfillment : (options[0] ?? null);
  const ship = chosen === 'ship_manual' || chosen === 'ship_auto';
  const [payment, setPayment] = useState<'transfer' | 'qris'>('transfer');
  const [bookings, setBookings] = useState<CustomerBooking[] | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [addr, setAddr] = useState({ recipientName: me.name, recipientPhone: me.phone, address: '', postalCode: '' });
  const [region, setRegion] = useState<{ id: string; label: string } | null>(null);
  const [rate, setRate] = useState<Rate | null>(null);
  const [note, setNote] = useState('');
  const [token, setToken] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const { quote, error: quoteError } = useQuote(branchId, cart.items, { fulfillment: chosen ?? undefined, regionId: chosen === 'ship_auto' ? region?.id : null });

  // Booking aktif di cabang ini (untuk "ambil saat booking")
  useEffect(() => {
    if (chosen !== 'with_booking' || bookings) return;
    api<{ active: CustomerBooking[] }>('/me/bookings')
      .then((r) => setBookings(r.active.filter((b) => ['pending', 'confirmed'].includes(b.status) && Date.parse(b.startAt) > Date.now())))
      .catch(() => setBookings([]));
  }, [chosen, bookings]);
  const branchBookings = (bookings ?? []).filter((b) => b.branch.slug === branch?.slug);

  if (!cart.items.length) {
    return (
      <CheckoutShell>
        <EmptyState icon="tag" title="Keranjang kosong" action={<Button href="/shop/" variant="dark" size="sm">Belanja</Button>}>
          Tambahkan produk dari toko dulu, ya.
        </EmptyState>
      </CheckoutShell>
    );
  }

  const shippingFee = chosen === 'ship_auto' && rate ? rate.cost : chosen === 'pickup' || chosen === 'with_booking' ? 0 : null;
  const total = quote ? quote.subtotal + (shippingFee ?? 0) : null;
  const needsToken = Boolean(auth?.turnstileSiteKey);
  const ready = Boolean(quote?.ok && chosen && (!needsToken || token) && (chosen !== 'with_booking' || bookingId) && (chosen !== 'ship_auto' || rate));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!branch || !chosen) return;
    setBusy(true);
    setError('');
    setFields({});
    try {
      const r = await api<{ order: Order; fallbackToManual: boolean }>('/shop/orders', {
        method: 'POST',
        json: {
          branch: branch.id,
          items: cart.items,
          fulfillment: chosen,
          paymentMethod: payment,
          bookingId: chosen === 'with_booking' ? bookingId : null,
          shipping: ship ? { ...addr, postalCode: addr.postalCode || null, regionId: region?.id ?? null, regionLabel: region?.label ?? null } : null,
          rate: chosen === 'ship_auto' && rate ? { courier: rate.courier, service: rate.service } : null,
          note: note || null,
          turnstileToken: token,
        },
      });
      clear();
      window.location.assign(`/pesanan/${r.order.id}?baru=1${r.fallbackToManual ? '&manual=1' : ''}`);
    } catch (err) {
      setBusy(false);
      setResetKey((k) => k + 1);
      setToken('');
      if (err instanceof ApiClientError && err.status === 401) window.location.assign(loginUrl());
      else {
        setError(errorMessage(err));
        if (err instanceof ApiClientError && err.details?.fields) setFields(err.details.fields);
      }
    }
  }

  return (
    <CheckoutShell>
      <form onSubmit={submit} noValidate className={bookingStyles.stack}>
        {error && <Alert tone="danger" role="alert">{error}</Alert>}
        <section className={bookingStyles.section} aria-labelledby="ringkasan-title">
          <h2 id="ringkasan-title" className={bookingStyles.h2}>
            Pesanan · {branch?.name}
          </h2>
          {quoteError && <Alert tone="danger">{quoteError}</Alert>}
          {!quote ? (
            <Loading count={1} label="Menghitung…" />
          ) : (
            <Card tone="light" padding="md">
              {!quote.ok && <Alert tone="warning">Ada produk yang perlu disesuaikan. Ubah di keranjang.</Alert>}
              <ul className={styles.lines}>
                {quote.lines.map((l) => (
                  <li key={l.variantId} className={styles.line}>
                    <Thumb className={styles.lineImg} path={l.image} />
                    <div className={styles.lineMain}>
                      <span className={styles.lineName}>
                        {l.qty}× {l.productName}
                      </span>
                      <span className={styles.lineMeta}>
                        {l.variantName} · {rupiah(l.lineTotal)}
                      </span>
                      {l.error && <span className={styles.lineError}>{l.error}</span>}
                    </div>
                  </li>
                ))}
              </ul>
              <dl className={styles.totals}>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{rupiah(quote.subtotal)}</dd>
                </div>
                <div>
                  <dt>Ongkir</dt>
                  <dd>{shippingFee === null ? (chosen === 'ship_auto' ? 'Pilih kurir' : 'Dikonfirmasi admin') : rupiah(shippingFee)}</dd>
                </div>
                {branch?.payment.uniqueCode && chosen !== 'with_booking' && (
                  <div>
                    <dt>Kode unik</dt>
                    <dd>+ Rp 1–999</dd>
                  </div>
                )}
                <div className={styles.grand}>
                  <dt>Total</dt>
                  <dd>{total === null ? '-' : shippingFee === null ? `${rupiah(total)} + ongkir` : rupiah(total)}</dd>
                </div>
              </dl>
            </Card>
          )}
        </section>

        <section className={bookingStyles.section} aria-labelledby="terima-title">
          <h2 id="terima-title" className={bookingStyles.h2}>
            Cara terima
          </h2>
          {options.length === 0 ? (
            <Alert tone="warning">Cabang ini belum menerima pesanan toko.</Alert>
          ) : (
            <ul className={bookingStyles.options}>
              {options.map((f) => (
                <li key={f}>
                  <button type="button" className={bookingStyles.option} aria-pressed={chosen === f} onClick={() => setFulfillment(f)}>
                    <span className={bookingStyles.optionMain}>
                      <span className={bookingStyles.optionTitle}>{FULFILLMENT_TEXT[f].title}</span>
                      <span className={bookingStyles.optionMeta}>{f === 'pickup' ? `${FULFILLMENT_TEXT[f].meta} (batas ambil ${config.pickupWindowDays} hari)` : FULFILLMENT_TEXT[f].meta}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {chosen === 'with_booking' && (
          <section className={bookingStyles.section} aria-labelledby="booking-title">
            <h2 id="booking-title" className={bookingStyles.h2}>
              Booking
            </h2>
            {!bookings ? (
              <Loading count={1} />
            ) : branchBookings.length === 0 ? (
              <EmptyState icon="calendar" title="Belum ada booking aktif di cabang ini" compact action={<Button href="/booking/" variant="dark" size="sm" icon="scissors">Booking dulu</Button>} />
            ) : (
              <ul className={bookingStyles.options}>
                {branchBookings.map((b) => (
                  <li key={b.id}>
                    <button type="button" className={bookingStyles.option} aria-pressed={bookingId === b.id} onClick={() => setBookingId(b.id)}>
                      <span className={bookingStyles.optionMain}>
                        <span className={bookingStyles.optionTitle}>
                          {longDate(b.startAt, b.timezone)} · {clock(b.startAt, b.timezone)}
                        </span>
                        <span className={bookingStyles.optionMeta}>
                          {b.service.name} · {b.code}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {ship && (
          <section className={bookingStyles.section} aria-labelledby="alamat-title">
            <h2 id="alamat-title" className={bookingStyles.h2}>
              Alamat pengiriman
            </h2>
            <FieldGrid>
              <Field label="Nama penerima" error={fields['shipping.recipientName']}>
                <Input value={addr.recipientName} onChange={(e) => setAddr({ ...addr, recipientName: e.target.value })} autoComplete="name" required />
              </Field>
              <Field label="Nomor HP penerima" error={fields['shipping.recipientPhone']}>
                <Input value={addr.recipientPhone} onChange={(e) => setAddr({ ...addr, recipientPhone: e.target.value })} inputMode="tel" autoComplete="tel" required />
              </Field>
            </FieldGrid>
            {chosen === 'ship_auto' && <RegionPicker value={region} onChange={(r) => { setRegion(r); setRate(null); }} />}
            <Field label="Alamat lengkap" hint="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota" error={fields['shipping.address']}>
              <Textarea value={addr.address} onChange={(e) => setAddr({ ...addr, address: e.target.value })} rows={3} autoComplete="street-address" required />
            </Field>
            <Field label="Kode pos (opsional)">
              <Input value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} inputMode="numeric" autoComplete="postal-code" maxLength={10} />
            </Field>
            {chosen === 'ship_auto' && region && (
              <div>
                <p className={bookingStyles.hint}>Kurir</p>
                {!quote?.rates ? (
                  <Alert tone="info">Ongkir otomatis sedang tidak tersedia. Pesanan tetap bisa dibuat; admin akan mengonfirmasi ongkir.</Alert>
                ) : (
                  <ul className={bookingStyles.options}>
                    {quote.rates.map((r) => (
                      <li key={`${r.courier}-${r.service}`}>
                        <button type="button" className={bookingStyles.option} aria-pressed={rate?.courier === r.courier && rate.service === r.service} onClick={() => setRate(r)}>
                          <span className={bookingStyles.optionMain}>
                            <span className={bookingStyles.optionTitle}>
                              {r.courierName} {r.service}
                            </span>
                            <span className={bookingStyles.optionMeta}>{r.etd ? `Estimasi ${r.etd}` : r.description}</span>
                          </span>
                          <span className={bookingStyles.optionAside}>{rupiah(r.cost)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {chosen && chosen !== 'with_booking' && (
          <section className={bookingStyles.section} aria-labelledby="bayar-title">
            <h2 id="bayar-title" className={bookingStyles.h2}>
              Pembayaran
            </h2>
            <ul className={bookingStyles.options}>
              <li>
                <button type="button" className={bookingStyles.option} aria-pressed={payment === 'transfer'} onClick={() => setPayment('transfer')}>
                  <span className={bookingStyles.optionMain}>
                    <span className={bookingStyles.optionTitle}>Transfer bank</span>
                    <span className={bookingStyles.optionMeta}>Konfirmasi manual oleh admin cabang</span>
                  </span>
                </button>
              </li>
              {branch?.payment.qris && (
                <li>
                  <button type="button" className={bookingStyles.option} aria-pressed={payment === 'qris'} onClick={() => setPayment('qris')}>
                    <span className={bookingStyles.optionMain}>
                      <span className={bookingStyles.optionTitle}>QRIS</span>
                      <span className={bookingStyles.optionMeta}>Scan QR cabang, bayar nominal persis</span>
                    </span>
                  </button>
                </li>
              )}
            </ul>
            <p className={bookingStyles.hint}>
              {chosen === 'ship_manual' ? 'Instruksi bayar muncul setelah admin mengisi ongkir.' : `Bayar dalam ${Math.round(config.paymentWindowMin / 60)} jam setelah pesanan dibuat; lewat dari itu pesanan batal otomatis.`}
            </p>
          </section>
        )}

        <Field label="Catatan (opsional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} />
        </Field>
        <Turnstile siteKey={auth?.turnstileSiteKey ?? null} onToken={setToken} resetKey={resetKey} />
        <Button type="submit" variant="dark" block size="lg" icon="check" disabled={busy || !ready || !auth}>
          {busy ? 'Memproses…' : 'Buat pesanan'}
        </Button>
        {quote && quote.subtotal >= config.stampMinSubtotal && <p className={`${bookingStyles.hint} ${bookingStyles.center}`}>Belanja ini dapat 1 stempel Cutless Stamp saat selesai.</p>}
      </form>
    </CheckoutShell>
  );
}

/** Pencarian kecamatan tujuan (hasil dari cache D1 bila pernah dicari) */
function RegionPicker({ value, onChange }: { value: { id: string; label: string } | null; onChange: (r: { id: string; label: string } | null) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api<{ regions: { id: string; label: string }[] }>(`/shop/regions?q=${encodeURIComponent(q.trim())}`)
        .then((r) => setResults(r.regions))
        .catch(() => setResults([]));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  if (value) {
    return (
      <p className={bookingStyles.hint}>
        Kecamatan: <strong>{value.label}</strong>{' '}
        <button type="button" className={bookingStyles.inlineBtn} onClick={() => onChange(null)}>
          Ganti
        </button>
      </p>
    );
  }
  return (
    <div>
      <Field label="Kecamatan / kota tujuan" hint="Ketik minimal 3 huruf, mis. Tanah Sareal">
        <Input value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </Field>
      {results.length > 0 ? (
        <ul className={bookingStyles.options}>
          {results.slice(0, 8).map((r) => (
            <li key={r.id}>
              <button type="button" className={bookingStyles.option} onClick={() => onChange(r)}>
                <span className={bookingStyles.optionMain}>
                  <span className={bookingStyles.optionTitle}>{r.label}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
