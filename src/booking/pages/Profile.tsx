import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { formatPhone } from '@/app/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { useConfirm } from '@/components/ui/useConfirm';
import { useToast } from '@/components/ui/toastContext';
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

  if (loading || !me) {
    return (
      <Page id="lengkapi" title="Lengkapi profil">
        <Loading count={2} />
      </Page>
    );
  }

  return (
    <Page id="lengkapi" kicker="Satu langkah lagi" title="Lengkapi profil" lead="Nama dan nomor WhatsApp dipakai cabang untuk mengenali dan menghubungi Anda.">
      <Card tone="outline" as="form" padding="lg" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Nama">
          <Input id="p-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
        </Field>
        <Field label="Nomor WhatsApp" hint={PHONE_NOTE}>
          <Input id="p-phone" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} className={styles.consent}>
          Saya menyetujui{' '}
          <a href="/kebijakan-privasi" target="_blank" rel="noopener">
            Kebijakan Privasi
          </a>{' '}
          Cutless Hair Studio, termasuk penyimpanan nama, email, nomor WhatsApp, dan riwayat booking saya.
        </Checkbox>
        <Button type="submit" variant="dark" block size="lg" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan & lanjut booking'}
        </Button>
      </Card>
    </Page>
  );
}

/** /profil: ubah nama/nomor, keluar, hapus akun */
export function Profile() {
  const { loading, me } = useMe();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, confirm] = useConfirm();
  const toast = useToast();

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
    setError('');
    try {
      await api('/me/profile', { method: 'PATCH', json: { name, phone } });
      toast('Profil tersimpan.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/');
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Hapus akun?',
      message: 'Nama, email, dan nomor WhatsApp Anda akan dihapus. Booking yang akan datang dibatalkan. Riwayat booking tetap tersimpan tanpa data pribadi untuk laporan cabang.',
      confirmLabel: 'Ya, hapus akun saya',
      cancelLabel: 'Batal',
      casing: 'upper',
    });
    if (ok === null) return;
    try {
      await api('/me', { method: 'DELETE' });
      window.location.assign('/?akun=dihapus');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (loading || !me?.profileComplete) {
    return (
      <Page id="profil" title="Profil saya">
        <Loading count={2} />
      </Page>
    );
  }

  return (
    <Page
      id="profil"
      kicker="Akun"
      title="Profil saya"
      lead={me.email ? `Masuk sebagai ${me.email}` : undefined}
      actions={
        <>
          <Button href="/booking/saya" variant="dark" iconEnd="arrow" size="sm">
            Booking saya
          </Button>
          <Button href="/booking/" variant="outline-dark" size="sm">
            Booking baru
          </Button>
        </>
      }
    >
      <Card tone="outline" as="form" padding="lg" onSubmit={save} noValidate>
        <h2 className={styles.h2}>Data diri</h2>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Nama">
          <Input id="pr-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Nomor WhatsApp" hint={PHONE_NOTE}>
          <Input id="pr-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Button type="submit" variant="dark" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan perubahan'}
        </Button>
      </Card>

      <section className={styles.section} aria-labelledby="akun-title">
        <h2 id="akun-title" className={styles.h2}>
          Akun
        </h2>
        <Card tone="outline" as="div">
          <div className={styles.dangerZone}>
            <p>Keluar dari perangkat ini. Booking Anda tetap tersimpan.</p>
            <Button variant="outline-dark" size="sm" icon="logout" onClick={logout}>
              Keluar
            </Button>
          </div>
          <hr className={styles.divider} />
          <div className={styles.dangerZone}>
            <p>Hapus akun beserta data pribadi Anda. Tindakan ini tidak bisa dibatalkan.</p>
            <Button variant="outline-danger" size="sm" onClick={remove}>
              Hapus akun saya
            </Button>
          </div>
        </Card>
      </section>
      {dialog}
    </Page>
  );
}
