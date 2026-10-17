import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
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
      {error && <Alert tone="danger">{error}</Alert>}
      {!config ? (
        <Loading />
      ) : (
        <>
          <Card tone="outline" as="div" padding="lg">
            {config.google ? (
              <Button href={`/api/auth/google?next=${encodeURIComponent(next)}`} variant="dark" icon="google" size="lg" block>
                Masuk dengan Google
              </Button>
            ) : (
              <Alert tone="warning" role="none">
                Login Google belum dikonfigurasi di server ini.
              </Alert>
            )}
            <p className={`${styles.hint} ${styles.loginNote}`}>
              Dengan masuk, Anda menyetujui{' '}
              <a className={styles.link} href="/kebijakan-privasi">
                Kebijakan Privasi
              </a>
              . Lebih suka chat? Booking juga bisa langsung via WhatsApp cabang.
            </p>
          </Card>
          {config.phonePassword && <PhoneLogin next={next} siteKey={config.turnstileSiteKey} />}
          {config.mock && <MockLogin next={next} />}
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
    <Card tone="outline" as="form" padding="lg" onSubmit={submit} className={styles.section}>
      <h2 className={styles.h2}>Atau masuk dengan nomor WhatsApp</h2>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Nomor WhatsApp">
        <Input id="login-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </Field>
      <Field label="Password" hint="Lupa password? Hubungi cabang untuk reset.">
        <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetKey} />
      <Button type="submit" variant="dark" block disabled={busy}>
        {busy ? 'Memproses…' : 'Masuk'}
      </Button>
    </Card>
  );
}

/** Login uji (lokal/staging saja, untuk tes E2E). Tidak pernah tampil di produksi. */
function MockLogin({ next }: { next: string }) {
  const [email, setEmail] = useState('budi@test.local');
  const [secret, setSecret] = useState('');
  const href = `/api/auth/mock?${new URLSearchParams({ email, next, ...(secret ? { secret } : {}) })}`;
  return (
    <Card tone="outline" as="div" padding="lg" className={styles.section}>
      <h2 className={styles.h2}>Login uji (khusus staging/lokal)</h2>
      <Field label="Email uji">
        <Input id="mock-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Secret (staging)">
        <Input id="mock-secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
      </Field>
      <Button href={href} variant="outline-dark" block>
        Masuk sebagai pengguna uji
      </Button>
    </Card>
  );
}
