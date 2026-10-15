import { useEffect, useState } from 'react';

export type ContentState<T> =
  | { status: 'loading'; data?: undefined }
  | { status: 'success'; data: T }
  | { status: 'error'; data?: undefined; error: unknown };

/**
 * Ambil konten async dari lapisan data (src/lib/content.ts).
 * `deps`: muat ulang saat nilai ini berubah (mis. cabang terpilih). Data lama tetap tampil selama
 * memuat ulang, jadi ganti cabang tidak menimbulkan kedipan skeleton.
 */
export function useContent<T>(loader: () => Promise<T>, deps: readonly unknown[] = []): ContentState<T> {
  const [state, setState] = useState<ContentState<T>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState((prev) => (prev.status === 'success' ? prev : { status: 'loading' }));
    loader()
      .then((data) => {
        if (active) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', error });
      });
    return () => {
      active = false;
    };
    // `loader` boleh berupa closure baru tiap render; yang menentukan muat ulang adalah `deps`
  }, deps);

  return state;
}
