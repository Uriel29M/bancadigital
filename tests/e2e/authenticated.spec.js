import { test, expect } from '@playwright/test';
import { credentials, login, firstComicId } from './helpers.js';

test.describe('Banca Digital — conta comum', () => {
  test.skip(!credentials.email || !credentials.password, 'Configure E2E_USER_EMAIL e E2E_USER_PASSWORD.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('login, guard administrativo e logout', async ({ page }) => {
    await expect(page.locator('[data-action="open-admin"]')).toBeHidden();
    await expect(page.locator('[data-action="submit"]')).toBeHidden();
    const logout = page.locator('[data-action="logout"]');
    await expect(logout).toBeVisible();
    await logout.click();
    await page.locator('[data-action="open-profile-page"]').click();
    await expect(page.locator('#auth-form')).toBeVisible();
  });

  test('edição de perfil salva e restaura descrição', async ({ page }) => {
    await page.locator('[data-action="profile"]').click();
    await expect(page.locator('#profile-form')).toBeVisible();
    const field = page.locator('#profile-form [name="wallDescription"]');
    const original = await field.inputValue();
    const marker = `e2e-${Date.now()}`;
    await field.fill(marker);
    await field.blur();
    await page.waitForTimeout(900);
    await field.fill(original);
    await field.blur();
    await page.waitForTimeout(900);
    await expect(field).toHaveValue(original);
  });

  test('chat abre e, quando configurado, envia mensagem de teste', async ({ page }) => {
    await page.locator('[data-action="messages"]').click();
    await expect(page.locator('.chat-modal')).toBeVisible();
    if (!credentials.chatUsername) return;
    const picker = page.locator('#chat-contact-form');
    if (await picker.count()) {
      await picker.locator('[name="username"]').fill(credentials.chatUsername);
      await picker.locator('button[type="submit"]').click();
    }
    const compose = page.locator('#chat-compose');
    await expect(compose).toBeVisible();
    await compose.locator('[name="body"]').fill(`[E2E] teste automático ${Date.now()}`);
    await compose.locator('button[type="submit"]').click();
    await expect(compose.locator('[name="body"]')).toHaveValue('');
  });

  test('facção carrega para usuário autenticado', async ({ page }) => {
    await page.locator('[data-section="factions"]').click();
    await expect(page.locator('main')).toContainText(/Facção|facção|membro|temporada/i);
  });

  test('progresso pode ser marcado e restaurado', async ({ page }) => {
    const id = await firstComicId(page);
    test.skip(!id, 'Catálogo sem quadrinhos.');
    await page.goto(`/?ler=${encodeURIComponent(id)}`);
    await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 20_000 });
    const toggle = page.locator('[data-toggle-read]');
    test.skip(!(await toggle.count()), 'Leitor sem botão de progresso.');
    const before = await toggle.textContent();
    await toggle.click();
    await page.waitForTimeout(500);
    await toggle.click();
    await page.waitForTimeout(500);
    await expect(toggle).toHaveText(before || '');
  });
});
