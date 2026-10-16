import { Page } from '../Page';
import styles from '../booking.module.css';

/** /kebijakan-privasi (UU No. 27/2022 tentang Pelindungan Data Pribadi) */
export function Privacy() {
  return (
    <Page id="privasi" kicker="Kebijakan" title="Kebijakan Privasi" lead="Berlaku untuk akun pelanggan dan booking online Cutless Hair Studio. Terakhir diperbarui: Oktober 2026.">
      <div className={styles.summary}>
        <h2 className={styles.h2}>Data yang kami kumpulkan</h2>
        <ul style={{ listStyle: 'disc', paddingLeft: '1.2rem', marginBottom: 16 }}>
          <li>Nama dan alamat email dari akun Google yang Anda pakai untuk masuk.</li>
          <li>Nomor WhatsApp yang Anda isi di profil.</li>
          <li>Riwayat booking: cabang, layanan, hairstylist, jadwal, status, dan catatan yang Anda tulis.</li>
          <li>Data teknis untuk keamanan: waktu login dan jenis browser (sesi), serta alamat IP sementara untuk mencegah spam.</li>
        </ul>
        <p>Kami tidak meminta password Google Anda dan tidak membaca isi email Anda.</p>
      </div>

      <div className={styles.summary}>
        <h2 className={styles.h2}>Tujuan penggunaan</h2>
        <ul style={{ listStyle: 'disc', paddingLeft: '1.2rem' }}>
          <li>Mengelola booking: menahan jadwal, mengingatkan, dan menghubungi Anda bila ada perubahan.</li>
          <li>Cabang dapat menghubungi nomor WhatsApp Anda untuk konfirmasi booking.</li>
          <li>Mencegah penyalahgunaan (spam, booking fiktif berulang, tidak datang berulang kali).</li>
          <li>Laporan internal cabang (jumlah booking, layanan terpopuler) dalam bentuk statistik.</li>
        </ul>
        <p style={{ marginTop: 12 }}>Data tidak dijual atau dibagikan kepada pihak lain untuk pemasaran.</p>
      </div>

      <div className={styles.summary}>
        <h2 className={styles.h2}>Lama penyimpanan</h2>
        <ul style={{ listStyle: 'disc', paddingLeft: '1.2rem' }}>
          <li>Data akun disimpan selama akun aktif.</li>
          <li>Akun yang tidak dipakai login selama 24 bulan dianonimkan otomatis.</li>
          <li>Riwayat booking disimpan untuk laporan cabang, tanpa data pribadi setelah akun dihapus atau dianonimkan.</li>
          <li>Sesi login berlaku 30 hari dan dihapus otomatis setelah kedaluwarsa.</li>
        </ul>
      </div>

      <div className={styles.summary}>
        <h2 className={styles.h2}>Hak Anda & cara menghapus akun</h2>
        <p>
          Anda bisa melihat dan mengubah nama serta nomor WhatsApp di halaman{' '}
          <a className={styles.link} href="/profil">
            Profil
          </a>
          . Untuk menghapus akun, buka Profil lalu pilih <strong>Hapus akun saya</strong>: nama, email, dan nomor WhatsApp dihapus,
          booking yang akan datang dibatalkan, dan riwayat booking disimpan tanpa identitas Anda.
        </p>
        <p style={{ marginTop: 12 }}>Pertanyaan atau permintaan lain terkait data pribadi dapat disampaikan ke WhatsApp cabang Cutless Hair Studio.</p>
      </div>

      <div className={styles.summary}>
        <h2 className={styles.h2}>Penyimpanan & keamanan</h2>
        <p>
          Data disimpan di layanan Cloudflare (database D1). Login memakai Google; sesi disimpan dalam bentuk terenkripsi satu arah (hash).
          Akses dashboard admin dibatasi untuk pemilik dan staf cabang yang terdaftar.
        </p>
      </div>
    </Page>
  );
}
