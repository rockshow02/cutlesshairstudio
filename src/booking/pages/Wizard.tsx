import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiClientError, errorMessage } from '@/app/api';
import { clock, formatPhone, longDate, rupiah, tzLabel } from '@/app/format';
import { asset } from '@/lib/asset';
import type { Slot } from '@shared/slots';
import { Button } from '@/components/ui/Button';
import { Page, Loading } from '../Page';
import { SlotPicker } from '../SlotPicker';
import { Turnstile } from '../Turnstile';
import { completeProfileUrl, loginUrl, useAuthConfig, useMe, type Me } from '../hooks';
import type { BookingBarber, BookingBranch, BookingService, CustomerBooking } from '../types';
import styles from '../booking.module.css';

const STEPS = ['Cabang', 'Layanan', 'Hairstylist', 'Jadwal', 'Konfirmasi'];

/**
 * /booking: 1 cabang → 2 layanan → 3 hairstylist / Siapa saja → 4 tanggal & jam → 5 konfirmasi.
 * Pilihan disimpan di URL (?cabang=&layanan=&barber=&tanggal=), jadi tombol booking di landing page
 * dan kembali dari halaman login membawa pengguna ke langkah yang sama.
 */
export function Wizard() {
  const { loading, me } = useMe();

  useEffect(() => {
    if (loading) return;
    if (!me) window.location.replace(loginUrl());
    else if (!me.profileComplete) window.location.replace(completeProfileUrl());
  }, [loading, me]);

  if (loading || !me?.profileComplete) {
    return (
      <Page id="booking" kicker="Booking online" title="Booking jadwal">
        <Loading />
      </Page>
    );
  }
  return <WizardSteps me={me} />;
}

type Params = { cabang?: string; layanan?: string; barber?: string; tanggal?: string };

function readParams(): Params {
  const q = new URLSearchParams(window.location.search);
  const get = (k: string) => q.get(k) || undefined;
  return { cabang: get('cabang'), layanan: get('layanan'), barber: get('barber'), tanggal: get('tanggal') };
}

