import { Card } from '@/components/ui/Card';
import { rewardText, useLoyaltyProgram } from '@/app/loyalty';
import { Page } from '../Page';
import styles from '../booking.module.css';

/** /kebijakan-privasi (UU No. 27/2022 tentang Pelindungan Data Pribadi) */
export function Privacy() {
  const program = useLoyaltyProgram();
  return (
    <Page id="privasi" kicker="Kebijakan" title="Kebijakan Privasi" lead="Berlaku untuk akun pelanggan dan booking online Cutless Hair Studio. Terakhir diperbarui: Oktober 2026.">
      <div className={styles.stack}>
        <Card tone="outline" as="section" className={styles.prose}>
          <h2 className={styles.h2}>Data yang kami kumpulkan</h2>
          <ul>
            <li>Nama dan alamat email dari akun Google yang Anda pakai untuk masuk.</li>
            <li>Nomor WhatsApp yang Anda isi di profil.</li>
            <li>Riwayat booking: cabang, layanan, hairstylist, jadwal, status, dan catatan yang Anda tulis.</li>
            <li>Data teknis untuk keamanan: waktu login dan jenis browser (sesi), serta alamat IP sementara untuk mencegah spam.</li>
          </ul>
          <p>Kami tidak meminta password Google Anda dan tidak membaca isi email Anda.</p>
        </Card>

        <Card tone="outline" as="section" className={styles.prose}>
          <h2 className={styles.h2}>Tujuan penggunaan</h2>
          <ul>
            <li>Mengelola booking: menahan jadwal, mengingatkan, dan menghubungi Anda bila ada perubahan.</li>
            <li>Cabang dapat menghubungi nomor WhatsApp Anda untuk konfirmasi booking.</li>
            <li>Mencegah penyalahgunaan (spam, booking fiktif berulang, tidak datang berulang kali).</li>
            <li>Laporan internal cabang (jumlah booking, layanan terpopuler) dalam bentuk statistik.</li>
          </ul>
          <p>Data tidak dijual atau dibagikan kepada pihak lain untuk pemasaran.</p>
        </Card>

        <Card tone="outline" as="section" className={styles.prose}>
          <h2 className={styles.h2}>Lama penyimpanan</h2>
          <ul>
            <li>Data akun disimpan selama akun aktif.</li>
            <li>Akun yang tidak dipakai login selama 24 bulan dianonimkan otomatis.</li>
            <li>Riwayat booking disimpan untuk laporan cabang, tanpa data pribadi setelah akun dihapus atau dianonimkan.</li>
            <li>Sesi login berlaku 30 hari dan dihapus otomatis setelah kedaluwarsa.</li>
          </ul>
        </Card>

        <Card tone="outline" as="section" className={styles.prose}>
          <h2 className={styles.h2}>Hak Anda & cara menghapus akun</h2>
          <p>
            Anda bisa melihat dan mengubah nama serta nomor WhatsApp di halaman{' '}
            <a className={styles.link} href="/profil">
              Profil
            </a>
            . Untuk menghapus akun, buka Profil lalu pilih <strong>Hapus akun saya</strong>: nama, email, dan nomor WhatsApp dihapus,
            booking yang akan datang dibatalkan, dan riwayat booking disimpan tanpa identitas Anda.
          </p>
          <p>Pertanyaan atau permintaan lain terkait data pribadi dapat disampaikan ke WhatsApp cabang Cutless Hair Studio.</p>
        </Card>

        <Card tone="outline" as="section" className={styles.prose}>
          <h2 className={styles.h2}>Penyimpanan & keamanan</h2>
          <p>
            Data disimpan di layanan Cloudflare (database D1). Login memakai Google; sesi disimpan dalam bentuk terenkripsi satu arah (hash).
            Akses dashboard admin dibatasi untuk pemilik dan staf cabang yang terdaftar.
          </p>
        </Card>
        {program?.enabled && <StampTerms program={program} />}
      </div>
    </Page>
  );
}

/** Syarat & ketentuan Cutless Stamp (hanya tampil bila program aktif; angka dari pengaturan owner) */
function StampTerms({ program }: { program: NonNullable<ReturnType<typeof useLoyaltyProgram>> }) {
  return (
    <Card tone="outline" as="section" className={styles.prose} id="cutless-stamp" aria-labelledby="cutless-stamp-title">
      <h2 id="cutless-stamp-title" className={styles.h2}>
        Cutless Stamp: syarat & ketentuan
      </h2>
      <ul>
        <li>Setiap booking yang selesai dikerjakan (status Selesai) mendapat 1 stempel, otomatis di akun Anda. Berlaku di semua cabang.</li>
        <li>
          Stempel ke-{program.tier1?.stamps}: voucher gratis 1× {rewardText(program.tier1?.services)}. Stempel ke-{program.tier2?.stamps}: voucher gratis 1×{' '}
          {rewardText(program.tier2?.services)}, lalu kartu dimulai lagi dari 0.
        </li>
        <li>Maksimal 1 stempel per hari. Booking yang dibatalkan, tidak datang, layanan paket, dan layanan yang dibayar dengan voucher Cutless Stamp tidak mendapat stempel.</li>
        <li>
          Stempel berlaku {program.stampValidMonths} bulan sejak didapat; voucher berlaku {program.voucherValidDays} hari sejak terbit. Yang lewat masa berlaku hangus otomatis.
        </li>
        <li>Voucher ditukar oleh kasir di cabang dan tidak bisa diuangkan.</li>
        <li>Stempel dari kunjungan tanpa akun (walk-in) dapat digabung ke akun Anda oleh admin cabang setelah nomor WhatsApp dicocokkan.</li>
      </ul>
    </Card>
  );
}
