import { test, expect } from '@playwright/test';

test.describe('E2E — Directorio Unificado (Modo Lectura + Gestionar + Badges Simplificados)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('AC-1, AC-2, AC-3 y AC-4: Acceso único, Modo Lectura por defecto, Gestionar y badges simplificados', async ({
    page,
  }) => {
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();

    // AC-1: Sin botón duplicado de Directorio dentro de Administración (escritorio)
    const adminMenuTrigger = page.getByTestId('hub-admin-menu-trigger');
    if (await adminMenuTrigger.isVisible()) {
      await adminMenuTrigger.click();
      await expect(page.getByTestId('hub-admin-users-btn')).toHaveCount(0);
      await adminMenuTrigger.click();
    }

    // Entrar al único botón Directorio
    const desktopDirBtn = page.getByTestId('hub-nav-directory');
    if (await desktopDirBtn.isVisible()) {
      await desktopDirBtn.click();
    } else {
      await page.getByTestId('mobile-menu-toggle').click();
      await expect(page.getByTestId('drawer-admin-users-btn')).toHaveCount(0);
      await page.getByTestId('drawer-nav-directory').click();
    }

    // AC-2: Abre en Modo Lectura con botón Gestionar visible
    await expect(page.getByTestId('leaders-directory-view')).toBeVisible();
    await expect(page.getByTestId('directory-manage-toggle')).toBeVisible();
    await expect(page.getByTestId('user-management-panel')).toHaveCount(0);

    // AC-3: Activar Gestionar -> muestra panel de gestión completo
    await page.getByTestId('directory-manage-toggle').click();
    await expect(page.getByTestId('user-management-panel')).toBeVisible();

    // AC-4: Desplegar Presidencia y verificar badges simplificados ("Admin", "Acceso fijo")
    await page.getByTestId('org-accordion-toggle-PRESIDENCIA').click();
    await expect(page.getByTestId('role-badge-pres-presidente')).toHaveText('Admin');
    await expect(page.getByTestId('toggle-access-pres-presidente')).toContainText('Acceso fijo');

    // Desactivar Gestionar -> regresa limpio al Modo Lectura
    await page.getByTestId('directory-manage-toggle').click();
    await expect(page.getByTestId('leaders-directory-view')).toBeVisible();
    await expect(page.getByTestId('user-management-panel')).toHaveCount(0);
  });

  test('AC-5: Presidencia no Admin nunca ve botón Gestionar en Directorio', async ({ page }) => {
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-consejero1-01').click();

    const desktopDirBtn = page.getByTestId('hub-nav-directory');
    if (await desktopDirBtn.isVisible()) {
      await desktopDirBtn.click();
    } else {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-nav-directory').click();
    }

    await expect(page.getByTestId('leaders-directory-view')).toBeVisible();
    await expect(page.getByTestId('directory-manage-toggle')).toHaveCount(0);
    await expect(page.getByTestId('user-management-panel')).toHaveCount(0);
  });
});
