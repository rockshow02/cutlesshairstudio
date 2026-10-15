import { useEffect, useMemo, useRef, useState } from 'react';
import type { Branch } from '@/types';
import { useBranch, type PickerRequest } from '@/lib/BranchContext';
import { getOpenStatus } from '@/lib/branchHours';
import { fillTemplate } from '@/lib/whatsapp';
import { Icon } from '@/components/ui/Icon';
import styles from './BranchPicker.module.css';

interface BranchPickerProps {
  request: PickerRequest;
  onChoose: (branch: Branch) => void;
  onClose: () => void;
}

/** Jarak dua titik di bumi (km), rumus haversine */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Pemilih cabang: kota → cabang, plus "Cabang terdekat" (Geolocation API, hanya bila pengunjung
 * mengizinkan; tanpa layanan berbayar). Native <dialog>: fokus, Esc, dan top-layer ditangani browser.
 */
export function BranchPicker({ request, onChoose, onClose }: BranchPickerProps) {
  const { branches, copy, announcements, selected } = useBranch();
  const ref = useRef<HTMLDialogElement>(null);
  const L = copy.picker;

  const candidates = useMemo(
    () => branches.filter((b) => !request.allowedSlugs?.length || request.allowedSlugs.includes(b.slug)),
    [branches, request.allowedSlugs],
  );
  const cities = useMemo(() => [...new Set(candidates.map((b) => b.city))], [candidates]);
  const [city, setCity] = useState<string | null>(() => (cities.length === 1 ? cities[0] : null));
  const [geo, setGeo] = useState<{ state: 'idle' | 'loading' | 'error'; message?: string }>({ state: 'idle' });

  const geoCandidates = candidates.filter((b) => b.bookable && b.latitude !== undefined && b.longitude !== undefined);
  const canUseGeo = geoCandidates.length >= 2 && typeof navigator !== 'undefined' && 'geolocation' in navigator;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const trigger = document.activeElement as HTMLElement | null;
    return () => trigger?.focus?.();
  }, []);

  const findNearest = () => {
    setGeo({ state: 'loading', message: L.nearestLoading });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const nearest = geoCandidates
          .map((b) => ({ b, km: distanceKm(me, { lat: b.latitude as number, lng: b.longitude as number }) }))
          .sort((x, y) => x.km - y.km)[0];
        if (nearest) {
          setCity(nearest.b.city);
          setGeo({ state: 'idle', message: fillTemplate(L.nearestFound, { branch: nearest.b.name, distance: Math.max(1, Math.round(nearest.km)) }) });
        } else {
          setGeo({ state: 'error', message: L.nearestUnavailable });
        }
      },
      (error) => setGeo({ state: 'error', message: error.code === error.PERMISSION_DENIED ? L.nearestDenied : L.nearestUnavailable }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const visible = city ? candidates.filter((b) => b.city === city) : [];

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="branch-picker-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className={styles.inner}>
        <header className={styles.head}>
          <div>
            <h2 id="branch-picker-title" className={styles.title}>
              {L.title}
            </h2>
            <p className={styles.subtitle}>{L.subtitle}</p>
          </div>
          <button type="button" className={styles.iconBtn} onClick={() => ref.current?.close()} aria-label={L.close}>
            <Icon name="close" size={20} />
          </button>
        </header>

        {canUseGeo && (
          <div className={styles.geo}>
            <button type="button" className={styles.geoBtn} onClick={findNearest} disabled={geo.state === 'loading'}>
              <Icon name="navigate" size={16} />
              {L.nearest}
            </button>
            {geo.message && (
              <p className={styles.geoMsg} role="status" data-error={geo.state === 'error' || undefined}>
                {geo.message}
              </p>
            )}
          </div>
        )}

        {city === null ? (
          <>
            <p className={styles.step}>{L.chooseCity}</p>
            <ul className={styles.list}>
              {cities.map((c) => {
                const count = candidates.filter((b) => b.city === c).length;
                return (
                  <li key={c}>
                    <button type="button" className={styles.option} onClick={() => setCity(c)}>
                      <span className={styles.optionMain}>
                        <strong>{c}</strong>
                        <small>{count} cabang</small>
                      </span>
                      <Icon name="chevron-right" size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <div className={styles.stepRow}>
              {cities.length > 1 && (
                <button type="button" className={styles.back} onClick={() => setCity(null)}>
                  <Icon name="chevron-left" size={16} />
                  {L.back}
                </button>
              )}
              <p className={styles.step}>
                {L.chooseBranch} · {city}
              </p>
            </div>
            <ul className={styles.list}>
              {visible.map((b) => {
                const status = getOpenStatus(b, copy.labels, announcements);
                return (
                  <li key={b.slug}>
                    <button
                      type="button"
                      className={styles.option}
                      onClick={() => onChoose(b)}
                      disabled={!b.bookable}
                      aria-current={selected?.slug === b.slug || undefined}
                    >
                      <span className={styles.optionMain}>
                        <strong>{b.name}</strong>
                        {b.address && <small>{b.address}</small>}
                        {status.label && <small className={styles.status}>{status.label}</small>}
                      </span>
                      {b.bookable ? <Icon name="chevron-right" size={18} /> : <span className={styles.badge}>{L.unavailableBadge}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </dialog>
  );
}
