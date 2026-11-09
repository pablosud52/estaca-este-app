import { test, expect } from '@playwright/test';

test.describe('Fase 6.1 y 6.2: AuthContext, DevRoleSwitcher y Vista Móvil del Líder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('1. Carga por defecto en Líder de Mujeres Jóvenes con formato $ #.##0,00, regla de Seminario y Selector de Año (2026/2027)', async ({
    page,
  }) => {
    // Verificar usuario inicial (Carolina Méndez - MJ)
    await expect(page.getByTestId('header-user-name')).toHaveText('Carolina Méndez');
    await expect(page.getByTestId('balance-card-title')).toContainText('SALDO ACTUAL • MMJJ');

    // Presupuesto asignado MJ (Ejemplo_DB_Finanzas.xlsx) = $ 60.000,00 | Gastos MJ = $ 42.495,00 | Saldo disponible MJ = $ 17.505,00
    await expect(page.getByTestId('total-assigned-amount')).toHaveText('$ 60.000,00');
    await expect(page.getByTestId('total-spent-amount')).toHaveText('$ 42.495,00');
    await expect(page.getByTestId('available-balance-amount')).toHaveText('$ 17.505,00');

    // Activar checkbox de Seminario ($ 26.000,00 adicionales en 2026)
    await page.getByTestId('header-seminario-toggle-label').click();
    await expect(page.getByTestId('balance-card-title')).toContainText('MMJJ + SEM');
    await expect(page.getByTestId('total-assigned-amount')).toHaveText('$ 86.000,00');
    await expect(page.getByTestId('available-balance-amount')).toHaveText('$ 43.505,00');

    // Verificar Selector de Año para Líder (solo 2026 y 2027) y leyenda en 2027
    const yearSelect = page.getByTestId('year-selector-dropdown');
    await expect(yearSelect.locator('option')).toHaveCount(2);
    await yearSelect.selectOption('2027');
    await expect(page.getByTestId('available-balance-amount')).toHaveText('$ 0,00');
    await expect(page.getByTestId('leader-pending-budget-2027')).toHaveText(
      'Presupuesto 2027 pendiente de asignación'
    );
  });

  test('2. Acordeón de Historial Anual de Gastos colapsable y gasto neto multiestaca', async ({
    page,
  }) => {
    const expensesAccordion = page.getByTestId('accordion-expenses-content');
    await expect(expensesAccordion).toHaveAttribute('data-open', 'false');

    // Desplegar historial
    await page.getByTestId('accordion-expenses-trigger').click();
    await expect(expensesAccordion).toHaveAttribute('data-open', 'true');

    // Verificar formato dd/mm/aaaa y gasto neto de MeetUp ($ 4.750,00 sobre factura de $ 10.750,00)
    await expect(page.getByText('10/09/2026')).toBeVisible();
    await expect(page.getByText('$ 4.750,00')).toBeVisible();
    await expect(page.getByText('Factura: $ 10.750,00')).toBeVisible();
  });

  test('3. Regla Sagrada #9: Confidencialidad de presupuestos en Calendario entre organizaciones', async ({
    page,
  }) => {
    // Cambiar al perfil de Líder de Primaria (Lucía Fernández)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-lider-primaria-01').click();

    await expect(page.getByTestId('header-user-name')).toHaveText('Lucía Fernández');
    // Primaria no debe ver el toggle de Seminario
    await expect(page.getByTestId('header-seminario-toggle-label')).toHaveCount(0);

    // Abrir acordeón de Calendario y cambiar a "Agenda General Estaca"
    await page.getByTestId('accordion-calendar-trigger').click();
    await page.getByTestId('calendar-scope-all').click();

    await expect(page.getByTestId('confidentiality-notice')).toBeVisible();

    // Eventos de AS ($ 15.000,00) y HJ ($ 10.000,00) deben verse como eventos informativos pero SIN monto ni badge 💰 Con Presupuesto
    await expect(page.getByText('Actividad AS de Fin de Año')).toBeVisible();
    await expect(page.getByText('Campeonato de Vóley HHJJ y MMJJ')).toBeVisible();
    await expect(page.getByTestId('confidential-budget-badge')).toHaveCount(0);
    await expect(page.getByTestId('confidential-budget-amount')).toHaveCount(0);
  });

  test('4. Formulario de Propuesta de Actividad con checkbox de Seminario para MJ/HJ', async ({
    page,
  }) => {
    const uniqueTitle = `Devocional Seminario ${Date.now().toString().slice(-4)}`;
    await page.getByTestId('open-propose-modal-btn').click();
    await expect(page.getByTestId('propose-activity-modal')).toBeVisible();

    await page.getByTestId('input-activity-title').fill(uniqueTitle);
    await page.getByTestId('input-activity-date').fill('2026-11-30');
    await page.getByTestId('input-activity-location').fill('Capilla Carrasco');
    await page.getByTestId('input-activity-cost').fill('6500');

    // Marcar checkbox de Seminario
    await page.getByTestId('seminario-checkbox-label').click();
    await page.getByTestId('submit-activity-btn').click();

    // Verificar toast y aparición en el calendario con formato $ 6.500,00 y fecha 30/11/2026
    await expect(page.getByTestId('proposal-toast')).toContainText('Seminario');
    await expect(page.getByRole('heading', { name: uniqueTitle }).first()).toBeVisible();
    await expect(page.getByText('$ 6.500,00').first()).toBeVisible();
    await expect(page.getByText('30/11/2026').first()).toBeVisible();

    // Si cambiamos al Líder de Hombres Jóvenes (HJ), debe ver automáticamente la actividad de Seminario y su presupuesto
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-lider-hj-01').click();
    await expect(page.getByRole('heading', { name: uniqueTitle }).first()).toBeVisible();
  });

  test('5. Usuario No Autorizado ve el mensaje oficial exacto y la regla de Administrador Inmutable solo aparece en Gestión de Usuarios', async ({
    page,
  }) => {
    // Verificar que la cabecera de Admin está limpia sin el texto de Administrador Permanente Inmutable
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();
    await expect(page.getByTestId('permanent-admin-badge')).toHaveCount(0);

    // Cambiar a Usuario No Autorizado
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-no-autorizado-01').click();

    await expect(page.getByTestId('unauthorized-view')).toBeVisible();
    await expect(page.getByTestId('unauthorized-official-message')).toHaveText(
      'Acceso restringido. Ponte en contacto con el administrador o un miembro de la presidencia de Estaca.'
    );
  });
});
