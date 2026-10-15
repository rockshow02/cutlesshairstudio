import { useSite } from '@/lib/SiteContext';
import { useBranch } from '@/lib/BranchContext';
import { useFabZone } from '@/lib/fabZones';
import { asset } from '@/lib/asset';
import { bookingLink, fillTemplate } from '@/lib/whatsapp';
import { isHomePage, navHref, navKey, pageUrl } from '@/lib/navigation';
import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import styles from './Footer.module.css';

export function Footer() {
  const { site, socials } = useSite();
  const { branches, copy } = useBranch();
  const zoneRef = useFabZone<HTMLElement>(0);
  const { footer, logo } = site;
  // Nomor pusat: pertanyaan umum (booking memakai nomor cabang)
  const questionHref = bookingLink(site, 'question');

  return (
    <footer id="kontak" ref={zoneRef} className={styles.footer}>
      <Container>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <a href={isHomePage() ? '#top' : pageUrl('/')} className={styles.logo}>
              <img src={asset(logo.stacked.src)} width={logo.stacked.width} height={logo.stacked.height} alt={logo.stacked.alt || site.brandName} loading="lazy" />
            </a>
            <p>{footer.description}</p>
            <ul className={styles.socials} aria-label={site.ui.socialLinks}>
              {socials.map((s) => (
                <li key={s.platform}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.label} ${s.handle}`}>
                    <Icon name={s.platform} size={19} />
                  </a>
                </li>
              ))}
              <li>
                <a href={questionHref} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${site.whatsapp.displayNumber}`}>
                  <Icon name="whatsapp" size={19} />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className={styles.colTitle}>{footer.contactTitle}</h2>
            <ul className={styles.contact}>
              <li>
                <Icon name="whatsapp" />
                <a href={questionHref} target="_blank" rel="noopener noreferrer">
                  {site.whatsapp.displayNumber}
                </a>
              </li>
              <li>
                <Icon name="mail" />
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </li>
            </ul>
          </div>

          <nav aria-label={footer.exploreTitle}>
            <h2 className={styles.colTitle}>{footer.exploreTitle}</h2>
            <ul className={styles.links}>
              {site.nav.map((item) => (
                <li key={navKey(item)}>
                  <a href={navHref(item)}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={footer.branchesTitle}>
            <h2 className={styles.colTitle}>{footer.branchesTitle}</h2>
            <ul className={styles.links}>
              {branches.map((b) => (
                <li key={b.slug}>
                  <a href={pageUrl(b.pageUrl)}>
                    {b.name}
                    {b.status !== 'Aktif' && <span className={styles.badge}>{copy.labels.statusBadge[b.status]}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className={styles.bottom}>
          <p>{fillTemplate(footer.copyright, { year: new Date().getFullYear(), brand: site.brandName })}</p>
          {/* Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. */}
          <p>
            {footer.credit.prefix}{' '}
            <a href={footer.credit.href} target="_blank" rel="noopener noreferrer">
              {footer.credit.label}
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
