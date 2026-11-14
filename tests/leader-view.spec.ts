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

  test('1. Carga por defecto en Líder de Mujeres Jóvenes con PRESUPUESTO DISPONIBLE, Gastos realizados, línea de Seminario, Desglose Trimestral y Selector de Año', async ({
    page,
  }, testInfo) => {
    // Verificar usuario inicial (Carolina Méndez - MJ)
    await expect(page.getByTestId('header-user-name')).toHaveText('Carolina Méndez');
    await expect(page.getByTestId('balance-card-title')).toHaveText('PRESUPUESTO DISPONIBLE');

    // Saldo disponible MJ = $ 17.505,00 | Gastos realizados: $ 42.495,00
    await expect(page.getByTestId('available-balance-amount')).toHaveText('$ 17.505,00');
    await expect(page.getByTestId('leader-spent-line')).toContainText('Gastos realizados:');
    await expect(page.getByTestId('total-spent-amount')).toHaveText('$ 42.495,00');

    // Verificar línea discreta de Fondo Seminario al pie de la tarjeta para MJ/HJ (sin checkbox)
    await expect(page.getByTestId('seminario-joint-fund-line')).toHaveText(
      '🏛️ Fondo Seminario: $ 26.000,00 (Fondo conjunto, no incluido en este presupuesto)'
    );

    // Verificar Desglose Trimestral (solo "Asignado: $ ... | Gastos: $ ...", sin "Disp:")
    await page.getByTestId('toggle-quarters-btn').click();
    await expect(page.getByTestId('leader-quarter-summary-T1')).toHaveText(
      'Asignado: $ 30.000,00 | Gastos: $ 33.908,00'
    );
    await expect(page.getByTestId('leader-quarter-summary-T1')).not.toContainText('Disp:');

    // Abrir también el calendario en MJ para capturar la vista completa (Tarjeta + Trimestres + Calendario con auto-enfoque)
    await page.getByTestId('accordion-calendar-trigger').click();
    const mjScrollContainer = page.getByTestId('calendar-scroll-container');
    await expect
      .poll(async () => {
        return await mjScrollContainer.evaluate((el) => el.scrollTop);
      })
      .toBeGreaterThan(0);

    const artifactDir =
      'C:/Users/Pablo/.gemini/antigravity/brain/62fbf75c-7edb-420d-8e4a-03d04293c255';
    await page.evaluate(() => window.scrollTo(0, 0));
    if (testInfo.project.name === 'Desktop Chrome') {
      await page.screenshot({ path: `${artifactDir}/leader_mj_desktop.png`, fullPage: true });
    } else if (testInfo.project.name === 'Mobile Chrome') {
      await page.screenshot({ path: `${artifactDir}/leader_mj_mobile.png`, fullPage: true });
    }

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

  test('3. Calendario Anual: Carga completa (Org + Estaca, pasadas y futuras), auto-enfoque y Regla Sagrada #9 de Confidencialidad', async ({
    page,
  }, testInfo) => {
    // Cambiar al perfil de Líder de Primaria (Lucía Fernández)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-lider-primaria-01').click();

    await expect(page.getByTestId('header-user-name')).toHaveText('Lucía Fernández');
    await expect(page.getByTestId('balance-card-title')).toHaveText('PRESUPUESTO DISPONIBLE');
    await expect(page.getByTestId('available-balance-amount')).toHaveText('$ 15.491,00');
    // Primaria NO debe ver la línea de Seminario
    await expect(page.getByTestId('seminario-joint-fund-line')).toHaveCount(0);

    // Abrir acordeón de Calendario: debe cargar tanto eventos de Primaria como generales de Estaca, pasados y futuros
    await page.getByTestId('accordion-calendar-trigger').click();
    const scrollContainer = page.getByTestId('calendar-scroll-container');
    await expect(
      scrollContainer.getByText('Viaje al Templo niños que avanzan a HJ/MJ')
    ).toBeVisible();
    await expect(scrollContainer.getByText('Conferencia de Estaca Octubre')).toBeVisible();
    await expect(
      scrollContainer.getByText('Presentación Primaria Colonia Nicolich')
    ).toBeVisible();
    await expect(scrollContainer.getByText('Consejo de Estaca')).toBeVisible();

    // Verificar auto-scroll hacia la próxima actividad futura (data-upcoming-anchor="true")
    await expect
      .poll(async () => {
        return await scrollContainer.evaluate((el) => el.scrollTop);
      })
      .toBeGreaterThan(0);

    const artifactDir =
      'C:/Users/Pablo/.gemini/antigravity/brain/62fbf75c-7edb-420d-8e4a-03d04293c255';
    await page.evaluate(() => window.scrollTo(0, 0));
    if (testInfo.project.name === 'Desktop Chrome') {
      await page.screenshot({ path: `${artifactDir}/leader_primaria_desktop.png`, fullPage: true });
    } else if (testInfo.project.name === 'Mobile Chrome') {
      await page.screenshot({ path: `${artifactDir}/leader_primaria_mobile.png`, fullPage: true });
    }

    // Cambiar a "Agenda General Estaca" y verificar confidencialidad de presupuestos de otras organizaciones
    await page.getByTestId('calendar-scope-all').click();
    await expect(page.getByTestId('confidentiality-notice')).toBeVisible();

    // Eventos de AS ($ 15.000,00) y HJ ($ 10.000,00) se ven informativos pero SIN monto visible para Primaria
    await expect(scrollContainer.getByText('Actividad AS de Fin de Año')).toBeVisible();
    await expect(scrollContainer.getByText('Campeonato de Vóley HHJJ y MMJJ')).toBeVisible();
    await expect(scrollContainer.getByText('$ 15.000,00')).toHaveCount(0);
    await expect(scrollContainer.getByText('$ 10.000,00')).toHaveCount(0);
    // Pero Primaria sí ve el presupuesto de sus propias actividades pasadas ($ 12.394,00 del Viaje al Templo)
    await expect(scrollContainer.getByText('$ 12.394,00')).toBeVisible();
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

    // Cambiar a Usuario No Autorizado mediante almacenamiento de sesión
    await page.evaluate(() => {
      localStorage.setItem('estaca_este_active_profile_id', 'no-autorizado-01');
    });
    await page.reload();

    await expect(page.getByTestId('unauthorized-view')).toBeVisible();
    await expect(page.getByTestId('unauthorized-official-message')).toHaveText(
      'Acceso restringido. Ponte en contacto con el administrador o un miembro de la presidencia de Estaca.'
    );
  });

  test('6. Verificación de conmutador simplificado y orden canónico de 9 roles de Estaca', async ({
    page,
  }) => {
    await page.getByTestId('dev-role-trigger').click();
    const roleList = page.getByTestId('dev-role-list');
    await expect(roleList).toBeVisible();

    const buttons = roleList.locator('button');
    await expect(buttons).toHaveCount(9);

    const expectedLabels = [
      'yo (super admin)',
      'Presidencia de Estaca',
      'Sociedad de Socorro',
      'Hombres Jóvenes',
      'Mujeres Jóvenes',
      'Primaria',
      'JAS',
      'AS',
      'CFS',
    ];

    for (let i = 0; i < expectedLabels.length; i++) {
      await expect(buttons.nth(i)).toContainText(expectedLabels[i]);
    }

    // Probar alternancia hacia JAS y CFS
    await page.getByTestId('switch-role-lider-jas-01').click();
    await expect(page.getByTestId('header-user-name')).toHaveText('Mateo Morales');

    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-lider-cfs-01').click();
    await expect(page.getByTestId('header-user-name')).toHaveText('Gonzalo Silva');

    // Verificar nuevo título "Selector de Rol", ausencia de ícono junto al título y cierre con clic fuera
    await page.getByTestId('dev-role-trigger').click();
    const menu = page.getByTestId('dev-role-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Selector de Rol');

    // Clic fuera del menú desplegable para comprobar que se cierra
    await page.getByTestId('balance-card-title').click({ force: true });
    await expect(menu).not.toBeVisible();
  });

  test('6. Navegación por menú hamburguesa (móvil) y barra superior (escritorio) hacia Calendario y Proveedores', async ({
    page,
  }, testInfo) => {
    const isMobile = (testInfo.project.name || '').toLowerCase().includes('mobile');

    // Verificar que los botones antiguos ya no están en las tarjetas/acordeones
    await expect(page.getByTestId('open-suppliers-view-btn')).toHaveCount(0);
    await expect(page.getByTestId('open-full-calendar-view-btn')).toHaveCount(0);

    if (isMobile) {
      await page.getByTestId('mobile-menu-toggle').click();
      await expect(page.getByTestId('mobile-nav-drawer')).toBeVisible();
      await expect(page.getByTestId('drawer-user-name')).toHaveText('Carolina Méndez');
      await page.getByTestId('drawer-nav-suppliers').click();
    } else {
      await page.getByTestId('leader-nav-suppliers').click();
    }

    await expect(page.getByText('Directorio de Proveedores')).toBeVisible();

    if (isMobile) {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-nav-calendar').click();
    } else {
      await page.getByTestId('leader-nav-calendar').click();
    }

    await expect(page.getByTestId('calendar-general-view')).toBeVisible();

    if (isMobile) {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-nav-summary').click();
    } else {
      await page.getByTestId('leader-nav-summary').click();
    }

    await expect(page.getByTestId('balance-card')).toBeVisible();
  });
});
