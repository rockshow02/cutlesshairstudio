import { useCallback, useEffect, useRef, useState } from 'react';
import { useSite } from '@/lib/SiteContext';
import { useActiveSection } from '@/lib/useActiveSection';
import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { asset } from '@/lib/asset';
import { isCurrentPage, isHomePage, navHref, navKey, pageUrl } from '@/lib/navigation';
import type { NavItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import styles from './Navbar.module.css';

const MENU_ID = 'mobile-menu';

export function Navbar() {
  const { site, socials } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { tone, hidden } = useHeaderMotion(open);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const home = isHomePage();
  // Scroll-spy hanya di halaman utama (section-nya ada di sana)
  const active = useActiveSection(home ? site.nav.flatMap((n) => (n.sectionId ? [n.sectionId] : [])) : []);
  const current = (item: NavItem): 'true' | 'page' | undefined =>
    isCurrentPage(item) ? 'page' : item.sectionId && active === item.sectionId ? 'true' : undefined;
  const { selected, copy: branchCopy, openPicker } = useBranch();
  const book = useBooking();
  // "Booking Sekarang" & tombol hijau WhatsApp di menu HP: WhatsApp cabang terpilih
  const booking = book();
  const whatsapp = booking;
  const branchLabel = selected ? selected.name : branchCopy.labels.pickBranch;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  // Kunci scroll body, fokus ke link pertama, Esc untuk menutup, trap Tab di dalam menu.
  useEffect(() => {
    const root = document.documentElement;
    if (!open) {
      delete root.dataset.menuOpen;
      return;
    }
    root.dataset.menuOpen = 'true';
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current || !toggleRef.current) return;
      const items = [toggleRef.current, ...panelRef.current.querySelectorAll<HTMLElement>('a, button')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) close(false);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  return (
    <>
      <a className={styles.skip} href="#main">
        {site.ui.skipToContent}
      </a>
      <header
        className={styles.header}
        data-solid={scrolled || open || undefined}
        data-tone={open ? 'dark' : tone}
        data-hidden={hidden || undefined}
      >
        <Container fluid className={styles.inner}>
          <a className={styles.logo} href={home ? '#top' : pageUrl('/')} onClick={() => setOpen(false)}>
            {/* Dua lapis logo (putih & gelap) yang di-crossfade: logo selalu terlihat di latar gelap maupun terang */}
            <img
              className={styles.logoLight}
              src={asset(site.logo.horizontal.src)}
              width={site.logo.horizontal.width}
              height={site.logo.horizontal.height}
              alt={site.logo.horizontal.alt}
            />
            <img
              className={styles.logoDark}
              src={asset(site.logo.horizontal.src)}
              width={site.logo.horizontal.width}
              height={site.logo.horizontal.height}
              alt=""
              aria-hidden="true"
            />
          </a>

          <nav className={styles.desktopNav} aria-label={site.ui.mainNavigation}>
            <ul>
              {site.nav.map((item) => (
                <li key={navKey(item)}>
                  <a href={navHref(item)} aria-current={current(item)}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.branchBtn}
              onClick={() => openPicker()}
              aria-label={selected ? `${branchCopy.labels.selected}: ${selected.name}. ${branchCopy.labels.changeBranch}` : branchCopy.labels.pickBranch}
            >
              <Icon name="pin" size={18} />
              <span className={styles.branchLabel}>{branchLabel}</span>
            </button>
            <Button href={booking.href} external={booking.external} onClick={booking.onClick} size="sm" variant="light" className={styles.bookBtn}>
              <span className={styles.longLabel}>{site.ui.bookNow}</span>
              <span className={styles.shortLabel}>{site.ui.bookNowShort}</span>
            </Button>
            <button
              ref={toggleRef}
              type="button"
              className={styles.toggle}
              aria-expanded={open}
              aria-controls={MENU_ID}
              aria-label={open ? site.ui.closeMenu : site.ui.openMenu}
              onClick={() => setOpen((v) => !v)}
            >
              <Icon name={open ? 'close' : 'menu'} size={22} strokeWidth={1.8} />
            </button>
          </div>
        </Container>
      </header>

      {/* Menu mobile: di bawah navbar (top = --nav-h), z-index menu > FAB > navbar */}
      <div id={MENU_ID} ref={panelRef} className={styles.panel} hidden={!open}>
        <button
          type="button"
          className={styles.panelBranch}
          onClick={() => {
            close(false);
            openPicker();
          }}
        >
          <Icon name="pin" size={18} />
          <span>
            <small>{selected ? branchCopy.labels.selected : branchCopy.labels.allBranches}</small>
            <strong>{branchLabel}</strong>
          </span>
          <span className={styles.panelBranchAction}>{selected ? branchCopy.labels.changeBranch : branchCopy.labels.pickBranch}</span>
        </button>
        <nav aria-label={site.ui.mainNavigation}>
          <ul className={styles.panelList}>
            {site.nav.map((item) => (
              <li key={navKey(item)}>
                <a href={navHref(item)} onClick={() => close(false)} aria-current={current(item)}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.panelFoot}>
          <Button
            href={whatsapp.href}
            external={whatsapp.external}
            variant="whatsapp"
            icon="whatsapp"
            block
            onClick={(e) => {
              close(false);
              whatsapp.onClick?.(e);
            }}
          >
            {site.ui.floatingWhatsApp}
          </Button>
          <ul className={styles.panelSocials} aria-label={site.ui.socialLinks}>
            {socials
              .filter((s) => s.platform !== 'whatsapp')
              .map((s) => (
                <li key={s.platform}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    <Icon name={s.platform} size={18} />
                    {s.label}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </>
  );
}

const HIDE_AFTER = 160;

/**
 * Navbar mengikuti section di bawahnya:
 * - tone: 'light' bila section bernada terang (data-tone) berada tepat di bawah navbar → teks & logo gelap.
 *   Dideteksi IntersectionObserver pada garis 1 px di bawah navbar (tanpa membaca layout di setiap scroll).
 * - hidden: sembunyi saat scroll ke bawah, muncul lagi saat scroll ke atas (tidak saat menu terbuka,
 *   saat fokus keyboard di dalam navbar, atau di dekat puncak halaman)
 */
function useHeaderMotion(menuOpen: boolean) {
  const [tone, setTone] = useState<'dark' | 'light'>('dark');
  const [hidden, setHidden] = useState(false);

  // Nada section di bawah navbar
  useEffect(() => {
    let io: IntersectionObserver | undefined;
    const observed = new Set<Element>();
    const crossing = new Map<Element, boolean>();
    const setup = () => {
      io?.disconnect();
      observed.clear();
      crossing.clear();
      const root = document.documentElement;
      const navH = parseFloat(getComputedStyle(root).getPropertyValue('--header-offset')) || 64;
      const line = Math.round(navH + 1);
      io = new IntersectionObserver(
        (list) => {
          for (const e of list) crossing.set(e.target, e.isIntersecting);
          // Elemen terdalam yang memotong garis (section di dalam section → yang paling spesifik)
          const hits = [...crossing].filter(([, on]) => on).map(([el]) => el as HTMLElement);
          const top = hits.find((el) => !hits.some((other) => other !== el && el.contains(other))) ?? hits[0];
          setTone(top?.dataset.tone === 'light' ? 'light' : 'dark');
        },
        { rootMargin: `-${line}px 0px -${Math.max(0, window.innerHeight - line - 1)}px 0px` },
      );
      observe();
    };
    const observe = () => {
      document.querySelectorAll('[data-tone]').forEach((el) => {
        if (el.closest('header') || observed.has(el)) return;
        observed.add(el);
        io?.observe(el);
      });
    };
    setup();
    // Section yang dirender belakangan (Deferred, konten async) ikut diamati
    const mo = new MutationObserver(observe);
    mo.observe(document.getElementById('main') ?? document.body, { childList: true, subtree: true });
    window.addEventListener('resize', setup);
    return () => {
      io?.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', setup);
    };
  }, []);

  // Sembunyi/muncul berdasarkan arah scroll (hanya membaca scrollY, tanpa layout)
  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const header = document.querySelector('header[data-tone]');
      const focusInside = Boolean(header?.contains(document.activeElement));
      if (y < HIDE_AFTER || focusInside) setHidden(false);
      else if (y > lastY + 6) setHidden(true);
      else if (y < lastY - 6) setHidden(false);
      lastY = y;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('focusin', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', schedule);
    };
  }, []);

  return { tone, hidden: hidden && !menuOpen };
}
