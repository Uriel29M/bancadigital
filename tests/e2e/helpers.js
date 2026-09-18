import { expect } from '@playwright/test';

export const credentials = {
  email: process.env.E2E_USER_EMAIL || '',
  password: process.env.E2E_USER_PASSWORD || '',
  chatUsername: process.env.E2E_CHAT_USERNAME || ''
};

export async function login(page) {
  await page.goto('/');
  await page.locator('[data-action="open-profile-page"]').click();
  await expect(page.locator('#auth-form')).toBeVisible();
  await page.locator('#auth-form [name="username"]').fill(credentials.email);
  await page.locator('#auth-form [name="password"]').fill(credentials.password);
  await page.locator('#auth-form button[type="submit"]').click();
  await expect(page.locator('#auth-form')).toHaveCount(0, { timeout: 15_000 });
}

export async function firstComicId(page) {
  return page.evaluate(() => {
    const item = (window.DEFAULT_LIBRARY || []).find(entry => entry?.type === 'comic' && entry?.id);
    return item?.id || null;
  });
}
