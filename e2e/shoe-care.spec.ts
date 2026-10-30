import { expect, type Locator, type Page } from '@playwright/test';
import { E2E_BRANCHES, E2E_SHOE_CARE } from './fixtures/content';
import { clsOf, expectNoHorizontalScroll, parseWa, test } from './helpers';

/**
 * Halaman /cuci-sepatu/ & teaser (data uji e2e/fixtures/content.ts, bukan data CMS) di 360 px & desktop: buka langsung
 * (+ refresh), dari teaser & anchor lama, hero (rata tengah, ukuran = hero beranda), About, 5 kartu berharga,
 * galeri + lightbox, tombol daftar menu → PDF uji, tombol layanan → wa.me partner, tanpa scroll horizontal, tombol WA
 * melayang tidak menutupi tombol mana pun, menu & meta.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const { bogor, cibubur } = E2E_BRANCHES;
const PAGE = '/cuci-sepatu/';
/** Build E2E varian "uniform" (:8788): Cuci Sepatu tanpa Logo hero → judul hero = nama partner sebagai teks */
const NO_HERO_LOGO_URL = 'http://localhost:8788';

/** Gulir ke elemen. Desktop memakai roda mouse (smooth scroll Lenis tidak mengikuti lompatan scroll native di CI). */
async function scrollTo(page: Page, target: Locator, isMobile: boolean) {
  await expect(target).toBeAttached({ timeout: 20_000 });
  if (isMobile) return target.scrollIntoViewIfNeeded();
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < 80; i++) {
    const top = await target.evaluate((el) => el.getBoundingClientRect().top);
    if (top > vp.height * 0.15 && top < vp.height * 0.55) break;
    await page.mouse.wheel(0, Math.max(-700, Math.min(700, top - vp.height * 0.35)));
    await page.waitForTimeout(150);
  }
  await page.mouse.move(5, 5);
}

/** Tombol WhatsApp melayang yang terlihat menimpa elemen? */
const fabOverlaps = (button: Locator) =>
  button.evaluate((btn) => {
    const b = btn.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLAnchorElement>('a[href^="https://wa.me/"]')].some((el) => {
      const s = getComputedStyle(el);
      if (el === btn || s.position !== 'fixed' || s.visibility === 'hidden' || s.opacity === '0' || el.hasAttribute('data-hidden')) return false;
      const f = el.getBoundingClientRect();
      return !(b.right < f.left || b.left > f.right || b.bottom < f.top || b.top > f.bottom);
    });
  });

