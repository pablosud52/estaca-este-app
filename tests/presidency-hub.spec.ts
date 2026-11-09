import { test, expect } from '@playwright/test';

test.describe('Paso 6.3: Hub Ejecutivo de Presidencia (PresidencyHub) y Bandeja de Aprobación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1. KPIs globales, evolución trimestral Q1-Q4 y gráfico interactivo Montos vs Porcentajes', async ({ page }) => {
    // Cambiar a Primer Consejero (PRESIDENCIA con permiso de aprobar)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-consejero1-01').click();

    await expect(page.getByTestId('presidency-hub-view')).toBeVisible();
    await expect(page.getByTestId('hub-user-name')).toHaveText('Primer Consejero');

    // Verificar KPI de Presupuesto Asignado a Organizaciones ($ 484.000,00) y Consolidado ($ 444.773,09)
    await expect(page.getByTestId('kpi-orgs-assigned-amount')).toHaveText('$ 484.000,00');
    await expect(page.getByTestId('kpi-consolidated-assigned-amount')).toHaveText('$ 444.773,09');

    // Verificar sección de evolución trimestral acumulativa (T1-T4)
    await expect(page.getByTestId('hub-quarter-card-T1')).toBeVisible();
    await expect(page.getByTestId('hub-quarter-card-T2')).toBeVisible();
    await expect(page.getByTestId('hub-quarter-card-T3')).toBeVisible();
    await expect(page.getByTestId('hub-quarter-card-T4')).toBeVisible();

    // Verificar Gráfico Chart.js y alternancia entre Montos ($) y Porcentajes (%)
    await expect(page.getByTestId('chart-canvas-container-MONTOS')).toBeVisible();
    await page.getByTestId('chart-mode-porcentajes').click();
    await expect(page.getByTestId('chart-canvas-container-PORCENTAJES')).toBeVisible();
  });

  test('2. Grid de las 8 organizaciones + Seminario y navegación Modo Espejo ida y vuelta', async ({ page }) => {
    // Cambiar a Administrador Permanente (Pablo Lamela)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();

    // Verificar las 9 tarjetas en el grid (8 organizaciones + Seminario)
    const orgCodes = ['MJ', 'HJ', 'SEMINARIO', 'PRIMARIA', 'SS', 'AS', 'JAS', 'CFS', 'ESTACA'];
    for (const code of orgCodes) {
      await expect(page.getByTestId(`org-card-${code}`)).toBeVisible();
    }

    // Entrar en Modo Espejo a Primaria ($ 38.500,00 asignado - $ 17.009,00 gastado = $ 21.491,00 disponible)
    await page.getByTestId('inspect-org-PRIMARIA').click();
    await expect(page.getByTestId('leader-view')).toBeVisible();
    await expect(page.getByTestId('balance-card-title')).toContainText('SALDO ACTUAL • Primaria');
    await expect(page.getByTestId('available-balance-amount')).toHaveText('$ 21.491,00');

    // Regresar al Hub Ejecutivo en un clic
    await page.getByTestId('back-to-hub-btn').click();
    await expect(page.getByTestId('presidency-hub-view')).toBeVisible();
  });

  test('3. Bandeja de Aprobación con indicador pulsante: Editar costo estimado, Aprobar y Rechazar propuestas', async ({ page }) => {
    // Ingresar como Primer Consejero (can_approve_activities: true)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-consejero1-01').click();

    // Verificar que el indicador pulsante está activo en la barra superior
    await expect(page.getByTestId('pending-proposals-pulse')).toBeVisible();

    // Abrir la Bandeja de Aprobación
    await page.getByTestId('hub-nav-approvals').click();
    await expect(page.getByTestId('activity-approval-tray')).toBeVisible();
    await expect(page.getByTestId('approval-permission-active')).toBeVisible();

    // Verificar que las tarjetas de propuestas 11 y 12 están presentes como pendientes
    await expect(page.getByTestId('proposal-card-11')).toBeVisible();
    await expect(page.getByTestId('proposal-card-12')).toBeVisible();

    // Editar la propuesta 11 (Campamento Anual de Mujeres Jóvenes: ajustar costo de 28000 a 30500)
    await page.getByTestId('edit-proposal-btn-11').click();
    await expect(page.getByTestId('proposal-edit-form-11')).toBeVisible();
    await page.getByTestId('edit-input-cost-11').fill('30500');
    await page.getByTestId('save-edit-approve-btn-11').click();

    // Verificar banner de confirmación con formato $ 30.500,00 y que la propuesta 11 pasó a la sección de resueltas
    await expect(page.getByTestId('approval-feedback-banner')).toContainText('$ 30.500,00');
    await expect(page.getByTestId('proposal-card-11')).toHaveCount(0);
    await expect(page.getByTestId('resolved-activity-11')).toContainText('$ 30.500,00');

    // Rechazar la propuesta 12 (Jornada de Puertas Abiertas FamilySearch)
    await page.getByTestId('reject-proposal-btn-12').click();
    await page.getByTestId('reject-reason-input-12').fill('Se reprogramará para el trimestre siguiente');
    await page.getByTestId('confirm-reject-btn-12').click();

    await expect(page.getByTestId('proposal-card-12')).toHaveCount(0);
    await expect(page.getByTestId('resolved-activity-12')).toContainText('Rechazada');
  });

  test('4. Permiso granular en Presidencia: Secretario de Estaca visualiza Bandeja en modo solo lectura', async ({ page }) => {
    // Cambiar a Secretario de Estaca (can_approve_activities: false)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-secretario-01').click();

    await page.getByTestId('hub-nav-approvals').click();
    await expect(page.getByTestId('approval-permission-readonly')).toBeVisible();
    await expect(page.getByTestId('readonly-presidency-notice')).toBeVisible();

    // No debe mostrar botones de aprobar/editar/rechazar
    await expect(page.getByTestId('approve-proposal-btn-11')).toHaveCount(0);
    await expect(page.getByTestId('edit-proposal-btn-11')).toHaveCount(0);
    await expect(page.getByTestId('reject-proposal-btn-11')).toHaveCount(0);
  });
});
