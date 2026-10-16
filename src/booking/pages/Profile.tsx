import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { formatPhone } from '@/app/format';
import { Button } from '@/components/ui/Button';
import { Page, Loading } from '../Page';
import { loginUrl, nextParam, useMe } from '../hooks';
import styles from '../booking.module.css';

const PHONE_NOTE = 'Nomor ini tidak diverifikasi otomatis. Cabang dapat menghubungi nomor tersebut via WhatsApp untuk konfirmasi booking.';

/** /profil/lengkapi: wajib setelah login pertama sebelum bisa booking */
export function CompleteProfile() {
  const { loading, me } = useMe();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = nextParam();

  useEffect(() => {
    if (loading) return;
    if (!me) window.location.replace(loginUrl());
    else {
      setName(me.name ?? '');
      setPhone(me.phone ? formatPhone(me.phone) : '');
    }
  }, [loading, me]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/me/profile', { method: 'POST', json: { name, phone, privacyConsent: consent } });
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (loading || !me) return <Page id="lengkapi" title="Lengkapi profil"><Loading /></Page>;

  return (
    <Page id="lengkapi" kicker="Satu langkah lagi" title="Lengkapi profil" lead="Nama dan nomor WhatsApp dipakai cabang untuk mengenali dan menghubungi Anda.">
      <form onSubmit={submit} noValidate>
        {error && (
          <p className={styles.alert} data-tone="error" role="alert">
            {error}
          </p>
        )}
        <div className={styles.field}>
          <label htmlFor="p-name">Nama</label>
          <input id="p-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
        </div>
        <div className={styles.field}>
          <label htmlFor="p-phone">Nomor WhatsApp</label>
          <input id="p-phone" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <span className={styles.hint}>{PHONE_NOTE}</span>
        </div>
        <label className={styles.check}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Saya menyetujui{' '}
            <a href="/kebijakan-privasi" target="_blank" rel="noopener">
              Kebijakan Privasi
            </a>{' '}
            Cutless Hair Studio, termasuk penyimpanan nama, email, nomor WhatsApp, dan riwayat booking saya.
          </span>
        </label>
        <Button type="submit" variant="dark" block size="lg" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan & lanjut booking'}
        </Button>
      </form>
    </Page>
  );
}

/** /profil: ubah nama/nomor, keluar, hapus akun */
export function Profile() {
  const { loading, me } = useMe();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!me) window.location.replace(loginUrl());
    else if (!me.profileComplete) window.location.replace(`/profil/lengkapi?next=${encodeURIComponent('/profil')}`);
    else {
      setName(me.name);
      setPhone(me.phone ? formatPhone(me.phone) : '');
    }
  }, [loading, me]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api('/me/profile', { method: 'PATCH', json: { name, phone } });
      setMsg({ tone: 'ok', text: 'Profil tersimpan.' });
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/');
  };

  const remove = async () => {
    const ok = window.confirm(
      'Hapus akun?\n\nNama, email, dan nomor WhatsApp Anda akan dihapus. Booking yang akan datang dibatalkan. Riwayat booking tetap tersimpan tanpa data pribadi untuk laporan cabang.',
    );
    if (!ok) return;
    try {
      await api('/me', { method: 'DELETE' });
      window.location.assign('/?akun=dihapus');
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    }
  };

  if (loading || !me?.profileComplete) return <Page id="profil" title="Profil saya"><Loading /></Page>;

  return (
    <Page id="profil" kicker="Akun" title="Profil saya" lead={me.email ? `Masuk sebagai ${me.email}` : undefined}>
      <div className={styles.actions}>
        <Button href="/booking/saya" variant="dark" iconEnd="arrow">
          Booking saya
        </Button>
        <Button href="/booking/" variant="outline-dark">
          Booking baru
        </Button>
      </div>
      <form onSubmit={save} noValidate className={styles.summary}>
        <h2 className={styles.h2}>Data diri</h2>
        {msg && (
          <p className={styles.alert} data-tone={msg.tone} role={msg.tone === 'error' ? 'alert' : 'status'}>
            {msg.text}
          </p>
        )}
        <div className={styles.field}>
          <label htmlFor="pr-name">Nama</label>
          <input id="pr-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="pr-phone">Nomor WhatsApp</label>
          <input id="pr-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <span className={styles.hint}>{PHONE_NOTE}</span>
        </div>
        <Button type="submit" variant="dark" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan perubahan'}
        </Button>
      </form>
      <div className={styles.actions}>
        <button type="button" className={styles.textBtn} onClick={logout}>
          Keluar
        </button>
        <button type="button" className={`${styles.textBtn} ${styles.danger}`} onClick={remove}>
          Hapus akun saya
        </button>
      </div>
    </Page>
  );
}
