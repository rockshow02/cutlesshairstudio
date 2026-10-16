import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { Button } from '@/components/ui/Button';
import { Page, Loading } from '../Page';
import { Turnstile } from '../Turnstile';
import { nextParam, useAuthConfig } from '../hooks';
import styles from '../booking.module.css';

const ERRORS: Record<string, string> = {
  dibatalkan: 'Login dibatalkan. Silakan coba lagi.',
  sesi: 'Sesi login kedaluwarsa. Silakan coba lagi.',
  google: 'Login Google gagal. Silakan coba lagi.',
  email: 'Email Google Anda belum terverifikasi. Gunakan akun Google lain.',
};

/** /masuk: login wajib sebelum booking (Google). Pilihan booking dibawa lewat ?next= */
export function Login() {
  const config = useAuthConfig();
  const next = nextParam();
  const error = ERRORS[new URLSearchParams(window.location.search).get('error') ?? ''];

  return (
    <Page id="masuk" kicker="Booking online" title="Masuk untuk booking" lead="Pakai akun Google, tanpa password baru. Pilihan cabang dan layanan Anda tetap tersimpan.">
      {error && (
        <p className={styles.alert} data-tone="error" role="alert">
          {error}
        </p>
      )}
      {!config ? (
        <Loading />
      ) : (
        <>
          {config.google ? (
            <div className={styles.actions}>
              <Button href={`/api/auth/google?next=${encodeURIComponent(next)}`} variant="dark" icon="google" size="lg">
                Masuk dengan Google
              </Button>
            </div>
          ) : (
            <p className={styles.alert} data-tone="warn">
              Login Google belum dikonfigurasi di server ini.
            </p>
          )}
          {config.phonePassword && <PhoneLogin next={next} siteKey={config.turnstileSiteKey} />}
          {config.mock && <MockLogin next={next} />}
          <p className={styles.hint}>
            Dengan masuk, Anda menyetujui{' '}
            <a className={styles.link} href="/kebijakan-privasi">
              Kebijakan Privasi
            </a>
            . Lebih suka chat? Booking juga bisa langsung via WhatsApp cabang.
          </p>
        </>
      )}
    </Page>
  );
}

/** Login nomor WA + password (hanya tampil bila fitur diaktifkan di server) */
function PhoneLogin({ next, siteKey }: { next: string; siteKey: string | null }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/phone', { method: 'POST', json: { phone, password, turnstileToken: token } });
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(err));
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={styles.summary}>
      <h2 className={styles.h2}>Atau masuk dengan nomor WhatsApp</h2>
      {error && (
        <p className={styles.alert} data-tone="error" role="alert">
          {error}
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor="login-phone">Nomor WhatsApp</label>
        <input id="login-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </div>
      <div className={styles.field}>
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <span className={styles.hint}>Lupa password? Hubungi cabang untuk reset.</span>
      </div>
      <Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetKey} />
      <Button type="submit" variant="dark" block disabled={busy}>
        {busy ? 'Memproses…' : 'Masuk'}
      </Button>
    </form>
  );
}

/** Login uji (lokal/staging saja, untuk tes E2E). Tidak pernah tampil di produksi. */
function MockLogin({ next }: { next: string }) {
  const [email, setEmail] = useState('budi@test.local');
  const [secret, setSecret] = useState('');
  const href = `/api/auth/mock?${new URLSearchParams({ email, next, ...(secret ? { secret } : {}) })}`;
  return (
    <div className={styles.summary}>
      <h2 className={styles.h2}>Login uji (khusus staging/lokal)</h2>
      <div className={styles.field}>
        <label htmlFor="mock-email">Email uji</label>
        <input id="mock-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label htmlFor="mock-secret">Secret (staging)</label>
        <input id="mock-secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
      </div>
      <Button href={href} variant="outline-dark" block>
        Masuk sebagai pengguna uji
      </Button>
    </div>
  );
}
