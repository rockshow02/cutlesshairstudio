import type { LocationsContent } from '@/types';

export const locations: LocationsContent = {
  heading: { kicker: 'Lokasi & Jam Buka', title: 'Mampir ke studio.' },
  labels: {
    hoursCaption: 'Jam operasional',
    today: 'Hari ini',
    closed: 'Tutup',
    directions: 'Petunjuk Arah',
    bookBranch: 'Booking cabang ini',
    branchTabs: 'Pilih cabang',
  },
  // Tambah cabang = tambah objek baru di array ini. Tab cabang muncul otomatis bila > 1.
  items: [
    {
      id: 'bogor',
      shortName: 'Bogor',
      name: 'Cutless Hair Studio · Bogor',
      // TODO: isi alamat lengkap cabang
      address: {
        street: 'Jl. Contoh No. 123',
        area: 'Kelurahan, Kecamatan',
        city: 'Kota Bogor',
        province: 'Jawa Barat',
        postalCode: '16100',
      },
      // TODO: nomor telepon/WA cabang
      phoneDisplay: '0812-3456-7890',
      // TODO: sesuaikan jam operasional
      hours: [
        { day: 1, label: 'Senin', open: '10:00', close: '21:00' },
        { day: 2, label: 'Selasa', open: '10:00', close: '21:00' },
        { day: 3, label: 'Rabu', open: '10:00', close: '21:00' },
        { day: 4, label: 'Kamis', open: '10:00', close: '21:00' },
        { day: 5, label: 'Jumat', open: '13:00', close: '21:00' },
        { day: 6, label: 'Sabtu', open: '09:00', close: '22:00' },
        { day: 0, label: 'Minggu', open: '09:00', close: '22:00' },
      ],
      map: {
        // TODO: ganti dengan URL embed resmi (Google Maps > Bagikan > Sematkan peta > salin nilai src)
        embedUrl: 'https://www.google.com/maps?q=Cutless+Hair+Studio+Bogor&output=embed',
        // TODO: ganti dengan link Google Maps bisnis
        directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Cutless+Hair+Studio+Bogor',
        title: 'Peta lokasi Cutless Hair Studio Bogor',
      },
      // TODO (opsional): koordinat untuk data terstruktur Google
      geo: undefined,
    },
  ],
};
