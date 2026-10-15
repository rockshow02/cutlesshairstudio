/** Jenis pengumuman. Sama dengan enum `type` di CMS. */
export type AnnouncementType = 'Info' | 'Tutup' | 'Jam Khusus';

/** Bar tipis di atas navbar (CMS: collection type Announcement, Draft & Publish). */
export interface Announcement {
  id: string;
  /** Maks. 160 karakter */
  message: string;
  type: AnnouncementType;
  startDate?: string;
  endDate?: string;
  /** Dipakai sebagai kunci "sudah ditutup" — pengumuman yang diedit akan tampil lagi */
  updatedAt?: string;
}
