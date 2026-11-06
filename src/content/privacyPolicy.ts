/**
 * Halaman /kebijakan-privasi/: teks, path, & tanggal berlaku. Tanpa alias "@/" & tanpa Zod agar dipakai bersama oleh
 * halaman React, prerender build (scripts/vite-content-plugin.ts), dan tes. Isinya HANYA fakta tentang situs ini;
 * ubah teks ini bila cara situs memproses data berubah (mis. tambah penyedia analitik baru).
 */
export const PRIVACY_PATH = '/kebijakan-privasi/';
export const PRIVACY_LABEL = 'Kebijakan Privasi';
/** Tanggal berlaku (perbarui bersama isi kebijakan) */
export const PRIVACY_EFFECTIVE = { iso: '2026-11-06', label: '6 November 2026' };

export interface PrivacyFacts {
  /** Nama situs (Pengaturan Situs → Nama situs) */
  brand: string;
  /** Nama cabang aktif, mis. ["Bogor Bantarjati", "Cibubur"] */
  branches: string[];
  /** Nomor WhatsApp tampilan, mis. 0813-2220-932 */
  whatsapp: string;
  /** Email situs; kosong → hanya WhatsApp */
  email: string;
}

export interface PrivacySection {
  id: string;
  heading: string;
  paragraphs: string[];
  /** Butir daftar setelah paragraf (opsional) */
  items?: string[];
}

export const privacyTitle = (brand: string) => `${PRIVACY_LABEL} | ${brand}`;
export const privacyDescription = (brand: string) =>
  `Data apa yang diproses website ${brand}, untuk apa, di mana disimpan, dan cara meminta penghapusan data.`;

const joinNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : (names[0] ?? ''));

/** Cara menghubungi kami: WhatsApp, plus email bila ada */
export const privacyContact = (f: PrivacyFacts) => (f.email ? `WhatsApp ${f.whatsapp} atau email ${f.email}` : `WhatsApp ${f.whatsapp}`);

export function privacySections(f: PrivacyFacts): PrivacySection[] {
  const where = f.branches.length ? ` (${joinNames(f.branches)})` : '';
  return [
    {
      id: 'siapa',
      heading: 'Siapa kami',
      paragraphs: [
        `Website ini dikelola oleh ${f.brand}${where}. Pertanyaan tentang kebijakan ini atau data Anda bisa dikirim lewat ${privacyContact(f)}.`,
      ],
    },
    {
      id: 'data',
      heading: 'Data yang diproses',
      paragraphs: ['Berikut semua data yang diproses lewat website ini. Selain yang tercantum di sini, kami tidak mengumpulkan data pengunjung.'],
      items: [
        'Statistik kunjungan (Cloudflare Web Analytics). Layanan ini tidak memakai cookie dan hanya menghasilkan statistik kunjungan agregat, misalnya jumlah kunjungan dan halaman yang dibuka.',
        'Hitungan klik tombol WhatsApp. Setiap klik menambah satu angka di penghitung harian. Kolom yang disimpan hanya: tanggal, jenis tombol, cabang, kapster (bila tombol kapster), halaman asal, asal kunjungan (misalnya Google, Instagram, atau langsung), dan jumlah klik. Kami tidak menyimpan alamat IP, nomor HP, isi pesan, cookie, atau ID pengunjung.',
        'Percakapan WhatsApp. Percakapan terjadi di aplikasi WhatsApp, bukan di website ini, dan tunduk pada kebijakan privasi WhatsApp. Website tidak melihat atau menyimpan isi pesan Anda.',
        'Ulasan Google. Untuk membalas ulasan pelanggan, kami membaca nama pengulas, jumlah bintang, isi ulasan, dan waktu ulasan dari Google Business Profile melalui API resmi Google. Data itu disimpan untuk keperluan membalas ulasan dan tidak dibagikan ke pihak lain.',
        'Video Instagram. Video Instagram di website hanya dimuat setelah Anda menekan tombol putar. Sejak itu berlaku kebijakan privasi Instagram/Meta atas pemutaran tersebut.',
        'Preferensi tampilan. Website menyimpan beberapa pengaturan tampilan di penyimpanan peramban Anda, misalnya pengumuman yang sudah ditutup dan intro yang sudah tampil. Data ini tetap di perangkat Anda dan tidak dikirim ke kami.',
      ],
    },
    {
      id: 'penyimpanan',
      heading: 'Penyimpanan dan berbagi data',
      paragraphs: [
        'Website dan database kami berjalan di Cloudflare, tempat data di atas disimpan. Kami tidak menjual atau membagikan data ke pihak lain.',
      ],
    },
    {
      id: 'hak',
      heading: 'Hak Anda dan permintaan penghapusan data',
      paragraphs: [
        `Anda berhak menanyakan data apa yang kami simpan dan meminta data itu dihapus, termasuk ulasan Google Anda yang tersimpan di sistem kami. Kirim permintaan lewat ${privacyContact(f)}, lalu kami tindak lanjuti.`,
      ],
    },
    {
      id: 'berlaku',
      heading: 'Tanggal berlaku',
      paragraphs: [`Kebijakan ini berlaku sejak ${PRIVACY_EFFECTIVE.label}.`],
    },
  ];
}