test('buka /cuci-sepatu langsung & refresh: HTML statis, hero, About, layanan, galeri + lightbox, daftar menu', async ({ page, request, context, isMobile, apiCalls }) => {
  for (const path of [PAGE, '/cuci-sepatu']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<title>[STAGING] Cuci Sepatu ${E2E_SHOE_CARE.name} di Cutless ${bogor.name}</title>`);
    expect(html).toMatch(/<meta name="description" content="Tagline uji cuci sepatu\. Layanan: Deep Clean Uji, Unyellowing Uji, Suede Uji, Kids Uji, dan Gunung Uji\." \/>/);
    expect(html).toMatch(/<meta property="og:image" content="[^"]+\.(webp|jpe?g|png)"/);
    // JSON-LD Service: lokasi = HairSalon cabang partner (@id sama dengan halaman cabang)
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
    expect(ld).toMatchObject({ '@type': 'Service', name: `Cuci Sepatu ${E2E_SHOE_CARE.name} di Cutless ${bogor.name}`, provider: { name: E2E_SHOE_CARE.name } });
    expect(ld.availableChannel.serviceLocation['@id']).toMatch(new RegExp(`/cabang/${bogor.slug}/#salon$`));
    expect(ld.hasOfferCatalog.itemListElement).toHaveLength(E2E_SHOE_CARE.services.length);
  }
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Hero
  await expect(page.getByRole('heading', { level: 1, name: E2E_SHOE_CARE.name })).toBeVisible();
  await expect(page.getByText(`Tersedia di ${bogor.name}`).first()).toBeVisible();
  const hero = page.locator('#top');
  const main = hero.getByRole('link', { name: 'Titip Sepatu via WhatsApp' });
  expect(parseWa((await main.getAttribute('href'))!)).toEqual({
    number: E2E_SHOE_CARE.whatsappNumber,
    text: `Halo ${E2E_SHOE_CARE.name}, saya mau pesan layanan cuci sepatu di Cutless Hair Studio cabang ${bogor.name}. (via website Cutless)`,
  });
  // Daftar menu: file PDF menang atas link (keduanya diisi di data uji)
  const menu = hero.getByRole('link', { name: 'Lihat Daftar Menu' });
  await expect(menu).toHaveAttribute('href', E2E_SHOE_CARE.menuFile);
  await expect(menu).toHaveAttribute('target', '_blank');
  await expect(menu).toHaveAttribute('rel', 'noopener noreferrer');
  const pdf = await request.get(E2E_SHOE_CARE.menuFile);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  // Klik membuka tab baru yang memuat PDF (Chromium headless mengunduh PDF, jadi diperiksa lewat request-nya)
  const pdfRequest = context.waitForEvent('request', (r) => r.url().endsWith(E2E_SHOE_CARE.menuFile));
  const pdfTab = context.waitForEvent('page');
  await menu.click();
  await pdfRequest;
  await (await pdfTab).close();

  // About Us
  await expect(page.locator('#tentang')).toContainText('Paragraf About Us uji pertama.');

  // Layanan: 5 kartu berharga (urutan data uji, rentang "70-120k" tampil "70–120K"), tombol per layanan ke wa.me partner
  const services = page.locator('#layanan');
  const cards = services.locator('article');
  await expect(cards).toHaveCount(5);
  for (const [i, s] of E2E_SHOE_CARE.services.entries()) {
    await expect(cards.nth(i).getByRole('heading', { level: 3 })).toHaveText(s.name);
    await expect(cards.nth(i)).toContainText(`Harga: ${s.shownPrice}`);
  }
  await expect(services).not.toContainText('Lihat di daftar menu');
  await expect(services).toContainText('Layanan lain (paket kombinasi, tas, topi, dompet) ada di daftar menu.');
  await expect(services.getByRole('link', { name: 'Lihat Daftar Menu' })).toHaveAttribute('href', E2E_SHOE_CARE.menuFile);
  for (const s of E2E_SHOE_CARE.services) {
    const href = await services.getByRole('link', { name: `Pesan via WhatsApp: ${s.name}` }).getAttribute('href');
    expect(parseWa(href!)).toEqual({
      number: E2E_SHOE_CARE.whatsappNumber,
      text: `Halo ${E2E_SHOE_CARE.name}, saya mau pesan ${s.name} di Cutless Hair Studio cabang ${bogor.name}. (via website Cutless)`,
    });
  }
  const order = services.getByRole('link', { name: `Pesan via WhatsApp: ${E2E_SHOE_CARE.services[0].name}` });
  await scrollTo(page, order, isMobile);
  await page.waitForTimeout(400);
  expect(await fabOverlaps(order), 'tombol WA melayang menutupi tombol pesan').toBe(false);
  const popup = context.waitForEvent('page');
  await order.click();
  expect(parseWa((await popup).url()).text).toContain(E2E_SHOE_CARE.services[0].name);

  // Galeri + lightbox: klik untuk memperbesar, Esc menutup, panah berganti foto, fokus kembali
  const thumb = page.getByRole('button', { name: 'Perbesar foto: Foto hasil uji satu' });
  await scrollTo(page, thumb, isMobile);
  await thumb.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tutup' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(dialog).toHaveAttribute('aria-label', 'Foto hasil uji dua');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(thumb).toBeFocused();
  await thumb.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Tutup' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // CTA penutup; lokasi + catatan dalam satu kontainer
  await expect(page.locator('#titip').getByRole('link', { name: 'Titip Sepatu via WhatsApp' })).toBeAttached();
  await expect(page.locator('#lokasi')).toContainText('Catatan uji pertama.');
  await expect(page.locator('#lokasi').getByRole('link', { name: 'Petunjuk Arah' })).toBeAttached();
  await expectNoHorizontalScroll(page);
  expect(apiCalls).toEqual([]);
});

/**
 * Hero cuci sepatu = hero beranda: ukuran & jarak judul sama, setinggi layar. Tinggi beranda boleh lebih bila isinya
 * (teks hero dari CMS + bar pengumuman) melebihi layar HP; min-height tetap 100svh.
 */
