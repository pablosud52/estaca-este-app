import { test, expect, Page } from '@playwright/test';

async function navigateToHubTab(
  page: Page,
  tab: 'DASHBOARD' | 'APPROVALS' | 'USERS' | 'OPERATIONS'
) {
  const mobileToggle = page.getByTestId('mobile-menu-toggle');
  if (await mobileToggle.isVisible()) {
    await mobileToggle.click();
    const drawerMap = {
      DASHBOARD: 'drawer-nav-dashboard',
      APPROVALS: 'drawer-nav-approvals',
      USERS: 'drawer-admin-users-btn',
      OPERATIONS: 'drawer-admin-operations-btn',
    } as const;
    await page.getByTestId(drawerMap[tab]).click();
  } else {
    const desktopMap = {
      DASHBOARD: 'hub-nav-dashboard',
      APPROVALS: 'hub-nav-approvals',
      USERS: 'hub-admin-users-btn',
      OPERATIONS: 'hub-admin-operations-btn',
    } as const;
    await page.getByTestId(desktopMap[tab]).click();
  }
}

test.describe('Paso 6.3: Hub Ejecutivo (Principio Menos es Más y Matemática Exacta Excel)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('1. Tarjeta Maestra PRESUPUESTO DISPONIBLE ($ 114.168,09), Resumen por trimestre y Gráfica Nuevas Generaciones', async ({
    page,
  }, testInfo) => {
    // Cambiar a Primer Consejero (PRESIDENCIA)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-consejero1-01').click();

    await expect(page.getByTestId('presidency-hub-view')).toBeVisible();
    await expect(page.getByTestId('hub-user-name')).toHaveText('Primer Consejero');

    // Selector de año para Presidencia/Admin tiene 2025, 2026 y 2027
    const yearSelect = page.getByTestId('year-selector-dropdown');
    await expect(yearSelect.locator('option')).toHaveCount(3);

    // 1. Verificar Tarjeta Maestra PRESUPUESTO DISPONIBLE ($ 114.168,09) y Asignado 2026 ($ 419.773,09)
    await expect(page.getByTestId('kpi-consolidated-available-amount')).toHaveText('$ 114.168,09');
    await expect(page.getByTestId('kpi-consolidated-assigned-amount')).toHaveText(
      'Asignado 2026: $ 419.773,09'
    );
    await expect(page.getByTestId('kpi-pending-render-alert')).toContainText(
      '⚠️ $ 15.506,00 pendientes de rendir'
    );
    await expect(page.getByTestId('kpi-pending-render-note')).toHaveText(
      'ℹ️ Este importe ya está contemplado en el presupuesto disponible mostrado arriba.'
    );

    // 2. Verificar "Resumen por trimestre" (T1 a T4)
    await expect(page.getByTestId('hub-quarter-available-T1')).toHaveText('$ 194.468,69');
    await expect(page.getByTestId('hub-quarter-income-T1')).toHaveText('$ 71.440,80');
    await expect(page.getByTestId('hub-quarter-carryover-T1')).toHaveText('$ 123.027,89');
    await expect(page.getByTestId('hub-quarter-spent-T1')).toHaveText('$ 152.846,00');

    await expect(page.getByTestId('hub-quarter-available-T2')).toHaveText('$ 117.514,09');
    await expect(page.getByTestId('hub-quarter-available-T3')).toHaveText('$ 127.923,69');
    await expect(page.getByTestId('hub-quarter-available-T4')).toHaveText('$ 154.338,09');

    // 3. Verificar Gráfica "Asignación de fondos a cada organización" y Pastilla "Nuevas Generaciones"
    await expect(page.getByTestId('youth-focus-amount')).toHaveText('$ 146.000,00 (34,8%)');
    await page.getByTestId('chart-period-T1').click();
    await expect(page.getByTestId('youth-focus-amount')).toHaveText('$ 70.000,00 (36,0%)');
    await page.getByTestId('chart-period-GLOBAL').click();

    await expect(page.getByTestId('chart-canvas-container-MONTOS')).toBeVisible();

    // Captura visual del Panel rediseñado (Escritorio y Móvil) con scroll en el tope
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const isMobile = testInfo.project.name.includes('Mobile');
    await page.screenshot({
      path: `C:/Users/Pablo/.gemini/antigravity/brain/62fbf75c-7edb-420d-8e4a-03d04293c255/panel_${
        isMobile ? 'mobile' : 'desktop'
      }.png`,
      fullPage: true,
    });

    await page.getByTestId('chart-mode-porcentajes').click();
    await expect(page.getByTestId('chart-canvas-container-PORCENTAJES')).toBeVisible();
  });

  test('2. Sección Estado por Organización minimalista, Modo Espejo y Menú Hamburguesa Móvil (Drawer)', async ({
    page,
  }) => {
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();

    // Verificar saldos exactos por organización en las tarjetas minimalistas
    await expect(page.getByTestId('org-card-available-MJ')).toHaveText('$ 17.505,00');
    await expect(page.getByTestId('org-card-available-HJ')).toHaveText('$ 13.703,00');
    await expect(page.getByTestId('org-card-available-SEMINARIO')).toHaveText('$ 26.000,00');
    await expect(page.getByTestId('org-card-available-SS')).toHaveText('$ 27.375,00');
    await expect(page.getByTestId('org-card-available-PRIMARIA')).toHaveText('$ 15.491,00');

    // Verificar botón plano sin íconos "ABRIR PRIMARIA" y navegación en Modo Espejo
    const openPrimariaBtn = page.getByTestId('inspect-org-PRIMARIA');
    await expect(openPrimariaBtn).toHaveText('ABRIR PRIMARIA');
    await openPrimariaBtn.click();

    await expect(page.getByTestId('leader-view')).toBeVisible();
    await expect(page.getByTestId('available-balance-amount')).toHaveText('$ 15.491,00');

    await page.getByTestId('back-to-hub-btn').click();
    await expect(page.getByTestId('presidency-hub-view')).toBeVisible();

    // Probar Menú Hamburguesa (☰ -> ✕) y Drawer en viewport móvil
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileToggle = page.getByTestId('mobile-menu-toggle');
    await expect(mobileToggle).toBeVisible();
    await mobileToggle.click();

    await expect(page.getByTestId('mobile-nav-drawer')).toBeVisible();
    await page.getByTestId('drawer-admin-users-btn').click();
    await expect(page.getByTestId('user-management-panel')).toBeVisible();
  });

  test('3. Regla Sagrada de Aprobación: Eventos LCR nunca van a la bandeja; solo propuestas de líderes locales', async ({
    page,
  }) => {
    // 1. Por defecto, los 8 eventos oficiales de LCR ya están aprobados y la bandeja está en 0 pendientes
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-consejero1-01').click();
    await navigateToHubTab(page, 'APPROVALS');
    await expect(page.getByTestId('empty-pending-proposals')).toBeVisible();

    // 2. Un líder local (MJ) propone una actividad -> pasa a la bandeja de aprobación (origen = 'propuesta_lider')
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-lider-mj-01').click();

    await page.getByTestId('open-propose-modal-btn').click();
    await page.getByTestId('input-activity-title').fill('Campamento Anual de Mujeres Jóvenes');
    await page.getByTestId('input-activity-date').fill('2026-12-18');
    await page.getByTestId('input-activity-location').fill('Predio Estaca');
    await page.getByTestId('input-activity-cost').fill('28000');
    await page.getByTestId('submit-activity-btn').click();

    // 3. Volver a Primer Consejero -> abrir Bandeja de Aprobación, editar costo a $ 30.500,00 y aprobar
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-consejero1-01').click();

    await navigateToHubTab(page, 'APPROVALS');
    await expect(page.getByTestId('activity-approval-tray')).toBeVisible();
    await expect(page.getByText('Campamento Anual de Mujeres Jóvenes')).toBeVisible();

    await page.locator('[data-testid^="edit-proposal-btn-"]').first().click();
    await page.locator('[data-testid^="edit-input-cost-"]').first().fill('30500');
    await page.locator('[data-testid^="save-edit-approve-btn-"]').first().click();

    await expect(page.getByTestId('approval-feedback-banner')).toContainText('$ 30.500,00');
    await expect(page.getByTestId('empty-pending-proposals')).toBeVisible();
  });

  test('4. Permiso granular en Presidencia: Secretario de Estaca visualiza Bandeja en modo solo lectura', async ({
    page,
  }) => {
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-secretario-01').click();

    await navigateToHubTab(page, 'APPROVALS');
    await expect(page.getByTestId('approval-permission-readonly')).toBeVisible();
    await expect(page.getByTestId('readonly-presidency-notice')).toBeVisible();
  });
});
