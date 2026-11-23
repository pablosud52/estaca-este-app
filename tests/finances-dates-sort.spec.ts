import { test, expect } from '@playwright/test';

test.describe('E2E — Finanzas: Orden por fecha, Filtro por rango Desde/Hasta y Estética', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('AC-1, AC-2 y AC-3: Orden por fecha (Pendientes LCR arriba) y filtro Desde/Hasta en Gastos y Movimientos', async ({
    page,
  }) => {
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();

    // Ir a Finanzas (Administración -> Finanzas)
    const adminMenuTrigger = page.getByTestId('hub-admin-menu-trigger');
    if (await adminMenuTrigger.isVisible()) {
      await adminMenuTrigger.click();
      await page.getByTestId('hub-admin-operations-btn').click();
    } else {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-admin-operations-btn').click();
    }

    await expect(page.getByTestId('ledger-date-filter-toggle')).toBeVisible();

    // AC-1: Invertir orden por fecha en Gastos (encabezado en PC o botón en móvil)
    const ledgerHeaderSort = page.getByTestId('ledger-date-sort-header');
    if (await ledgerHeaderSort.isVisible()) {
      await ledgerHeaderSort.click();
      await expect(ledgerHeaderSort).toHaveAttribute('title', /más antiguo a más reciente/i);
      await ledgerHeaderSort.click();
      await expect(ledgerHeaderSort).toHaveAttribute('title', /más reciente a más antiguo/i);
    } else {
      const mobileSortBtn = page.getByTestId('ledger-date-sort-mobile');
      await expect(mobileSortBtn).toBeVisible();
      await mobileSortBtn.click();
      await mobileSortBtn.click();
    }

    // AC-3 (Gastos): Abrir filtro Fechas, filtrar por rango Desde/Hasta y limpiar
    await page.getByTestId('ledger-date-filter-toggle').click();
    await expect(page.getByTestId('ledger-date-range-bar')).toBeVisible();
    await page.getByTestId('ledger-date-from').fill('2026-01-01');
    await page.getByTestId('ledger-date-to').fill('2026-01-31');
    await expect(page.getByTestId('ledger-date-clear')).toBeVisible();
    await page.getByTestId('ledger-date-clear').click();
    await expect(page.getByTestId('ledger-date-clear')).toHaveCount(0);

    // Cambiar a pestaña Movimientos
    await page.getByRole('button', { name: /Movimientos/i }).first().click();
    await expect(page.getByTestId('withdrawal-date-filter-toggle')).toBeVisible();

    // AC-2: Invertir orden por fecha en Movimientos
    const withdrawalHeaderSort = page.getByTestId('withdrawal-date-sort-header');
    if (await withdrawalHeaderSort.isVisible()) {
      await withdrawalHeaderSort.click();
      await expect(withdrawalHeaderSort).toHaveAttribute('title', /más antiguo a más reciente/i);
      await withdrawalHeaderSort.click();
      await expect(withdrawalHeaderSort).toHaveAttribute('title', /más reciente a más antiguo/i);
    } else {
      const mobileWSortBtn = page.getByTestId('withdrawal-date-sort-mobile');
      await expect(mobileWSortBtn).toBeVisible();
      await mobileWSortBtn.click();
      await mobileWSortBtn.click();
    }

    // AC-3 (Movimientos): Abrir filtro Fechas, filtrar y limpiar
    await page.getByTestId('withdrawal-date-filter-toggle').click();
    await expect(page.getByTestId('withdrawal-date-range-bar')).toBeVisible();
    await page.getByTestId('withdrawal-date-from').fill('2026-01-01');
    await page.getByTestId('withdrawal-date-to').fill('2026-03-31');
    await expect(page.getByTestId('withdrawal-date-clear')).toBeVisible();
    await page.getByTestId('withdrawal-date-clear').click();
    await expect(page.getByTestId('withdrawal-date-clear')).toHaveCount(0);
  });
});