function expectSameHero(shoe: Awaited<ReturnType<typeof heroBox>>, home: Awaited<ReturnType<typeof heroBox>>, viewportHeight: number) {
  const { height: shoeHeight, ...shoeStyle } = shoe;
  const { height: homeHeight, ...homeStyle } = home;
  expect(shoeStyle).toEqual(homeStyle);
  expect(shoeHeight).toBe(viewportHeight);
  expect(homeHeight).toBeGreaterThanOrEqual(viewportHeight);
}

/** Jarak vertikal antarelemen hero (bawah elemen → atas elemen berikutnya) */
const gapBetween = async (a: Locator, b: Locator) => {
  const [x, y] = [(await a.boundingBox())!, (await b.boundingBox())!];
  return Math.round(y.y - (x.y + x.height));
};


/** Font situs termuat & dua frame tergambar (pengganti jeda waktu tetap) */
const settled = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

/** CLS dari pergeseran elemen di dalam selector saja (mis. section About), sejak `since` (performance.now, ms) */
const clsWithin = (page: Page, selector: string, since = 0) =>
  page.evaluate(
    ([sel, from]) =>
      new Promise<number>((resolve) => {
        let total = 0;
        type Shift = { hadRecentInput: boolean; value: number; startTime: number; sources?: { node?: Node | null }[] };
        new PerformanceObserver((list) =>
          (list.getEntries() as unknown as Shift[]).forEach((e) => {
            const inside = (e.sources ?? []).some((src) => {
              const el = src.node instanceof Element ? src.node : src.node?.parentElement;
              return Boolean(el?.closest(sel));
            });
            if (!e.hadRecentInput && inside && e.startTime >= from) total += e.value;
          }),
        ).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 300);
      }),
    [selector, since] as const,
  );

/** Ukuran hero & judul (h1), tanpa animasi masuk */
const heroBox = (page: Page) =>
  page.evaluate(() => {
    const hero = document.getElementById('top')!;
    const h1 = hero.querySelector('h1')!;
    const s = getComputedStyle(h1);
    return {
      height: Math.round(hero.getBoundingClientRect().height),
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      fontFamily: s.fontFamily,
      // Padding samping kontainer judul = jarak tepi kiri kontainer ke tepi layar
      gutter: Math.round(h1.parentElement!.getBoundingClientRect().left + parseFloat(getComputedStyle(h1.parentElement!).paddingLeft)),
    };
  });

