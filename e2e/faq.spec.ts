import { expect, type Page } from '@playwright/test';
import { E2E_FAQ } from './fixtures/content';
import { expectNoHorizontalScroll, test } from './helpers';

/**
 * FAQ beranda (data uji e2e/fixtures/content.ts), 360 px & desktop:
 * - build bawaan (Tampilkan FAQ aktif): akordeon sebelum Lokasi, jawaban ada di HTML statis & JSON-LD FAQPage,
 *   item nonaktif / tanpa jawaban tidak tampil; /llms.txt tersedia;
 * - varian uniform (Tampilkan FAQ mati): bagian & JSON-LD tidak ada.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';

const jsonLdTypes = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].flatMap((m) => {
    const d = JSON.parse(m[1]);
    return (Array.isArray(d) ? d : [d]).map((x: { '@type': string }) => x);
  });

async function openFaq(page: Page, base = '') {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lokasi')).toBeAttached({ timeout: 20_000 });
}

test('FAQ aktif: akordeon aksesibel sebelum Lokasi, jawaban di HTML statis & JSON-LD FAQPage', async ({ page, request }) => {
  // HTML statis (tanpa JavaScript): pertanyaan & jawaban tampil, yang tersembunyi tidak
  const html = await (await request.get('/')).text();
  for (const q of E2E_FAQ.shown) expect(html).toContain(`<dt>${q.question}</dt><dd>${q.answer}</dd>`);
  for (const q of E2E_FAQ.hidden) expect(html).not.toContain(q);
  const faqLd = jsonLdTypes(html).find((x) => x['@type'] === 'FAQPage') as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] } | undefined;
  expect(faqLd?.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(E2E_FAQ.shown.map((q) => [q.question, q.answer]));

  await openFaq(page);
  const section = page.locator('#faq');
  await expect(section).toBeAttached({ timeout: 20_000 });
  expect(await section.evaluate((el) => el.nextElementSibling?.id)).toBe('lokasi');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('heading', { level: 2, name: E2E_FAQ.title })).toBeVisible();
  const items = section.locator('details');
  await expect(items).toHaveCount(2);
  await expect(section.locator('summary')).toHaveText(E2E_FAQ.shown.map((q) => q.question));
  for (const q of E2E_FAQ.hidden) await expect(section).not.toContainText(q);

  // Tertutup: jawaban ada di DOM tetapi tersembunyi; klik membuka, klik lagi menutup
  const first = items.first();
  const answer = first.getByText(E2E_FAQ.shown[0].answer);
  await expect(answer).toBeAttached();
  await expect(answer).toBeHidden();
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  await expect(answer).toBeVisible();
  await first.locator('summary').click();
  await expect(first).not.toHaveAttribute('open', '');
  // Keyboard: fokus ke summary lalu Enter
  await items.nth(1).locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(items.nth(1)).toHaveAttribute('open', '');
  await expectNoHorizontalScroll(page);

  const llms = await request.get('/llms.txt');
  expect(llms.status()).toBe(200);
  expect(llms.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await llms.text()).toContain(`### ${E2E_FAQ.shown[0].question}`);
});

test('FAQ mati: bagian & JSON-LD FAQPage tidak ada', async ({ page, request }) => {
  const html = await (await request.get(`${UNIFORM_URL}/`)).text();
  expect(jsonLdTypes(html).some((x) => x['@type'] === 'FAQPage')).toBe(false);
  expect(html).not.toContain(E2E_FAQ.title);
  await openFaq(page, UNIFORM_URL);
  await expect(page.locator('#faq')).toHaveCount(0);
  expect(await (await request.get(`${UNIFORM_URL}/llms.txt`)).text()).not.toContain('## FAQ');
});
