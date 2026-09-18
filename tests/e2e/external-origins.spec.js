import { test, expect } from '@playwright/test';

const origins = [
  ['Telegram', /telegram|functions\/v1\/telegram/i],
  ['MediaFire', /mediafire/i],
  ['Google Drive', /drive\.google|googleusercontent/i],
  ['4shared', /4shared/i]
];

async function catalog(page) {
  await page.goto('/');
  await page.waitForFunction(() => Array.isArray(window.DEFAULT_LIBRARY) && window.DEFAULT_LIBRARY.length > 0);
  return page.evaluate(() => (window.DEFAULT_LIBRARY || []).map(item => ({
    id: item.id,
    format: String(item.format || '').toLowerCase(),
    urls: [item.fileUrl, item.telegramUrl, item.url, item.sourceUrl, ...(item.backupUrls || [])].filter(Boolean)
  })));
}

test.describe('fontes externas @external', () => {
  for (const [name, pattern] of origins) {
    test(`${name}: existe entrada válida e leitor inicia`, async ({ page }) => {
      const items = await catalog(page);
      const item = items.find(entry => entry.urls.some(url => pattern.test(String(url))));
      test.skip(!item, `Nenhuma edição ${name} no catálogo atual.`);
      await page.goto(`/?ler=${encodeURIComponent(item.id)}`);
      await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.reader-body')).toBeVisible();
    });
  }
});

test.describe('formatos reais do catálogo @external', () => {
  for (const format of ['pdf', 'cbz', 'cbr']) {
    test(`${format.toUpperCase()}: leitor inicia`, async ({ page }) => {
      const items = await catalog(page);
      const item = items.find(entry => entry.format === format);
      test.skip(!item, `Nenhuma edição ${format.toUpperCase()} no catálogo atual.`);
      await page.goto(`/?ler=${encodeURIComponent(item.id)}`);
      await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.reader-body')).toBeVisible();
    });
  }
});