test('hero rata tengah, ukurannya sama dengan hero beranda; tombol berdampingan (desktop) / bertumpuk penuh (HP)', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#top h1')).toBeVisible({ timeout: 20_000 });
  const home = await heroBox(page);
  const homeTitleWidth = (await page.locator('#top h1').boundingBox())!.width;
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  const hero = page.locator('#top');
  await expect(hero.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  await settled(page);
  const shoe = await heroBox(page);
  expectSameHero(shoe, home, page.viewportSize()!.height);
  const vp = page.viewportSize()!;
  expect(shoe.height, 'tinggi hero = tinggi layar').toBe(vp.height);

  // Logo hero (data uji bawaan): H1 tetap bernama partner (teks tersembunyi), logo alt = nama partner, setinggi huruf
  // kapital judul beranda, tidak lebih lebar dari judul beranda; logo kecil di atas kicker tidak tampil (tidak dobel)
  const h1 = hero.getByRole('heading', { level: 1, name: E2E_SHOE_CARE.name });
  await expect(h1).toBeVisible();
  const wordmark = h1.locator('img');
  await expect(wordmark).toHaveAttribute('alt', E2E_SHOE_CARE.name);
  await expect(wordmark).toHaveAttribute('width', /^\d+$/);
  await expect(wordmark).toHaveAttribute('height', /^\d+$/);
  await expect(h1.locator('.visually-hidden')).toHaveText(E2E_SHOE_CARE.name);
  await expect(hero.locator('img')).toHaveCount(2); // foto latar + logo hero
  const wm = (await wordmark.boundingBox())!;
  // Setinggi huruf kapital judul beranda: 0,686 × ukuran huruf judul (cap-height Archivo; sama dengan CSS logo)
  const homeCap = 0.686 * parseFloat(home.fontSize);
  expect(Math.abs(wm.height - homeCap), `tinggi logo ${wm.height} vs cap-height judul beranda ${homeCap}`).toBeLessThanOrEqual(1);
  expect(wm.width).toBeLessThanOrEqual(homeTitleWidth + 1);
  expect(wm.width).toBeGreaterThan(wm.height); // proporsi asli (wordmark melebar), tidak gepeng
  // Jarak: logo → tagline → deskripsi → badge tidak menempel (ikut jarak hero beranda)
  const tagline = hero.getByText('Tagline uji cuci sepatu.');
  const description = hero.getByText('Deskripsi uji layanan cuci sepatu partner.');
  const badge = hero.getByText(`Tersedia di ${bogor.name}`);
  expect(await gapBetween(h1, tagline)).toBeGreaterThanOrEqual(24);
  expect(await gapBetween(tagline, description)).toBeGreaterThanOrEqual(12);
  expect(await gapBetween(description, badge)).toBeGreaterThanOrEqual(32);
  expect(await clsOf(page), 'CLS halaman').toBeLessThan(0.005);
  await expectNoHorizontalScroll(page);

  // Semua isi hero di tengah horizontal (±2 px), teks rata tengah
  const parts = [
    wordmark,
    hero.getByText(E2E_SHOE_CARE.heroKicker, { exact: true }),
    hero.getByRole('heading', { level: 1 }),
    hero.getByText('Tagline uji cuci sepatu.'),
    hero.getByText('Deskripsi uji layanan cuci sepatu partner.'),
    hero.getByText(`Tersedia di ${bogor.name}`),
  ];
  for (const part of parts) {
    const b = (await part.boundingBox())!;
    expect(Math.abs(b.x + b.width / 2 - vp.width / 2), await part.evaluate((el) => el.outerHTML.slice(0, 60))).toBeLessThanOrEqual(2);
  }
  for (const text of ['Tagline uji cuci sepatu.', 'Deskripsi uji layanan cuci sepatu partner.']) {
    expect(await hero.getByText(text).evaluate((el) => getComputedStyle(el).textAlign)).toBe('center');
  }
  // Logo hero tanpa kotak/latar
  expect(await wordmark.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  // Isi di tengah vertikal: jarak ke atas (di bawah navbar) dan ke bawah layar seimbang
  // Teks kecil kustom dari CMS, garis dekoratif di kiri & kanan
  const kicker = hero.getByText(E2E_SHOE_CARE.heroKicker, { exact: true });
  const lines = await kicker.evaluate((el) => [getComputedStyle(el, '::before').width, getComputedStyle(el, '::after').width]);
  expect(lines).toEqual(['28px', '28px']);
  const first = (await kicker.boundingBox())!;
  const last = (await hero.getByRole('link', { name: 'Lihat Daftar Menu' }).boundingBox())!;
  expect(vp.height - (last.y + last.height), 'isi tidak menempel di bawah layar').toBeGreaterThan(40);
  expect(first.y).toBeGreaterThan(64);

  // Tombol: gaya hero beranda (utama terang, kedua outline), tanpa hijau WhatsApp
  const main = hero.getByRole('link', { name: 'Titip Sepatu via WhatsApp' });
  const menu = hero.getByRole('link', { name: 'Lihat Daftar Menu' });
  const bg = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg(main)).toBe('rgb(242, 239, 234)'); // --c-bone (variant light, sama dengan tombol utama hero beranda)
  expect(await bg(menu)).toBe('rgba(0, 0, 0, 0)'); // outline (variant ghost)
  const a = (await main.boundingBox())!;
  const b = (await menu.boundingBox())!;
  if (isMobile) {
    // Bertumpuk, penuh lebar kontainer
    expect(b.y).toBeGreaterThan(a.y + a.height - 1);
    expect(Math.round(a.width)).toBe(Math.round(b.width));
    expect(a.width).toBeGreaterThan(vp.width - 2 * 24);
  } else {
    // Berdampingan, pasangan tombol di tengah
    expect(Math.round(a.y)).toBe(Math.round(b.y));
    expect(Math.abs((a.x + b.x + b.width) / 2 - vp.width / 2)).toBeLessThanOrEqual(2);
  }
});

