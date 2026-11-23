import { test, expect } from '@playwright/test';

test.describe('E2E — Proveedores Unificado (Modo Lectura Tarjetas + Gestionar + Tarjetas/Lista)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('AC-1, AC-2 y AC-3: Acceso único, Modo Lectura en Tarjetas por defecto y Gestionar con switch Tarjetas/Lista', async ({
    page,
  }) => {
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();

    // AC-1: Sin botón duplicado de Proveedores dentro de Administración (escritorio)
    const adminMenuTrigger = page.getByTestId('hub-admin-menu-trigger');
    if (await adminMenuTrigger.isVisible()) {
      await adminMenuTrigger.click();
      await expect(page.getByTestId('hub-admin-suppliers-btn')).toHaveCount(0);
      await adminMenuTrigger.click();
    }

    // Entrar al único botón Proveedores
    const desktopSupBtn = page.getByTestId('hub-nav-suppliers');
    if (await desktopSupBtn.isVisible()) {
      await desktopSupBtn.click();
    } else {
      await page.getByTestId('mobile-menu-toggle').click();
      await expect(page.getByTestId('drawer-admin-suppliers-btn')).toHaveCount(0);
      await page.getByTestId('drawer-nav-suppliers').click();
    }

    // AC-2: Abre siempre en Modo Lectura en Tarjetas (sin botones de gestión)
    await expect(page.getByTestId('suppliers-cards-view-container')).toBeVisible();
    await expect(page.getByTestId('suppliers-manage-toggle')).toBeVisible();
    await expect(page.getByTestId('suppliers-manage-bar')).toHaveCount(0);
    await expect(page.getByTestId('suppliers-add-btn')).toHaveCount(0);
    await expect(page.locator('[data-testid^="edit-supplier-btn-"]')).toHaveCount(0);

    // AC-3: Activar Gestionar -> habilita controles, sigue en Tarjetas y permite pasar a Lista
    await page.getByTestId('suppliers-manage-toggle').click();
    await expect(page.getByTestId('suppliers-manage-bar')).toBeVisible();
    await expect(page.getByTestId('suppliers-add-btn')).toBeVisible();
    await expect(page.getByTestId('suppliers-manage-categories-btn')).toBeVisible();
    await expect(page.getByTestId('suppliers-tab-pending')).toBeVisible();
    await expect(page.getByTestId('suppliers-view-mode-switcher')).toBeVisible();
    await expect(page.getByTestId('suppliers-cards-view-container')).toBeVisible();
    await expect(page.locator('[data-testid^="edit-supplier-btn-"]').first()).toBeVisible();

    // Pasar a Modo Lista y volver a Tarjetas
    await page.getByTestId('suppliers-mode-list-btn').click();
    await expect(page.getByTestId('suppliers-list-view-container')).toBeVisible();
    await page.getByTestId('suppliers-mode-cards-btn').click();
    await expect(page.getByTestId('suppliers-cards-view-container')).toBeVisible();

    // Desactivar Gestionar -> vuelve limpio a Modo Lectura en Tarjetas
    await page.getByTestId('suppliers-manage-toggle').click();
    await expect(page.getByTestId('suppliers-manage-bar')).toHaveCount(0);
    await expect(page.getByTestId('suppliers-cards-view-container')).toBeVisible();
    await expect(page.locator('[data-testid^="edit-supplier-btn-"]')).toHaveCount(0);
  });

  test('AC-5: Presidencia no Admin y Líder nunca ven botón Gestionar en Proveedores', async ({
    page,
  }) => {
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-consejero1-01').click();

    const desktopSupBtn = page.getByTestId('hub-nav-suppliers');
    if (await desktopSupBtn.isVisible()) {
      await desktopSupBtn.click();
    } else {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-nav-suppliers').click();
    }

    await expect(page.getByTestId('suppliers-cards-view-container')).toBeVisible();
    await expect(page.getByTestId('suppliers-manage-toggle')).toHaveCount(0);
    await expect(page.getByTestId('suppliers-manage-bar')).toHaveCount(0);
  });
});
