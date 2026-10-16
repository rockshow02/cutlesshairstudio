import styles from './motion.module.css';

/**
 * Perpindahan warna latar antar-section gelap ↔ terang. Diletakkan sebagai anak pertama section.
 *
 * Murni CSS (scroll-driven animation `animation-timeline: view()`, lihat motion.module.css), tanpa JavaScript
 * per section: lapisan sewarna section SEBELUMNYA menutupi latar section ini lalu memudar (opacity) saat
 * section naik ke ~35% layar, sehingga warna latar terasa berubah halus. Nada section sebelumnya dibaca
 * lewat selector saudara ([data-tone=dark] + [data-tone=light]).
 * - Sebelum section masuk layar lapisan tidak aktif (opacity 0), jadi tidak memengaruhi isi yang belum di-scroll.
 * - Browser tanpa dukungan scroll-driven animation / "kurangi gerakan" → tanpa efek (latar langsung berganti).
 */
export function ToneShift() {
  return <div aria-hidden="true" className={styles.toneShift} />;
}