test('tanpa Logo hero: nama partner tampil sebagai teks judul, logo kecil di atas kicker, jarak tidak menempel', async ({ page }) => {
  await page.goto(`${NO_HERO_LOGO_URL}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#top h1')).toBeVisible({ timeout: 20_000 });
  await settled(page);
  const home = await heroBox(page);
  await page.goto(`${NO_HERO_LOGO_URL}${PAGE}`, { waitUntil: 'domcontentloaded' });
  const hero = page.locator('#top');
  const h1 = hero.getByRole('heading', { level: 1, name: E2E_SHOE_CARE.name });
  await expect(h1).toBeVisible({ timeout: 20_000 });
  await settled(page);
  await expect(h1).toHaveText(E2E_SHOE_CARE.name);
  await expect(h1.locator('img')).toHaveCount(0);
  // Teks kecil dikosongkan di CMS → tidak tampil; nama partner langsung di bawah logo kecil, isi tetap di tengah layar
  await expect(hero.getByText('Cuci Sepatu', { exact: true })).toHaveCount(0);
  await expect(hero.getByText(E2E_SHOE_CARE.heroKicker)).toHaveCount(0);
  expect(await h1.evaluate((el) => el.previousElementSibling?.tagName)).toBe('IMG');
  const vp = page.viewportSize()!;
  const title = (await h1.boundingBox())!;
  const lastBtn = (await hero.getByRole('link', { name: 'Lihat Daftar Menu' }).boundingBox())!;
  expect(title.y).toBeGreaterThan(64);
  expect(vp.height - (lastBtn.y + lastBtn.height)).toBeGreaterThan(40);
  expectSameHero(await heroBox(page), home, vp.height);
  // Logo kecil di atas kicker (kecil, tanpa kotak/latar)
  const logo = hero.locator('img').last();
  expect((await logo.boundingBox())!.height).toBeLessThanOrEqual(64);
  expect(await logo.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  const tagline = hero.getByText('Tagline uji cuci sepatu.');
  expect(await gapBetween(h1, tagline)).toBeGreaterThanOrEqual(24);
  expect(await gapBetween(hero.getByText('Deskripsi uji layanan cuci sepatu partner.'), hero.getByText(`Tersedia di ${bogor.name}`))).toBeGreaterThanOrEqual(32);
  // Font situs di-host sendiri, di-preload, dan render pertama menunggu font (src/lib/fontsReady.ts): judul teks & bar
  // pengumuman tergambar langsung dengan Archivo/Jakarta, tidak ada pergeseran karena ganti font
  expect(await clsOf(page), 'CLS halaman').toBeLessThan(0.005);
  await expectNoHorizontalScroll(page);
});

test('About Us: logo SVG tanpa bingkai (latar transparan, proporsional, rata tengah, ukuran dari viewBox)', async ({ page, isMobile }) => {
  await page.goto(`${NO_HERO_LOGO_URL}${PAGE}`, { waitUntil: 'domcontentloaded' });
  const about = page.locator('#tentang');
  await expect(about).toBeAttached({ timeout: 20_000 });
  // Font web termuat dulu (pergantian font teks judul/paragraf bukan urusan tes ini); logo dimuat saat digulir
  const since = await page.evaluate(async () => {
    await document.fonts.ready;
    return performance.now();
  });
  await about.scrollIntoViewIfNeeded();
  const logo = about.getByRole('img', { name: 'Logo About Us uji' });
  await expect(logo).toBeVisible();
  // width/height dari viewBox 800 × 400 → rasio diketahui sebelum gambar dimuat (tanpa CLS)
  await expect(logo).toHaveAttribute('width', '800');
  await expect(logo).toHaveAttribute('height', '400');
  const style = await logo.evaluate((el) => {
    const wrap = getComputedStyle(el.parentElement!.tagName === 'PICTURE' ? el.parentElement!.parentElement! : el.parentElement!);
    const s = getComputedStyle(el);
    return { fit: s.objectFit, radius: s.borderRadius, imgBg: s.backgroundColor, wrapBg: wrap.backgroundColor, wrapRadius: wrap.borderRadius, shadow: s.boxShadow };
  });
  expect(style).toEqual({ fit: 'contain', radius: '0px', imgBg: 'rgba(0, 0, 0, 0)', wrapBg: 'rgba(0, 0, 0, 0)', wrapRadius: '0px', shadow: 'none' });
  const box = (await logo.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(isMobile ? 200 : 320);
  expect(Math.abs(box.width / box.height - 2)).toBeLessThan(0.02); // proporsional (800 : 400)
  // Rata tengah di kolomnya
  const col = (await logo.evaluate((el) => {
    const r = el.closest('div')!.getBoundingClientRect();
    return { x: r.x, width: r.width };
  }))!;
  expect(Math.abs(box.x + box.width / 2 - (col.x + col.width / 2))).toBeLessThanOrEqual(2);
  // Tanpa CLS dari logo (width/height dari viewBox): tidak ada pergeseran di About sejak logo mulai dimuat
  expect(await clsWithin(page, '#tentang', since)).toBeLessThan(0.001);
  await expectNoHorizontalScroll(page);
});

test('tidak ada tombol yang tertutup tombol WhatsApp melayang', async ({ page, isMobile }) => {
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lokasi')).toBeAttached({ timeout: 20_000 });
  const buttons = page.locator('main a[href], main button');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(10);
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    if (!(await btn.isVisible())) continue;
    await scrollTo(page, btn, isMobile);
    await page.waitForTimeout(350);
    expect(await fabOverlaps(btn), `tombol WA melayang menutupi: ${await btn.textContent()}`).toBe(false);
  }
});

test('teaser beranda → /cuci-sepatu; anchor lama #cuci-sepatu → halaman; menu HP & footer', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const teaser = page.locator('#cuci-sepatu-teaser');
  await scrollTo(page, teaser, isMobile);
  // Tepat setelah Daftar Harga, tanpa tombol WhatsApp (hanya ringkasan)
  expect(await teaser.evaluate((el) => el.previousElementSibling?.id)).toBe('harga');
  await expect(teaser.getByRole('heading', { name: E2E_SHOE_CARE.name })).toBeVisible();
  // Label kecil teaser = teks kecil hero dari CMS
  await expect(teaser.getByText(E2E_SHOE_CARE.heroKicker)).toBeVisible();
  await expect(teaser).toContainText('Tagline uji cuci sepatu.');
  await expect(teaser.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
  // Teaser tetap tanpa harga
  for (const s of E2E_SHOE_CARE.services) await expect(teaser).not.toContainText(s.shownPrice);
  await expectNoHorizontalScroll(page);
  await teaser.getByRole('link', { name: /Lihat Layanan/ }).click();
  await expect(page).toHaveURL(/\/cuci-sepatu\/$/);
  await expect(page.getByRole('heading', { level: 1, name: E2E_SHOE_CARE.name })).toBeVisible();

  // Anchor lama
  await page.goto('/#cuci-sepatu', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/cuci-sepatu\/$/, { timeout: 20_000 });

  // Navbar desktop tidak menampilkan; menu HP & footer ke /cuci-sepatu/
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Cuci Sepatu' })).toHaveCount(0);
  if (isMobile) {
    await page.getByRole('button', { name: 'Buka menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Cuci Sepatu' })).toHaveAttribute('href', /\/cuci-sepatu\/$/);
    await page.getByRole('button', { name: 'Tutup menu' }).click();
  }
  const footer = page.locator('footer');
  await expect(footer).toBeAttached({ timeout: 20_000 });
  await expect(footer.getByRole('link', { name: 'Cuci Sepatu' })).toHaveAttribute('href', /\/cuci-sepatu\/$/);
});

test('halaman cabang: teaser hanya di cabang partner; meta description cabang partner menyebut cuci sepatu', async ({ page, request }) => {
  await page.goto(`/cabang/${bogor.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cuci-sepatu-teaser')).toBeAttached({ timeout: 20_000 });
  await page.goto(`/cabang/${cibubur.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#harga')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#cuci-sepatu-teaser')).toHaveCount(0);

  const meta = async (path: string) => (await (await request.get(path)).text()).match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  expect(await meta(`/cabang/${bogor.slug}/`)).toContain('cuci sepatu');
  expect(await meta(`/cabang/${cibubur.slug}/`)).not.toContain('cuci sepatu');
  expect(await meta('/')).not.toContain('cuci sepatu');
  expect((await (await request.get('/sitemap.xml')).text())).toContain('/cuci-sepatu/');
});
