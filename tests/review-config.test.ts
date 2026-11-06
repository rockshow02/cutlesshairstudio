import { describe, expect, it } from 'vitest';
import { reviewConfig } from '../scripts/vite-content-plugin';
import { contentFixture } from './helpers/contentFixture';

describe('reviewConfig (dist/ulasan-config.json)', () => {
  it('memuat mode, nama cabang per slug, dan template', () => {
    const bundle = contentFixture();
    const cfg = reviewConfig(bundle);
    expect(cfg.mode).toBe('Mati');
    expect(cfg.branches).toEqual({ 'bogor-bantarjati': 'Bogor Bantarjati', cibubur: 'Cibubur' });
    expect(cfg.reply).toEqual(bundle.reviewReplies);
  });

  it('mengikuti mode di Pengaturan Situs', () => {
    const base = contentFixture();
    for (const mode of ['Uji', 'Aktif'] as const) {
      expect(reviewConfig({ ...base, settings: { ...base.settings, reviewReplyMode: mode } }).mode).toBe(mode);
    }
  });
});
