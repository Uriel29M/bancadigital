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

  test('cabeçalho mobile fica compacto e usa navegação inferior', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');

    const topbar = page.locator('.topbar');
    await expect(topbar.locator('.main-nav')).toBeHidden();
    await expect(topbar.locator('[data-action="downloads"]')).toBeHidden();
    await expect(topbar.locator('[data-action="ranking"]')).toHaveCount(0);
    await expect(topbar.locator('[data-section="ranking"]')).toBeHidden();
    await expect(topbar.locator('[data-action="random"]')).toBeHidden();
    await expect(topbar.locator('[data-action="messages"]')).toBeHidden();

    const search = topbar.locator('[data-action="focus-search"]');
    const notifications = topbar.locator('[data-action="notifications-popup"]');
    const avatar = topbar.locator('[data-action="open-profile-page"]');
    await expect(search).toBeVisible();
    await expect(notifications).toBeVisible();
    await expect(avatar).toBeVisible();

    const searchBox = await search.boundingBox();
    expect(searchBox?.width).toBeGreaterThanOrEqual(44);
    expect(searchBox?.height).toBeGreaterThanOrEqual(44);

    const hero = page.locator('.hero');
    await expect(hero).toBeVisible();
    const heroBox = await hero.boundingBox();
    expect(heroBox?.height).toBeLessThanOrEqual(360);

    const heroContent = page.locator('.hero-content');
    const heroContentBox = await heroContent.boundingBox();
    expect(heroContentBox?.width).toBeGreaterThanOrEqual(320);

    const railViewport = page.locator('.rail-viewport').first();
    await expect(railViewport).toBeVisible();
    const carouselPeek = await railViewport.evaluate(viewport => {
      const rail = viewport.querySelector('.rail');
      const cards = rail ? Array.from(rail.children).filter(element => element.getBoundingClientRect().width > 0) : [];
      if (cards.length < 3) return null;
      const viewportBox = viewport.getBoundingClientRect();
      const thirdBox = cards[2].getBoundingClientRect();
      return Math.max(0, Math.min(viewportBox.right, thirdBox.right) - Math.max(viewportBox.left, thirdBox.left));
    });
    expect(carouselPeek).not.toBeNull();
    expect(carouselPeek).toBeGreaterThanOrEqual(20);
    expect(carouselPeek).toBeLessThanOrEqual(34);

    const publicCollectionsAlignment = await page.evaluate(() => {
      const content = document.querySelector('.content');
      if (!content) return null;
      const probe = document.createElement('section');
      probe.className = 'section';
      probe.innerHTML = '<div class="public-collections-grid"><article class="public-shelf-collection-card"></article><article class="public-shelf-collection-card"></article></div>';
      content.appendChild(probe);
      const grid = probe.querySelector('.public-collections-grid');
      const card = probe.querySelector('.public-shelf-collection-card');
      const contentBox = content.getBoundingClientRect();
      const gridBox = grid.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const paddingLeft = parseFloat(getComputedStyle(content).paddingLeft) || 0;
      const result = {
        expectedLeft: contentBox.left + paddingLeft,
        gridLeft: gridBox.left,
        cardLeft: cardBox.left,
        gridTransform: getComputedStyle(grid).transform,
        gridMarginLeft: getComputedStyle(grid).marginLeft
      };
      probe.remove();
      return result;
    });
    expect(publicCollectionsAlignment).not.toBeNull();
    expect(Math.abs(publicCollectionsAlignment.gridLeft - publicCollectionsAlignment.expectedLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(publicCollectionsAlignment.cardLeft - publicCollectionsAlignment.expectedLeft)).toBeLessThanOrEqual(1);
    expect(publicCollectionsAlignment.gridTransform).toBe('none');
    expect(publicCollectionsAlignment.gridMarginLeft).toBe('0px');

    const mobileTouchTargets = await page.evaluate(() => {
      const host = document.querySelector('#main');
      const probe = document.createElement('div');
      probe.innerHTML = '<button class="small-btn" data-touch-small>Teste</button><button class="chat-pin-action" data-touch-chat aria-label="Fixar">📌</button>';
      host.appendChild(probe);
      const small = probe.querySelector('[data-touch-small]').getBoundingClientRect();
      const chat = probe.querySelector('[data-touch-chat]').getBoundingClientRect();
      const result = { smallHeight: small.height, chatWidth: chat.width, chatHeight: chat.height };
      probe.remove();
      return result;
    });
    expect(mobileTouchTargets.smallHeight).toBeGreaterThanOrEqual(44);
    expect(mobileTouchTargets.chatWidth).toBeGreaterThanOrEqual(44);
    expect(mobileTouchTargets.chatHeight).toBeGreaterThanOrEqual(44);

    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.locator('[data-mobile-action="downloads"]')).toBeVisible();
    await expect(bottomNav.locator('[data-mobile-section="ranking"]')).toBeVisible();
    await expect(bottomNav.locator(':scope > [data-mobile-section="home"]')).toBeVisible();
    await expect(bottomNav.locator(':scope > [data-mobile-section="home"] .mobile-bottom-icon-image')).toHaveAttribute('src', /barracavermelhaicon\.png/);
    await expect(bottomNav.locator(':scope > [data-mobile-action="random"]')).toHaveCount(0);
    await expect(bottomNav.locator('[data-mobile-action="messages"]')).toBeVisible();

    const downloadBox = await bottomNav.locator('[data-mobile-action="downloads"]').boundingBox();
    expect(downloadBox?.height).toBeGreaterThanOrEqual(48);

    await bottomNav.locator('summary').click();
    await expect(bottomNav.locator('.mobile-more-popover')).toBeVisible();
    await expect(bottomNav.locator('.mobile-more-popover [data-mobile-action="random"]')).toBeVisible();
    await expect(bottomNav.locator('.mobile-more-popover [data-mobile-section="album"]')).toHaveCount(1);
    await expect(bottomNav.locator('.mobile-more-popover [data-mobile-section="home"]')).toHaveCount(0);
    await bottomNav.locator('[data-mobile-section="comics"]').click();
    await expect(page.locator('main')).toContainText(/Quadrinhos|ediç|série/i);
    await expect(bottomNav.locator('.mobile-more-menu')).not.toHaveAttribute('open', '');
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
