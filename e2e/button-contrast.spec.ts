import { expect, type Locator, type Page } from '@playwright/test';
import { E2E_BRANCHES, E2E_TIPS } from './fixtures/content';
import { test } from './helpers';

/**
 * Kontras teks tombol situs ≥ 4,5:1 (WCAG AA) di keadaan normal, terpilih/aktif, fokus, dan hover (desktop).
 * Latar efektif = latar elemen + lapisan isi ::before (bila sedang tampil) + latar leluhurnya. Mencegah terulangnya
 * bug "Salin link": <button> varian ghost memakai latar abu-abu bawaan browser rgb(239, 239, 239) di bawah teks terang.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const ARTICLE = `${UNIFORM_URL}/tips/${E2E_TIPS.withToc.slug}/`;
const MIN = 4.5;

/** Kontrol berteks yang diperiksa: tombol, link bergaya tombol/chip, tab, judul akordeon */
const CONTROLS = 'button, a[class*="btn"], a[class*="chip"], summary, [role="tab"]';

type Result = { name: string; ratio: number; background: string; color: string } | { name: string; skipped: string };

/** Kontras elemen (di halaman): teks vs latar efektif (lapisan ::before yang tampil ikut dihitung) */
function contrastOf(el: Element): Result {
  type C = { r: number; g: number; b: number; a: number };
  const parse = (c: string): C | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top: C, bottom: C): C => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const lum = ({ r, g, b }: C) => [r, g, b].map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a: C, b: C) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const name = `${el.tagName.toLowerCase()} "${(el as HTMLElement).innerText.trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  const layers: C[] = [];
  for (let n: Element | null = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage !== 'none') return { name, skipped: 'latar gambar' };
    // Lapisan isi tombol/chip (::before) di atas latar elemen itu, bila sedang tampil (tidak digeser keluar)
    const before = getComputedStyle(n, '::before');
    const fill = parse(before.backgroundColor);
    const shown = before.content !== 'none' && before.position === 'absolute' && (before.transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(before.transform));
    if (fill && fill.a > 0 && shown) layers.push(fill);
    const c = parse(cs.backgroundColor);
    if (c && c.a > 0) layers.push(c);
    if (layers.some((l) => l.a >= 1)) break;
  }
  let bg: C = { r: 255, g: 255, b: 255, a: 1 };
  for (const l of layers.reverse()) bg = over(l, bg);
  const color = getComputedStyle(el).color;
  return { name, ratio: Math.round(ratio(over(parse(color)!, bg), bg) * 100) / 100, background: `rgb(${bg.r | 0}, ${bg.g | 0}, ${bg.b | 0})`, color };
}

const check = async (loc: Locator) => loc.evaluate(contrastOf);

/** Gulir sampai bawah agar section lazy ikut dirender, lalu kembali ke atas */
async function renderAll(page: Page) {
  for (let y = 0; y < (await page.evaluate(() => document.documentElement.scrollHeight)); y += 700) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
}

test('"Salin link": latar transparan (bukan abu-abu bawaan browser), kontras ≥ 4,5:1 normal, fokus, & hover', async ({ page, isMobile }) => {
  await page.goto(ARTICLE, { waitUntil: 'domcontentloaded' });
  const copy = page.getByRole('button', { name: 'Salin link' });
  await copy.scrollIntoViewIfNeeded({ timeout: 20_000 });
  const css = await copy.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, appearance: getComputedStyle(el).appearance }));
  expect(css.bg).not.toBe('rgb(239, 239, 239)');
  expect(css.bg).toBe('rgba(0, 0, 0, 0)');
  expect(css.appearance).toBe('none');

  const normal = await check(copy);
  expect('ratio' in normal && normal.ratio, JSON.stringify(normal)).toBeGreaterThanOrEqual(MIN);

  await copy.focus();
  const focused = await check(copy);
  expect('ratio' in focused && focused.ratio, JSON.stringify(focused)).toBeGreaterThanOrEqual(MIN);

  if (!isMobile) {
    await copy.hover();
    const hovered = await check(copy);
    expect('ratio' in hovered && hovered.ratio, JSON.stringify(hovered)).toBeGreaterThanOrEqual(MIN);
    expect('ratio' in hovered && hovered.background).not.toBe(('ratio' in normal && normal.background) || '');
  }
});

const PAGES = [
  '/',
  '/cabang/',
  `/cabang/${E2E_BRANCHES.bogor.slug}/`,
  '/cuci-sepatu/',
  `${UNIFORM_URL}/`,
  `${UNIFORM_URL}/produk/`,
  `${UNIFORM_URL}/tips/`,
  `${UNIFORM_URL}/tips/kategori/grooming/`,
  ARTICLE,
];

for (const url of PAGES) {
  test(`semua tombol situs ≥ 4,5:1 (normal & terpilih; hover di desktop): ${url.replace(UNIFORM_URL, '[uniform]')}`, async ({ page, isMobile }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
    await renderAll(page);
    // Akordeon FAQ terbuka & tertutup sama-sama diperiksa
    await page.locator('details').evaluateAll((els) => els.slice(0, 1).forEach((d) => ((d as HTMLDetailsElement).open = true)));
    const controls = page.locator(CONTROLS).filter({ visible: true }).filter({ hasText: /\S/ });
    const normal: Result[] = [];
    for (let i = 0, n = await controls.count(); i < n; i++) normal.push(await check(controls.nth(i)));
    const low = normal.filter((r) => 'ratio' in r && r.ratio < MIN);
    expect(low, 'kontras normal di bawah 4,5:1').toEqual([]);
    expect(normal.filter((r) => 'ratio' in r).length).toBeGreaterThan(3);

    if (isMobile) return;
    // Hover: tombol & chip situs (lapisan isi ::before naik, warna teks berganti)
    const hoverable = page.locator('a[class*="btn"], button[class*="btn"], a[class*="chip"], button[class*="chip"]').filter({ visible: true }).filter({ hasText: /\S/ });
    const problems: Result[] = [];
    for (let i = 0, n = await hoverable.count(); i < n; i++) {
      const el = hoverable.nth(i);
      await el.scrollIntoViewIfNeeded().catch(() => undefined);
      await el.hover({ force: true, timeout: 2_000 }).catch(() => undefined);
      const r = await check(el);
      if ('ratio' in r && r.ratio < MIN) problems.push(r);
    }
    expect(problems, 'kontras hover di bawah 4,5:1').toEqual([]);
  });
}
