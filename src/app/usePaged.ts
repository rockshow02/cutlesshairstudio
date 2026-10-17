/** Daftar berhalaman (cursor): halaman pertama, "Muat lebih banyak" (append), muat ulang. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export function usePaged<T>(fetchPage: (cursor: string | null) => Promise<PageResult<T>>, deps: unknown[], enabled = true) {
  const [items, setItems] = useState<T[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  // Abaikan respons lama bila filter/pencarian berubah di tengah jalan
  const generation = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const reload = useCallback(() => {
    const gen = ++generation.current;
    setError('');
    setItems(null);
    fetchRef
      .current(null)
      .then((p) => {
        if (gen !== generation.current) return;
        setItems(p.items);
        setCursor(p.nextCursor);
        setTotal(p.total);
      })
      .catch((e) => gen === generation.current && (setItems([]), setError(errorMessage(e))));
  }, []);

  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reload, ...deps]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    setError('');
    fetchRef
      .current(cursor)
      .then((p) => {
        if (gen !== generation.current) return;
        setItems((prev) => [...(prev ?? []), ...p.items]);
        setCursor(p.nextCursor);
      })
      .catch((e) => gen === generation.current && setError(errorMessage(e)))
      .finally(() => setLoadingMore(false));
  }, [cursor, loadingMore]);

  return { items, total, hasMore: Boolean(cursor), loadingMore, error, loadMore, reload, setItems };
}
