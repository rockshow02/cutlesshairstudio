import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { AdminContext, ROLE_LABEL, type AdminMe } from './context';
import { Schedule } from './Schedule';
import { WalkIn } from './WalkIn';
import { Customers } from './Customers';
import { Summary } from './Summary';
import { TimeOff } from './TimeOff';
import { Settings } from './Settings';
import styles from './admin.module.css';

type TabId = 'jadwal' | 'baru' | 'pelanggan' | 'ringkasan' | 'libur' | 'pengaturan';
const TABS: { id: TabId; label: string; roles: AdminMe['admin']['role'][] }[] = [
  { id: 'jadwal', label: 'Jadwal', roles: ['owner', 'branch_admin', 'barber'] },
  { id: 'baru', label: 'Booking baru', roles: ['owner', 'branch_admin'] },
  { id: 'pelanggan', label: 'Pelanggan', roles: ['owner', 'branch_admin'] },
  { id: 'ringkasan', label: 'Ringkasan & ekspor', roles: ['owner', 'branch_admin'] },
  { id: 'libur', label: 'Libur & cuti', roles: ['owner', 'branch_admin', 'barber'] },
  { id: 'pengaturan', label: 'Pengaturan', roles: ['owner', 'branch_admin'] },
];

const readTab = (): TabId => (window.location.hash.slice(1) as TabId) || 'jadwal';

export function AdminApp() {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>(readTab);

  useEffect(() => {
    api<AdminMe>('/admin/me')
      .then(setMe)
      .catch((e) => setError(errorMessage(e)));
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (error) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <h1 className={styles.h1}>Dashboard admin</h1>
          <p className={styles.alert} data-tone="error" role="alert">
            {error}
          </p>
          <p className={styles.muted}>Masuk lewat Cloudflare Access memakai email yang terdaftar oleh owner.</p>
        </main>
      </div>
    );
  }
  if (!me) return <p className={styles.muted} style={{ padding: 24 }}>Memuat dashboard…</p>;

  const tabs = TABS.filter((t) => t.roles.includes(me.admin.role));
  const active = tabs.some((t) => t.id === tab) ? tab : 'jadwal';

  return (
    <AdminContext.Provider value={me}>
      <div className={styles.app}>
        <header className={styles.top}>
          <a className={styles.brand} href="/">
            <img src="/images/brand/cutless-logo-horizontal-white.png" alt="Cutless Hair Studio" width={152} height={28} />
            <span>Admin</span>
          </a>
          <p className={styles.who}>
            <strong>{me.admin.name ?? me.admin.email}</strong>
            {ROLE_LABEL[me.admin.role]}
            {me.admin.branch_id ? ` · ${me.branches.find((b) => b.id === me.admin.branch_id)?.name ?? ''}` : ' · Semua cabang'}
          </p>
        </header>
        <nav className={styles.tabs} aria-label="Menu admin">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.tab}
              aria-current={active === t.id ? 'page' : undefined}
              onClick={() => {
                window.location.hash = t.id;
                setTab(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <main className={styles.main} id="main">
          {active === 'jadwal' && <Schedule />}
          {active === 'baru' && <WalkIn />}
          {active === 'pelanggan' && <Customers />}
          {active === 'ringkasan' && <Summary />}
          {active === 'libur' && <TimeOff />}
          {active === 'pengaturan' && <Settings />}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
