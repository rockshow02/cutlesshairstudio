import { useCallback, useEffect, useRef, useState } from 'react';
import { useSite } from '@/lib/SiteContext';
import { useActiveSection } from '@/lib/useActiveSection';
import { asset } from '@/lib/asset';
import { bookingLink } from '@/lib/whatsapp';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import styles from './Navbar.module.css';

const MENU_ID = 'mobile-menu';

export function Navbar() {
  const { site, socials } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = useActiveSection(site.nav.map((n) => n.sectionId));
  const waHref = bookingLink(site, 'general');

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
      <header className={styles.header} data-solid={scrolled || open || undefined}>
        <Container fluid className={styles.inner}>
          <a className={styles.logo} href="#top" onClick={() => setOpen(false)}>
            <img
              src={asset(site.logo.horizontal.src)}
              width={site.logo.horizontal.width}
              height={site.logo.horizontal.height}
              alt={site.logo.horizontal.alt}
            />
          </a>

          <nav className={styles.desktopNav} aria-label={site.ui.mainNavigation}>
            <ul>
              {site.nav.map((item) => (
                <li key={item.sectionId}>
                  <a href={`#${item.sectionId}`} aria-current={active === item.sectionId ? 'true' : undefined}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.actions}>
            <Button href={waHref} external size="sm" variant="light" className={styles.bookBtn}>
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
        <nav aria-label={site.ui.mainNavigation}>
          <ul className={styles.panelList}>
            {site.nav.map((item) => (
              <li key={item.sectionId}>
                <a href={`#${item.sectionId}`} onClick={() => close(false)} aria-current={active === item.sectionId ? 'true' : undefined}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.panelFoot}>
          <Button href={waHref} external variant="whatsapp" icon="whatsapp" block onClick={() => close(false)}>
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
