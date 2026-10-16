import type { BookingStatus } from '@shared/booking';

export interface BookingBranch {
  id: number;
  slug: string;
  name: string;
  city: string;
  address: string | null;
  timezone: string;
  status: 'active' | 'coming_soon' | 'closed';
  whatsapp: string;
  booking_lead_min: number;
  booking_max_days: number;
  cancel_deadline_min: number;
  require_manual_confirmation: boolean;
  bookable: boolean;
  dates: string[];
}

export interface BookingService {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  duration_min: number;
  price: number;
  price_from: boolean;
}

export interface BookingBarber {
  id: number;
  name: string;
  role: string | null;
  photo: string | null;
  specialty: string | null;
}

/** Booking milik pelanggan (respons /api/bookings, /api/me/bookings) */
export interface CustomerBooking {
  id: string;
  code: string;
  status: BookingStatus;
  statusLabel: string;
  startAt: string;
  endAt: string;
  timezone: string;
  service: { id: number; name: string; durationMin: number; price: number };
  barber: { id: number; name: string };
  branch: { slug: string; name: string; address: string | null; whatsapp: string; mapsUrl: string | null };
  note: string | null;
  createdAt: string;
  cancelledBy: 'customer' | 'admin' | 'system' | null;
  cancelReason: string | null;
  active: boolean;
  canManage: boolean;
  cancelDeadlineMin: number;
}