function WizardSteps({ me }: { me: Me }) {
  const [params, setParams] = useState<Params>(readParams);
  const [branches, setBranches] = useState<BookingBranch[] | null>(null);
  const [services, setServices] = useState<BookingService[] | null>(null);
  const [barbers, setBarbers] = useState<BookingBarber[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [error, setError] = useState('');

  // Simpan pilihan ke URL (riwayat browser: tombol Back kembali ke langkah sebelumnya)
  const update = (patch: Params, push = true) => {
    const nextParams = { ...params, ...patch };
    setParams(nextParams);
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(nextParams)) if (v) q.set(k, v);
    const url = `${window.location.pathname}?${q}`;
    if (push) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPop = () => {
      setParams(readParams());
      setSlot(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    api<{ branches: BookingBranch[] }>('/booking/branches')
      .then((r) => setBranches(r.branches))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const branch = branches?.find((b) => b.slug === params.cabang);

  useEffect(() => {
    setServices(null);
    if (!branch) return;
    api<{ services: BookingService[] }>(`/booking/services?branch=${branch.slug}`)
      .then((r) => setServices(r.services))
      .catch((e) => setError(errorMessage(e)));
  }, [branch]);

  // Layanan dari landing page bisa berupa slug, id, nama, atau kategori (mis. "Haircut")
  const serviceMatch = useMemo(() => {
    const p = params.layanan?.toLowerCase();
    if (!p || !services) return { service: undefined, category: undefined };
    const service = services.find((s) => s.slug === p || String(s.id) === p || s.name.toLowerCase() === p);
    const category = service ? undefined : services.find((s) => s.category.toLowerCase() === p || p.includes(s.category.toLowerCase()))?.category;
    return { service, category };
  }, [params.layanan, services]);
  const service = serviceMatch.service;

  useEffect(() => {
    setBarbers(null);
    if (!branch || !service) return;
    api<{ barbers: BookingBarber[] }>(`/booking/barbers?branch=${branch.slug}&service=${service.id}`)
      .then((r) => setBarbers(r.barbers))
      .catch((e) => setError(errorMessage(e)));
  }, [branch, service]);

  // Barber dari landing page: id, "any", atau nama
  const barberChoice = useMemo<'any' | BookingBarber | undefined>(() => {
    const p = params.barber;
    if (!p) return undefined;
    if (p === 'any') return 'any';
    return barbers?.find((b) => String(b.id) === p || b.name.toLowerCase() === p.toLowerCase());
  }, [params.barber, barbers]);

  const step = !branch ? 0 : !service ? 1 : !barberChoice ? 2 : !slot ? 3 : 4;
  const date = branch && params.tanggal && branch.dates.includes(params.tanggal) ? params.tanggal : branch?.dates[0];

  return (
    <Page id="booking" kicker="Booking online" title={STEPS[step] === 'Konfirmasi' ? 'Konfirmasi booking' : 'Booking jadwal'}>
      <ol className={styles.steps} aria-label="Langkah booking">
        {STEPS.map((label, i) => (
          <li key={label} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} aria-current={i === step ? 'step' : undefined}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {/* Pilihan sebelumnya: klik untuk mengubah */}
      {step > 0 && (
        <div className={styles.picked}>
          {branch && (
            <button type="button" className={styles.pickedItem} onClick={() => { setSlot(null); update({ cabang: undefined, layanan: undefined, barber: undefined, tanggal: undefined }); }}>
              {branch.name} <span>ubah</span>
            </button>
          )}
          {service && (
            <button type="button" className={styles.pickedItem} onClick={() => { setSlot(null); update({ layanan: undefined, barber: undefined }); }}>
              {service.name} <span>ubah</span>
            </button>
          )}
          {barberChoice && (
            <button type="button" className={styles.pickedItem} onClick={() => { setSlot(null); update({ barber: undefined }); }}>
              {barberChoice === 'any' ? 'Siapa saja' : barberChoice.name} <span>ubah</span>
            </button>
          )}
          {slot && branch && (
            <button type="button" className={styles.pickedItem} onClick={() => setSlot(null)}>
              {longDate(slot.startAt, branch.timezone)} · {clock(slot.startAt, branch.timezone)} <span>ubah</span>
            </button>
          )}
        </div>
      )}

      {error && (
        <p className={styles.alert} data-tone="error" role="alert">
          {error}
        </p>
      )}

      {step === 0 && <BranchStep branches={branches} onPick={(b) => update({ cabang: b.slug })} />}
      {step === 1 && (
        <ServiceStep
          services={services}
          category={serviceMatch.category}
          onPick={(s) => update({ layanan: s.slug })}
        />
      )}
      {step === 2 && <BarberStep barbers={barbers} onPick={(b) => update({ barber: b === 'any' ? 'any' : String(b.id) })} />}
      {step === 3 && branch && service && barberChoice && date && (
        <>
          <h2 className={styles.h2}>Pilih tanggal & jam ({tzLabel(branch.timezone)})</h2>
          <SlotPicker
            branch={branch.slug}
            service={service.id}
            barber={barberChoice === 'any' ? undefined : barberChoice.id}
            dates={branch.dates}
            date={date}
            onDate={(d) => update({ tanggal: d }, false)}
            onSelect={setSlot}
            emptyHint={
              barberChoice === 'any'
                ? 'Semua hairstylist penuh di tanggal ini. Coba tanggal lain.'
                : `${barberChoice.name} tidak tersedia di tanggal ini. Coba tanggal lain atau pilih "Siapa saja".`
            }
          />
        </>
      )}
      {step === 4 && branch && service && barberChoice && slot && (
        <Confirm
          me={me}
          branch={branch}
          service={service}
          barber={barberChoice}
          slot={slot}
          onPickSlot={(s) => setSlot(s)}
        />
      )}
    </Page>
  );
}

function BranchStep({ branches, onPick }: { branches: BookingBranch[] | null; onPick: (b: BookingBranch) => void }) {
  if (!branches) return <Loading />;
  return (
    <>
      <h2 className={styles.h2}>Pilih cabang</h2>
      <ul className={styles.options} data-cols="2">
        {branches.map((b) => (
          <li key={b.slug}>
            <button type="button" className={styles.option} disabled={!b.bookable} onClick={() => onPick(b)}>
              <span className={styles.avatarAny} aria-hidden="true">
                {b.city.charAt(0)}
              </span>
              <span className={styles.optionMain}>
                <span className={styles.optionTitle}>{b.name}</span>
                <span className={styles.optionMeta}>{b.address ?? b.city}</span>
              </span>
              {!b.bookable && (
                <span className={styles.badge} data-tone="warn">
                  {b.status === 'coming_soon' ? 'Segera dibuka' : 'Belum bisa booking'}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function ServiceStep({ services, category, onPick }: { services: BookingService[] | null; category?: string; onPick: (s: BookingService) => void }) {
  // Kategori dari landing page diterapkan sampai pengguna memilih "Tampilkan semua"
  const [showAll, setShowAll] = useState(false);
  const onlyCategory = Boolean(category) && !showAll;
  if (!services) return <Loading />;
  if (services.length === 0) return <p className={styles.empty}>Belum ada layanan yang bisa dibooking di cabang ini.</p>;
  const list = onlyCategory && category ? services.filter((s) => s.category === category) : services;
  const categories = [...new Set(list.map((s) => s.category))];
  return (
    <>
      <h2 className={styles.h2}>Pilih layanan</h2>
      {onlyCategory && category && (
        <p className={styles.hint}>
          Menampilkan kategori {category}.{' '}
          <button type="button" className={styles.textBtn} onClick={() => setShowAll(true)}>
            Tampilkan semua layanan
          </button>
        </p>
      )}
      {categories.map((cat) => (
        <div key={cat}>
          <p className={styles.categoryTitle}>{cat}</p>
          <ul className={styles.options}>
            {list
              .filter((s) => s.category === cat)
              .map((s) => (
                <li key={s.id}>
                  <button type="button" className={styles.option} onClick={() => onPick(s)}>
                    <span aria-hidden="true" />
                    <span className={styles.optionMain}>
                      <span className={styles.optionTitle}>{s.name}</span>
                      <span className={styles.optionMeta}>{s.description ?? `${s.duration_min} menit`}</span>
                    </span>
                    <span className={styles.optionAside}>
                      {s.price_from ? 'mulai ' : ''}
                      {rupiah(s.price)}
                      <small>±{s.duration_min} menit</small>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function BarberStep({ barbers, onPick }: { barbers: BookingBarber[] | null; onPick: (b: BookingBarber | 'any') => void }) {
  if (!barbers) return <Loading />;
  return (
    <>
      <h2 className={styles.h2}>Pilih hairstylist</h2>
      <ul className={styles.options} data-cols="2">
        <li>
          <button type="button" className={styles.option} onClick={() => onPick('any')}>
            <span className={styles.avatarAny} aria-hidden="true">
              ★
            </span>
            <span className={styles.optionMain}>
              <span className={styles.optionTitle}>Siapa saja</span>
              <span className={styles.optionMeta}>Jam paling banyak pilihan; hairstylist dipilihkan otomatis</span>
            </span>
          </button>
        </li>
        {barbers.map((b) => (
          <li key={b.id}>
            <button type="button" className={styles.option} onClick={() => onPick(b)}>
              {b.photo ? <img className={styles.avatar} src={asset(b.photo)} alt="" width={48} height={48} loading="lazy" /> : <span className={styles.avatarAny}>{b.name.charAt(0)}</span>}
              <span className={styles.optionMain}>
                <span className={styles.optionTitle}>{b.name}</span>
                <span className={styles.optionMeta}>{[b.role, b.specialty].filter(Boolean).join(' · ') || 'Hairstylist'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Confirm({
  me,
  branch,
  service,
  barber,
  slot,
  onPickSlot,
}: {
  me: Me;
  branch: BookingBranch;
  service: BookingService;
  barber: BookingBarber | 'any';
  slot: Slot;
  onPickSlot: (s: Slot) => void;
}) {
  const config = useAuthConfig();
  const [note, setNote] = useState('');
  const [token, setToken] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; alternatives?: Slot[] } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ booking: CustomerBooking }>('/bookings', {
        method: 'POST',
        json: { branch: branch.slug, service: service.id, barber: barber === 'any' ? 'any' : barber.id, startAt: slot.startAt, note: note || null, turnstileToken: token },
      });
      window.location.assign(`/booking/sukses?id=${r.booking.id}`);
    } catch (err) {
      const alternatives = err instanceof ApiClientError ? err.details?.alternatives : undefined;
      setError({ message: errorMessage(err), alternatives });
      setResetKey((k) => k + 1);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className={styles.summary}>
        <dl>
          <div><dt>Cabang</dt><dd>{branch.name}</dd></div>
          <div><dt>Layanan</dt><dd>{service.name} (±{service.duration_min} menit)</dd></div>
          <div><dt>Harga</dt><dd>{service.price_from ? 'mulai ' : ''}{rupiah(service.price)} <span className={styles.muted}>(bayar di cabang)</span></dd></div>
          <div><dt>Hairstylist</dt><dd>{barber === 'any' ? 'Siapa saja (dipilihkan otomatis)' : barber.name}</dd></div>
          <div><dt>Jadwal</dt><dd>{longDate(slot.startAt, branch.timezone)}, {clock(slot.startAt, branch.timezone)} {tzLabel(branch.timezone)}</dd></div>
          <div><dt>Nama</dt><dd>{me.name}</dd></div>
          <div><dt>WhatsApp</dt><dd>{me.phone ? formatPhone(me.phone) : '-'} <a className={styles.link} href={`/profil`}>ubah</a></dd></div>
        </dl>
      </div>
      {branch.require_manual_confirmation && (
        <p className={styles.alert} data-tone="warn">
          Cabang ini mengonfirmasi booking secara manual. Status awal "Menunggu konfirmasi"; pantau di halaman Booking saya.
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor="b-note">Catatan untuk hairstylist (opsional)</label>
        <textarea id="b-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. ingin model mid fade, rambut tebal" />
      </div>
      {error && (
        <div className={styles.alert} data-tone="error" role="alert">
          <p>{error.message}</p>
          {error.alternatives && error.alternatives.length > 0 && (
            <>
              <p>Jam terdekat yang masih tersedia:</p>
              <ul className={styles.slots}>
                {error.alternatives.map((s) => (
                  <li key={s.startAt}>
                    <button type="button" className={styles.slot} onClick={() => { onPickSlot(s); setError(null); }}>
                      {s.time.replace(':', '.')}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <Turnstile siteKey={config?.turnstileSiteKey ?? null} onToken={setToken} resetKey={resetKey} />
      <Button type="submit" variant="dark" block size="lg" icon="check" disabled={busy || !config || (Boolean(config.turnstileSiteKey) && !token)}>
        {busy ? 'Memproses…' : 'Konfirmasi booking'}
      </Button>
      <p className={`${styles.hint} ${styles.center}`} style={{ marginTop: 12 }}>
        Batal atau jadwal ulang online paling lambat {Math.round(branch.cancel_deadline_min / 60)} jam sebelum jadwal.
      </p>
    </form>
  );
}
