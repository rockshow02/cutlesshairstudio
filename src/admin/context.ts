import { createContext, useContext } from 'react';
import type { BookingStatus } from '@shared/booking';

export interface AdminMe {
  admin: { email: string; name: string | null; role: 'owner' | 'branch_admin' | 'barber'; branch_id: number | null; barber_id: number | null };
  branches: { id: number; slug: string; name: string; timezone: string; status: string }[];
  barbers: { id: number; branch_id: number; name: string; is_active: number; sort_order: number }[];
  features: { phonePassword: boolean };
}

export interface AdminBooking {
  id: string;
  code: string;
  branch_id: number;
  branch_name: string;
  timezone: string;
  barber_id: number;
  barber_name: string;
  service_id: number;
  service_name_snapshot: string;
  duration_snapshot: number;
  price_snapshot: number;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_is_guest: number;
  customer_no_show: number;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  source: 'online' | 'walk_in' | 'admin';
  customer_note: string | null;
  admin_note: string | null;
  created_at: string;
  cancel_reason: string | null;
  cancelled_by: string | null;
}

export const AdminContext = createContext<AdminMe | null>(null);
export const useAdmin = () => useContext(AdminContext)!;

export const ROLE_LABEL = { owner: 'Owner', branch_admin: 'Admin cabang', barber: 'Hairstylist' } as const;
export const SOURCE_LABEL = { online: 'Online', walk_in: 'Walk-in', admin: 'Telepon/Admin' } as const;
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
