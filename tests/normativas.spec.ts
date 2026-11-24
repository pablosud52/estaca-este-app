import { test, expect, type Page } from '@playwright/test';

async function openNormativasFromAdminMenu(page: Page) {
  const adminMenuTrigger = page.getByTestId('hub-admin-menu-trigger');
  if (await adminMenuTrigger.isVisible()) {
    await adminMenuTrigger.click();
    const desktopBtn = page.getByTestId('hub-admin-info-btn');
    await expect(desktopBtn).toBeVisible();
    await expect(desktopBtn).toContainText('Normativas');
    await desktopBtn.click();
  } else {
    await page.getByTestId('mobile-menu-toggle').click();
    const drawerBtn = page.getByTestId('drawer-admin-info-btn');
    await expect(drawerBtn).toBeVisible();
    await expect(drawerBtn).toContainText('Normativas');
    await drawerBtn.click();
  }
}

test.describe('E2E — Normativas: 3 pestañas, buscador interactivo, visibilidad y visor PDF integrado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('AC-1, AC-2, AC-3, AC-4 y AC-5: Admin accede a Normativas, busca conceptos, navega las 3 pestañas y abre el PDF dentro de la app', async ({
    page,
  }) => {
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();

    await openNormativasFromAdminMenu(page);

    await expect(page.getByTestId('financial-info-section')).toBeVisible();
    await expect(page.getByTestId('info-superadmin-draft-banner')).toHaveCount(0);

    // AC-2: 4 pestañas visibles y Resumen Operativo activa por defecto (sin botón de PDF)
    await expect(page.getByTestId('normativa-tab-OPERATIONAL_SUMMARY')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('normativa-tab-FUNDS_USE')).toBeVisible();
    await expect(page.getByTestId('normativa-tab-ANNUAL_CLOSING')).toBeVisible();
    await expect(page.getByTestId('normativa-tab-MONEY_EXCEPTION')).toBeVisible();
    await expect(page.getByTestId('normativa-panel-OPERATIONAL_SUMMARY')).toBeVisible();
    await expect(page.getByTestId('normativa-panel-OPERATIONAL_SUMMARY')).toContainText('USD 1.500');
    await expect(page.getByTestId('normativa-panel-OPERATIONAL_SUMMARY')).toContainText('Día 25 al 26');
    await expect(page.getByTestId('normativa-panel-OPERATIONAL_SUMMARY')).toContainText('Último día del mes');
    await expect(page.getByTestId('normativa-open-pdf-btn')).toHaveCount(0);

    // Cambiar a Uso Apropiado de los Fondos
    await page.getByTestId('normativa-tab-FUNDS_USE').click();
    await expect(page.getByTestId('normativa-panel-FUNDS_USE')).toBeVisible();
    await expect(page.getByTestId('normativas-funds-count')).toContainText('27');

    // AC-3: Buscador y filtro por categoría + nota integrada (D)
    const searchInput = page.getByTestId('normativas-funds-search');
    await searchInput.fill('Templo');
    await expect(page.getByTestId('normativa-fund-item-27')).toBeVisible();
    await expect(page.getByTestId('normativa-fund-item-27').getByTestId('normativa-note-D')).toBeVisible();

    await page.getByTestId('normativas-category-pill-PRESUPUESTO').click();
    await expect(page.getByTestId('normativa-fund-item-26')).toBeVisible();
    await expect(page.getByTestId('normativa-fund-item-27')).toHaveCount(0);

    await searchInput.fill('');
    await page.getByTestId('normativas-category-pill-ALL').click();
    await expect(page.getByTestId('normativas-funds-count')).toContainText('Mostrando 27 de 27');

    // AC-5: Abrir visor PDF integrado desde Uso Apropiado de los Fondos
    await page.getByTestId('normativa-open-pdf-btn').click();
    await expect(page.getByTestId('pdf-viewer-modal')).toBeVisible();
    await expect(page.getByTestId('pdf-viewer-iframe')).toHaveAttribute(
      'src',
      /\/docs\/normativas\/uso-apropiado-fondos-2026\.pdf/
    );
    await expect(page.getByTestId('pdf-viewer-download-btn')).toBeVisible();
    await expect(page.getByTestId('pdf-viewer-share-btn')).toBeVisible();
    await page.getByTestId('pdf-viewer-close-btn').click();
    await expect(page.getByTestId('pdf-viewer-modal')).toHaveCount(0);

    // AC-4: Pestaña Cierre Anual y su PDF
    await page.getByTestId('normativa-tab-ANNUAL_CLOSING').click();
    await expect(page.getByTestId('normativa-panel-ANNUAL_CLOSING')).toBeVisible();
    await expect(page.getByTestId('normativa-panel-ANNUAL_CLOSING')).toContainText('Tope del 50%');
    await expect(page.getByTestId('normativa-panel-ANNUAL_CLOSING')).toContainText('Ejemplo 1 (Excede)');

    await page.getByTestId('normativa-open-pdf-btn').click();
    await expect(page.getByTestId('pdf-viewer-iframe')).toHaveAttribute(
      'src',
      /\/docs\/normativas\/cierre-anual\.pdf/
    );
    await page.getByTestId('pdf-viewer-close-btn').click();

    // AC-4: Pestaña Excepción de Dinero y su PDF
    await page.getByTestId('normativa-tab-MONEY_EXCEPTION').click();
    await expect(page.getByTestId('normativa-panel-MONEY_EXCEPTION')).toBeVisible();
    await expect(page.getByTestId('normativa-panel-MONEY_EXCEPTION')).toContainText('2010');
    await expect(page.getByTestId('normativa-panel-MONEY_EXCEPTION')).toContainText('30 y 40 días');

    await page.getByTestId('normativa-open-pdf-btn').click();
    await expect(page.getByTestId('pdf-viewer-iframe')).toHaveAttribute(
      'src',
      /\/docs\/normativas\/excepcion-de-dinero-2024\.pdf/
    );
    await page.getByTestId('pdf-viewer-close-btn').click();
  });

  test('AC-1: Presidencia no-Admin puede acceder a Normativas y Líder no tiene menú Administración', async ({
    page,
  }) => {
    // Presidencia (Consejero, sin rol ADMIN)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-consejero1-01').click();

    await openNormativasFromAdminMenu(page);
    await expect(page.getByTestId('financial-info-section')).toBeVisible();
    await expect(page.getByTestId('info-superadmin-draft-banner')).toHaveCount(0);

    // Líder de organización: no tiene acceso al menú Administración ni a Normativas
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-lider-primaria-01').click();
    await expect(page.getByTestId('hub-admin-menu-trigger')).toHaveCount(0);
    await expect(page.getByTestId('financial-info-section')).toHaveCount(0);
  });
});
