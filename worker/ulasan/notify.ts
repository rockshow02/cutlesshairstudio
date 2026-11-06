/**
 * Pemberitahuan ulasan antre baru. Sengaja tanpa notifikasi eksternal (keputusan pemilik): admin mengandalkan
 * notifikasi bawaan Google + bookmark /ulasan/. Antarmuka ini disisakan agar penyedia (mis. Brevo) bisa ditambah
 * tanpa mengubah logika sinkron: cukup implementasi Notifier baru yang diberikan ke runReviewSync.
 */

export interface QueuedReview {
  id: string;
  branch: string;
  branchName: string;
  rating: number;
}

export interface Notifier {
  /** Dipanggil sekali per sinkron dengan ulasan yang baru masuk antrean. Tidak boleh dipakai untuk mengirim balasan. */
  queued(reviews: QueuedReview[]): Promise<void>;
}

/** Implementasi bawaan: tidak mengirim apa pun */
export const noopNotifier: Notifier = { queued: async () => undefined };
