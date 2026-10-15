import { useSite } from '@/lib/SiteContext';
import { useContent } from '@/lib/useContent';
import { getLocations } from '@/lib/content';
import { asset } from '@/lib/asset';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** JSON-LD HairSalon (satu entri per cabang) dari data konten, untuk SEO lokal Google. */
export function StructuredData() {
  const { site, socials } = useSite();
  const locations = useContent(getLocations);
  if (locations.status !== 'success') return null;

  const image = new URL(asset(site.seo.ogImage), site.seo.url).href;
  const data = locations.data.items.map((loc) => ({
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: loc.name,
    url: site.seo.url,
    image,
    telephone: loc.phoneDisplay,
    priceRange: site.priceRange,
    address: {
      '@type': 'PostalAddress',
      streetAddress: loc.address.formatted ?? loc.address.street,
      addressLocality: loc.address.city,
      addressRegion: loc.address.province,
      postalCode: loc.address.postalCode,
      addressCountry: 'ID',
    },
    ...(loc.geo ? { geo: { '@type': 'GeoCoordinates', latitude: loc.geo.lat, longitude: loc.geo.lng } } : {}),
    openingHoursSpecification: loc.hours
      .filter((h) => !h.closed && h.open && h.close)
      .map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAY_NAMES[h.day], opens: h.open, closes: h.close })),
    sameAs: socials.map((s) => s.url),
  }));

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data.length === 1 ? data[0] : data) }} />;
}
