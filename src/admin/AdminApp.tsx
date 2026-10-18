import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, Skeleton, SkeletonList } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { ToastProvider } from '@/components/ui/Toast';
import { AdminContext, ROLE_LABEL, type AdminMe } from './context';
import { Schedule } from './Schedule';
import { WalkIn } from './WalkIn';
import { Customers } from './Customers';
import { Summary } from './Summary';
import { TimeOff } from './TimeOff';
import { Settings } from './Settings';
import { Shop } from './shop/Shop';
import styles from './admin.module.css';

type TabId = 'jadwal' | 'baru' | 'pelanggan' | 'toko' | 'ringkasan' | 'libur' | 'pengaturan';
const TABS: { id: TabId; label: string; roles: AdminMe['admin']['role'][]; feature?: 'shop' }[] = [
  { id: 'jadwal', label: 'Jadwal', roles: ['owner', 'branch_admin', 'barber'] },
  { id: 'baru', label: 'Booking baru', roles: ['owner', 'branch_admin'] },
  { id: 'pelanggan', label: 'Pelanggan', roles: ['owner', 'branch_admin'] },
  { id: 'toko', label: 'Toko', roles: ['owner', 'branch_admin'], feature: 'shop' },
  { id: 'ringkasan', label: 'Ringkasan & ekspor', roles: ['owner', 'branch_admin'] },
  { id: 'libur', label: 'Libur & cuti', roles: ['owner', 'branch_admin', 'barber'] },
  { id: 'pengaturan', label: 'Pengaturan', roles: ['owner', 'branch_admin'] },
];

const readTab = (): TabId => (window.location.hash.slice(1) as TabId) || 'jadwal';

/**
 * Keluar dari Cloudflare Access (endpoint resmi per aplikasi). Lokal tidak memakai Access
 * (ADMIN_DEV_EMAIL), jadi cukup kembali ke beranda.
 */
const LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const LOGOUT_URL = LOCAL ? '/' : '/cdn-cgi/access/logout';

function Brand() {
  return (
    <a className={styles.brand} href="/">
      <img src="/images/brand/cutless-logo-horizontal-white.png" alt="Cutless Hair Studio" width={130} height={24} />
      <span className={styles.brandTag}>Admin</span>
    </a>
  );
}

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
        <header className={styles.top}>
          <div className={styles.topBar}>
            <Brand />
          </div>
        </header>
        <main className={styles.gate}>
          <Card tone="outline" as="div" padding="lg" className={styles.gateCard}>
            <h1 className={styles.panelTitle}>Dashboard admin</h1>
            <Alert tone="danger">{error}</Alert>
            <p className={styles.muted}>Masuk lewat Cloudflare Access memakai email yang didaftarkan owner. Bila email sudah benar, coba muat ulang halaman.</p>
            <div className={styles.formActions}>
              <Button href="/admin" variant="dark" casing="normal" icon="arrow">
                Muat ulang
              </Button>
              <Button href="/" variant="text" casing="normal">
                Ke beranda
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (!me) {
    return (
      <div className={styles.app} aria-busy="true">
        <header className={styles.top}>
          <div className={styles.topBar}>
            <Brand />
          </div>
        </header>
        <main className={styles.main}>
          <Skeleton width="12rem" height={28} className={styles.loadingTitle} />
          <SkeletonList label="Memuat dashboard…" count={3} height={96} />
        </main>
      </div>
    );
  }

  const tabs = TABS.filter((t) => t.roles.includes(me.admin.role) && (!t.feature || me.features[t.feature]));
  const active = tabs.some((t) => t.id === tab) ? tab : 'jadwal';
  const branchName = me.admin.branch_id ? me.branches.find((b) => b.id === me.admin.branch_id)?.name ?? '' : 'Semua cabang';

  return (
    <AdminContext.Provider value={me}>
      <ToastProvider>
        <div className={styles.app}>
          <header className={styles.top}>
            <div className={styles.topBar}>
              <Brand />
              <div className={styles.who}>
                <p className={styles.whoText}>
                  <span className={styles.whoName}>{me.admin.name ?? me.admin.email}</span>
                  <span className={styles.whoRole}>
                    {ROLE_LABEL[me.admin.role]} · {branchName}
                  </span>
                </p>
                <a className={styles.logout} href={LOGOUT_URL}>
                  <Icon name="logout" size={16} />
                  Keluar
                </a>
              </div>
            </div>
            <nav className={styles.tabs} aria-label="Menu admin">
              <div className={styles.tabList}>
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
              </div>
            </nav>
          </header>
          <main className={styles.main} id="main">
            {active === 'jadwal' && <Schedule />}
            {active === 'baru' && <WalkIn />}
            {active === 'pelanggan' && <Customers />}
            {active === 'toko' && <Shop />}
            {active === 'ringkasan' && <Summary />}
            {active === 'libur' && <TimeOff />}
            {active === 'pengaturan' && <Settings />}
          </main>
        </div>
      </ToastProvider>
    </AdminContext.Provider>
  );
}
