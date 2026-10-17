import { Button } from './Button';
import { SkeletonList } from './Feedback';
import styles from './LoadMore.module.css';

interface LoadMoreProps {
  /** Jumlah yang sudah tampil */
  shown: number;
  /** Total bila diketahui (hitungan murah); tanpa total → tidak ditampilkan */
  total?: number;
  hasMore: boolean;
  loading: boolean;
  onLoad: () => void;
  /** Kata benda untuk teks, mis. "booking", "pelanggan" */
  noun?: string;
  casing?: 'upper' | 'normal';
  skeletonHeight?: number;
}

/**
 * Pola paginasi tunggal untuk semua daftar (HP & desktop): skeleton saat memuat halaman berikutnya,
 * info "Menampilkan X dari N", tombol "Muat lebih banyak", dan penanda akhir daftar.
 */
export function LoadMore({ shown, total, hasMore, loading, onLoad, noun = 'data', casing = 'normal', skeletonHeight = 56 }: LoadMoreProps) {
  if (shown === 0) return null;
  return (
    <div className={styles.wrap}>
      {loading && <SkeletonList label={`Memuat ${noun} berikutnya…`} count={2} height={skeletonHeight} />}
      <p className={styles.info} aria-live="polite">
        {hasMore ? (total !== undefined ? `Menampilkan ${shown} dari ${total} ${noun}` : `Menampilkan ${shown} ${noun}`) : `Semua ${noun} sudah ditampilkan (${shown}).`}
      </p>
      {hasMore && (
        <Button variant="outline-dark" casing={casing} size="sm" onClick={onLoad} disabled={loading} className={styles.button}>
          {loading ? 'Memuat…' : 'Muat lebih banyak'}
        </Button>
      )}
    </div>
  );
}
