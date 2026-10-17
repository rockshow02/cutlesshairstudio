/** Cutless Stamp: tipe respons API & hook info program (dipakai halaman pelanggan & admin). */
import { useEffect, useState } from 'react';
import { api } from './api';

export interface LoyaltyProgram {
  enabled: boolean;
  tier1?: { stamps: number; services: string[] };
  tier2?: { stamps: number; services: string[] };
  stampValidMonths?: number;
  voucherValidDays?: number;
}

export interface LoyaltyCard {
  stamps: number;
  cycle: number;
  tier1: number;
  tier2: number;
  next: { tier: 1 | 2; remaining: number } | null;
}

export interface LoyaltyVoucher {
  id: string;
  code: string;
  tier: 1 | 2;
  status: 'active' | 'redeemed' | 'expired';
  serviceIds: number[];
  services: string[];
  issuedAt: string;
  expiresAt: string;
  redeemedBookingId: string | null;
  redeemedAt: string | null;
  bookingCode?: string | null;
}

export interface LoyaltyStamp {
  id: string;
  stamp_date: string;
  status: 'active' | 'used' | 'expired' | 'removed';
  kind: 'booking' | 'manual';
  created_at: string;
  expires_at: string;
  branch_name: string | null;
  service_name: string | null;
  reason?: string | null;
  created_by?: string | null;
  booking_code?: string | null;
}

export type MyLoyalty = { enabled: false } | { enabled: true; card: LoyaltyCard; vouchers: LoyaltyVoucher[] };

/** Gabung nama layanan hadiah: "Hair Wash & Styling atau Hot Towel Shave" */
export const rewardText = (services: string[] | undefined) => (services?.length ? services.join(' atau ') : 'layanan hadiah');

let programPromise: Promise<LoyaltyProgram> | null = null;
/** Info program (publik, di-cache di memori selama halaman terbuka) */
export function useLoyaltyProgram(): LoyaltyProgram | null {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  useEffect(() => {
    programPromise ??= api<LoyaltyProgram>('/loyalty/program').catch(() => ({ enabled: false }));
    let alive = true;
    void programPromise.then((p) => alive && setProgram(p));
    return () => {
      alive = false;
    };
  }, []);
  return program;
}

/** Kartu & voucher pelanggan yang login (null = memuat; enabled false = program mati) */
export function useMyLoyalty(reloadKey = 0): MyLoyalty | null {
  const [data, setData] = useState<MyLoyalty | null>(null);
  useEffect(() => {
    let alive = true;
    api<MyLoyalty>('/me/loyalty')
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ enabled: false }));
    return () => {
      alive = false;
    };
  }, [reloadKey]);
  return data;
}

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
export const shortDay = (iso: string) => dateFmt.format(new Date(iso));

/** Teks progres: "7/10 · 3 lagi Signature Haircut gratis" */
export function progressText(card: LoyaltyCard, program: LoyaltyProgram | null) {
  if (!card.next) return `${card.stamps}/${card.tier2}`;
  const reward = rewardText(card.next.tier === 1 ? program?.tier1?.services : program?.tier2?.services);
  return card.next.remaining > 0 ? `${card.next.remaining} lagi ${reward} gratis` : `Hadiah ${reward} sudah terbit`;
}
