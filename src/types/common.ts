/** Tipe dasar yang dipakai lintas konten. Acuan skema CMS (komponen/"block" bersama). */

/** Gambar. `src` bisa path lokal (/images/...) atau URL absolut dari CMS/CDN. */
export interface ImageAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Opsional: srcset responsif, mis. "/a-1280.jpg 1280w, /a-1920.jpg 1920w" */
  srcSet?: string;
  sizes?: string;
  /** Opsional: versi crop portrait untuk layar < 768px */
  mobileSrc?: string;
}

/** Judul section: kicker kecil + judul + intro opsional. */
export interface SectionHeading {
  kicker: string;
  title: string;
  intro?: string;
}

/** Aksi tombol: buka WhatsApp dengan pesan otomatis, atau tautan biasa/anchor. */
export type CtaAction =
  | {
      type: 'whatsapp';
      /** Nama layanan untuk mengisi template pesan {service} */
      service?: string;
      /** Pesan custom, menggantikan template */
      message?: string;
    }
  | { type: 'link'; href: string; external?: boolean };

export interface Cta {
  label: string;
  action: CtaAction;
}

/** Nama ikon yang tersedia di komponen <Icon>. Di CMS: field select/enum. */
export type IconName =
  | 'whatsapp' | 'instagram' | 'tiktok' | 'google' | 'star' | 'arrow' | 'pin' | 'clock'
  | 'navigate' | 'mail' | 'check' | 'menu' | 'close' | 'chevron-left' | 'chevron-right'
  | 'info' | 'alert' | 'tag' | 'play' | 'pause'
  | 'scissors' | 'wash' | 'kids' | 'shave' | 'color' | 'perm' | 'spa' | 'tattoo'
  // Aplikasi booking & admin (tidak dipakai di CMS)
  | 'calendar' | 'user' | 'filter' | 'logout' | 'search' | 'plus' | 'gift';
