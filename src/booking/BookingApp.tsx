import { ToastProvider } from '@/components/ui/Toast';
import { Wizard } from './pages/Wizard';
import { Login } from './pages/Login';
import { CompleteProfile, Profile } from './pages/Profile';
import { Success } from './pages/Success';
import { MyBookings } from './pages/MyBookings';
import { Privacy } from './pages/Privacy';

function Route() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/masuk') return <Login />;
  if (path === '/profil/lengkapi') return <CompleteProfile />;
  if (path === '/profil') return <Profile />;
  if (path === '/booking/saya') return <MyBookings />;
  if (path === '/booking/sukses') return <Success />;
  if (path === '/kebijakan-privasi') return <Privacy />;
  return <Wizard />;
}

/**
 * Aplikasi booking & akun (satu entri Vite, dilayani Worker untuk /booking*, /masuk, /profil*, /kebijakan-privasi).
 * Router sederhana berdasarkan path; perpindahan halaman memakai link biasa (tirai transisi situs tetap jalan).
 * Toast muncul di atas tombol WhatsApp melayang.
 */
export function BookingApp() {
  return (
    <ToastProvider bottom="var(--fab-safe)">
      <Route />
    </ToastProvider>
  );
}
