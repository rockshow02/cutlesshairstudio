/** Status program Cutless Stamp untuk dashboard (satu permintaan per halaman). */
import { useEffect, useState } from 'react';
import { api } from '@/app/api';
import { useAdmin } from './context';

/* ---------- Status program (cache per halaman) ---------- */

export interface LoyaltySettingsData {
  enabled: boolean;
  tier1_stamps: number;
  tier1_service_ids: number[];
  tier2_stamps: number;
  tier2_service_ids: number[];
  stamp_valid_months: number;
  voucher_valid_days: number;
  updated_at: string;
  updated_by: string | null;
}

let statusPromise: Promise<{ available: boolean; settings: LoyaltySettingsData | null }> | null = null;
/** true bila program aktif (env + pengaturan). Barber tidak memakai fitur ini. */
export function useLoyaltyActive(): boolean {
  const me = useAdmin();
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (me.admin.role === 'barber') return;
    statusPromise ??= api<{ available: boolean; settings: LoyaltySettingsData | null }>('/admin/loyalty/settings').catch(() => ({ available: false, settings: null }));
    let alive = true;
    void statusPromise.then((s) => alive && setActive(s.available && Boolean(s.settings?.enabled)));
    return () => {
      alive = false;
    };
  }, [me.admin.role]);
  return active;
}
export const resetLoyaltyStatus = () => {
  statusPromise = null;
};
