import { useEffect, useState } from 'react';

export type ContentState<T> =
  | { status: 'loading'; data?: undefined }
  | { status: 'success'; data: T }
  | { status: 'error'; data?: undefined; error: unknown };

/**
 * Ambil konten async dari lapisan data (src/lib/content.ts).
 * `loader` harus referensi stabil (fungsi level modul seperti getServices).
 */
export function useContent<T>(loader: () => Promise<T>): ContentState<T> {
  const [state, setState] = useState<ContentState<T>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
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
  }, [loader]);

  return state;
}
