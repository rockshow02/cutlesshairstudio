/** Konversi WebP (scripts/optimize-images.mjs) mempertahankan transparansi: logo PNG transparan tidak mendapat latar putih. */
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { toWebp } from '../scripts/optimize-images.mjs';

/** PNG 40 × 20: separuh kiri transparan penuh, separuh kanan merah pekat */
async function halfTransparentPng(): Promise<Buffer> {
  const w = 40;
  const h = 20;
  const raw = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (x >= w / 2) raw.set([200, 20, 20, 255], i); // kiri tetap 0,0,0,0
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

const pixel = async (webp: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [...data.subarray(i, i + 4)];
};

describe('optimize-images: PNG → WebP', () => {
  it('alpha tetap ada; area transparan tetap transparan (bukan putih); area pekat tetap pekat', async () => {
    const out = await toWebp(await halfTransparentPng(), { maxWidth: 1600 }).toBuffer();
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.hasAlpha).toBe(true);
    expect((await pixel(out, 2, 10))[3]).toBe(0);
    const [r, , , a] = await pixel(out, 37, 10);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(150);
  });

  it('versi kecil (resize) juga mempertahankan alpha', async () => {
    const out = await toWebp(await halfTransparentPng(), { width: 20 }).toBuffer();
    expect((await sharp(out).metadata()).width).toBe(20);
    expect((await pixel(out, 1, 5))[3]).toBe(0);
  });
});
