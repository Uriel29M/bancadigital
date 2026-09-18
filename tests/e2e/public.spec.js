import { test, expect } from '@playwright/test';

test.describe('Banca Digital — público', () => {
  test('home carrega sem erro fatal', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page).toHaveTitle(/Banca Digital/i);
    await expect(page.locator('.brand')).toBeVisible();
    await expect(page.locator('[data-section="comics"]')).toBeVisible();
    expect(errors.filter(message => !/ResizeObserver/i.test(message))).toEqual([]);
  });

  test('cadastro e login continuam acessíveis', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-action="open-profile-page"]').click();
    await expect(page.locator('#auth-form')).toBeVisible();
    await expect(page.locator('.auth-title')).toHaveText('Entrar');
    await page.locator('[data-auth-switch="signup"]').click();
    await expect(page.locator('.auth-title')).toHaveText('Criar conta');
    await expect(page.locator('#auth-form [name="email"]')).toBeVisible();
    await page.locator('[data-auth-switch="login"]').click();
    await expect(page.locator('.auth-title')).toHaveText('Entrar');
  });

  test('visitante não vê Administração nem envio de quadrinhos', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-action="open-admin"]')).toBeHidden();
    await expect(page.locator('[data-action="submit"]')).toBeHidden();
  });

  test('navegação para quadrinhos e facção não quebra', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-section="comics"]').click();
    await expect(page.locator('main')).toContainText(/Quadrinhos|ediç|série/i);
    await page.locator('[data-section="factions"]').click();
    await expect(page.locator('main')).not.toBeEmpty();
  });
});
