import { expect } from '@playwright/test';
import { E2E_PRICING } from './fixtures/content';
import { expectNoHorizontalScroll, test } from './helpers';

/** Daftar Harga (data uji e2e/fixtures/content.ts): 3 kategori berurutan, format "K", "Start from", deskripsi. 360 px & desktop. */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const CATEGORIES = ['Haircut', 'Special Treatment', 'Woman Haircut & Treatment'];

test('Daftar Harga: 3 kategori, harga "K" tanpa Rp, "Start from", deskripsi di bawah nama', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const section = page.locator('#harga');
  await expect(section).toBeAttached({ timeout: 20_000 });
  await section.scrollIntoViewIfNeeded();

  if (isMobile) {
    // HP: tab per kategori, urutan sesuai daftar
    const tabs = section.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    expect((await tabs.evaluateAll((ts) => ts.map((t) => t.childNodes[0].textContent?.trim())))).toEqual(CATEGORIES);
    await tabs.nth(1).click();
  } else {
    expect(await section.locator('h3').allTextContents()).toEqual(CATEGORIES);
  }

  const row = (name: string) => section.locator('li', { hasText: name }).first();
  await expect(row('Coloring Fashion Uji')).toContainText('Start from400K');
  await expect(row('Coloring Fashion Uji')).toContainText('Fashion / trend hair coloring');
  await expect(row('Dreadlock Uji')).toContainText('Start from1500K');
  if (!isMobile) {
    await expect(row('White Grooming Uji')).toContainText('100K');
    await expect(row('White Grooming Uji')).not.toContainText('Start from');
    await expect(row('Black Grooming Uji')).not.toContainText('Haircut + Hair Wash'); // tanpa deskripsi
  }
  await expect(section.locator('ul').first()).not.toContainText('Rp');
  await expect(section).not.toContainText('Item Lama Uji');
  expect(E2E_PRICING.filter((p) => !('isActive' in p)).length).toBe(6);
  await expectNoHorizontalScroll(page);
});
