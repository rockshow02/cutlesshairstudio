import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'danger' | 'info';

export const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => undefined);

/** const toast = useToast(); toast('Profil tersimpan.') / toast('Gagal…', 'danger') */
export const useToast = () => useContext(ToastContext);
