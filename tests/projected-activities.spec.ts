import { test, expect } from '@playwright/test';

test.describe('FTD: Seguimiento de Actividades en Proyectados y En Agenda', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Ingresar como Pablo Lamela (Administrador)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();
    await expect(page.getByTestId('presidency-hub-view')).toBeVisible();
  });

  test('1. En agenda y Proyectados: excluir actividades históricas (solo 2 pendientes) y probar "Pasar a gasto", pago parcial y "Cerrar sin gasto"', async ({
    page,
  }) => {
    // Verificar en el Panel que En agenda T4 solo muestra las 2 actividades vigentes/pendientes ($ 25.000,00) y no las 18 históricas
    await expect(page.getByTestId('kpi-reserved-quarter-amount')).toHaveText('$ 25.000,00');
    await expect(page.getByTestId('kpi-estimated-free-amount')).toBeVisible();
    await expect(page.getByTestId('kpi-reserved-org-AS')).toBeVisible();
    await expect(page.getByTestId('kpi-reserved-org-HJ')).toBeVisible();
    await expect(page.getByTestId('kpi-reserved-org-ESTACA')).toHaveCount(0);

    // Abrir Adultos Solteros (Modo Espejo) y verificar la tarjeta rediseñada con Comprometido ($ 15.000,00) y Saldo libre estimado
    await page.getByTestId('inspect-org-AS').click();
    await expect(page.getByTestId('leader-estimated-free-amount')).toBeVisible();
    await expect(page.getByTestId('leader-reserved-amount')).toHaveText('$ 15.000,00');
    await page.getByRole('button', { name: 'Panel', exact: true }).click();

    // Ir a Administración -> Finanzas
    const adminTrigger = page.getByTestId('hub-admin-menu-trigger');
    if (await adminTrigger.isVisible()) {
      await adminTrigger.click();
    }
    await page.getByTestId('hub-admin-operations-btn').click();

    // Verificar Control de cierre de trimestre (desplegable cerrado por defecto)
    await expect(page.getByTestId('quarter-close-checklist')).toBeVisible();
    await page.getByTestId('quarter-checklist-toggle').click();
    await expect(page.getByTestId('quarter-checklist-body')).toBeVisible();
    await expect(page.getByTestId('checklist-go-projected')).toBeVisible();
    await page.getByTestId('checklist-go-projected').click();

    // Verificar que el botón Proyectados muestre exactamente 2 (no 20)
    const projectedBtn = page.getByRole('button', { name: 'Proyectados (2)', exact: true });
    await expect(projectedBtn).toBeVisible();

    // Crear un gasto proyectado de prueba para no depender de datos previos
    await page.getByTestId('open-add-expense-modal-btn').click();
    await page.getByTestId('expense-category-PROJECTED').click();

    // Completar fecha vencida (ayer) para verificar que quede primero y con alerta "Pendiente de rendir"
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await page.locator('input[type="date"]').first().fill(yesterday);
    await page.getByPlaceholder('0,00').first().fill('10000');
    await page.getByPlaceholder('Ej: Compra de materiales para actividad').fill('Actividad Prueba Proyectado FTD');
    await page.getByRole('button', { name: /Guardar proyección/i }).click();

    // Debe aparecer en Proyectados con el botón "Pasar a gasto" y "Cerrar sin gasto"
    const row = page.locator('tr', { hasText: 'Actividad Prueba Proyectado FTD' }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('Pendiente de rendir');

    // Abrir "Pasar a gasto" -> debe abrir el modal directamente en modo Gasto Real y mostrar las opciones de cierre
    await row.getByRole('button', { name: /Pasar a gasto/i }).click();
    await expect(page.getByTestId('projected-settlement-options')).toBeVisible();
    await expect(page.getByTestId('projected-close-full-btn')).toBeVisible();
    await expect(page.getByTestId('projected-keep-partial-btn')).toBeVisible();

    // Probar seleccionar pago parcial con un monto menor
    await page.getByPlaceholder('0,00').first().fill('4000');
    await page.getByTestId('projected-keep-partial-btn').click();
    await expect(page.getByTestId('projected-settlement-options')).toContainText('$ 6.000,00');

    // Cerrar el modal sin guardar y probar "Cerrar sin gasto"
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await row.getByRole('button', { name: /Cerrar sin gasto/i }).click();
    await expect(page.locator('tr', { hasText: 'Actividad Prueba Proyectado FTD' })).toHaveCount(0);
  });
});
