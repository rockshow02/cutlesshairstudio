import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Announcement, Branch, BranchCopy } from '@/types';
import { BranchPicker } from '@/components/layout/BranchPicker';

const STORAGE_KEY = 'cutless:branch';

export interface PickerRequest {
  /** Batasi pilihan (mis. promo yang hanya berlaku di cabang tertentu) */
  allowedSlugs?: string[];
  /** Dipanggil di dalam klik pengunjung (aman untuk window.open) */
  onSelect?: (branch: Branch) => void;
}

interface BranchContextValue {
  branches: Branch[];
  copy: BranchCopy;
  /** Pengumuman aktif semua cabang (untuk status buka "Tutup"/"Jam Khusus") */
  announcements: Announcement[];
  /** Cabang pilihan pengunjung (localStorage) */
  selected?: Branch;
  /** Cabang halaman yang sedang dibuka (/cabang/:slug/) */
  pageBranch?: Branch;
  /** Cabang yang dipakai section: halaman cabang, atau pilihan pengunjung */
  effective?: Branch;
  select: (slug: string) => void;
  openPicker: (request?: PickerRequest) => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

function readStoredSlug(): string | undefined {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeSlug(slug: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    /* storage diblokir (mode privat): pilihan tetap berlaku selama halaman terbuka */
  }
}

interface BranchProviderProps {
  branches: Branch[];
  copy: BranchCopy;
  announcements: Announcement[];
  pageBranchSlug?: string;
  children: ReactNode;
}

export function BranchProvider({ branches, copy, announcements, pageBranchSlug, children }: BranchProviderProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | undefined>(() => {
    const stored = readStoredSlug();
    // Abaikan pilihan lama yang cabangnya sudah tidak ada / tidak bisa booking
    return branches.some((b) => b.slug === stored && b.bookable) ? stored : undefined;
  });
  const [picker, setPicker] = useState<PickerRequest | null>(null);

  const select = useCallback((slug: string) => {
    setSelectedSlug(slug);
    storeSlug(slug);
  }, []);

  const openPicker = useCallback((request: PickerRequest = {}) => setPicker(request), []);

  const value = useMemo<BranchContextValue>(() => {
    const selected = branches.find((b) => b.slug === selectedSlug);
    const pageBranch = branches.find((b) => b.slug === pageBranchSlug);
    return { branches, copy, announcements, selected, pageBranch, effective: pageBranch ?? selected, select, openPicker };
  }, [branches, copy, announcements, selectedSlug, pageBranchSlug, select, openPicker]);

  return (
    <BranchContext.Provider value={value}>
      {children}
      {picker && (
        <BranchPicker
          request={picker}
          onClose={() => setPicker(null)}
          onChoose={(branch) => {
            select(branch.slug);
            setPicker(null);
            picker.onSelect?.(branch);
          }}
        />
      )}
    </BranchContext.Provider>
  );
}

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch harus dipakai di dalam <BranchProvider>.');
  return ctx;
}
