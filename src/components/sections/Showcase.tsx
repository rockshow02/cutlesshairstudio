import { getShowcase } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { ExpandingCard } from '@/components/motion/ExpandingCard';

/** Kartu foto studio yang membesar + tagline berganti (di antara Tentang Kami dan Layanan) */
export function Showcase() {
  const state = useContent(getShowcase);
  if (state.status !== 'success' || state.data.taglines.length === 0) return null;
  const { heading, image, taglines } = state.data;
  return <ExpandingCard id="studio" heading={heading} image={image} taglines={taglines} />;
}
