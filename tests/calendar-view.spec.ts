import { test, expect } from '@playwright/test';

test.describe('Paso 6.5 — Vista 4: Calendario General de Actividades (CalendarView) y Doble Escudo LCR', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('1. Regla Sagrada de Confidencialidad Presupuestaria (RBAC): Líder de Primaria NO ve costos de Hombres Jóvenes ni Adultos Solteros; Presidencia SÍ ve todos los costos', async ({
    page,
  }, testInfo) => {
    // 1.1 Simular Líder de Primaria (Lucía Fernández)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-lider-primaria-01').click();
    await expect(page.getByTestId('header-user-name')).toHaveText('Lucía Fernández');

    // Abrir acordeón y entrar a la Vista General de Calendario (CalendarView.tsx)
    await page.getByTestId('accordion-calendar-trigger').click();
    await page.getByTestId('open-full-calendar-view-btn').click();
    await expect(page.getByTestId('calendar-general-view')).toBeVisible();
    await expect(page.getByTestId('calendar-rbac-confidentiality-banner')).toBeVisible();

    const scrollContainer = page.getByTestId('calendar-view-scroll-container');

    // Verificar auto-enfoque hacia la próxima actividad futura (scrollTop > 0)
    await expect
      .poll(async () => {
        return await scrollContainer.evaluate((el) => el.scrollTop);
      })
      .toBeGreaterThan(0);

    // Filtrar por píldora [ Jóvenes ]: Líder de Primaria ve el Campeonato de Vóley HHJJ y MMJJ ($ 10.000,00) y Campamento Anual HJ y MJ ($ 63.976,00), pero SIN distintivo 💰 Con Presupuesto ni monto
    await page.getByTestId('calendar-pill-JOVENES').click();
    await expect(scrollContainer.getByText('Campeonato de Vóley HHJJ y MMJJ')).toBeVisible();
    await expect(scrollContainer.getByText('Campamento Anual HJ y MJ')).toBeVisible();
    await expect(page.getByTestId('calendar-confidential-budget-badge')).toHaveCount(0);
    await expect(page.getByTestId('calendar-confidential-budget-amount')).toHaveCount(0);
    await expect(scrollContainer.getByText('$ 10.000,00')).toHaveCount(0);
    await expect(scrollContainer.getByText('$ 63.976,00')).toHaveCount(0);

    // Filtrar por píldora [ Primaria ]: Líder de Primaria SÍ ve el costo de su propia organización (Viaje al Templo $ 12.394,00)
    await page.getByTestId('calendar-pill-PRIMARIA').click();
    await expect(
      scrollContainer.getByText('Viaje al Templo niños que avanzan a HJ/MJ')
    ).toBeVisible();
    await expect(scrollContainer.getByText('$ 12.394,00')).toBeVisible();

    const artifactDir =
      'C:/Users/Pablo/.gemini/antigravity/brain/62fbf75c-7edb-420d-8e4a-03d04293c255';
    await page.evaluate(() => window.scrollTo(0, 0));
    if (testInfo.project.name === 'Mobile Chrome') {
      await page.screenshot({
        path: `${artifactDir}/calendar_view_lider_primaria_mobile.png`,
        fullPage: true,
      });
    }

    // 1.2 Cambiar a Presidencia de Estaca (Primer Consejero): SÍ debe ver todos los costos de Hombres Jóvenes y de toda la Estaca
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-presidencia-consejero1-01').click();

    // Navegar a la pestaña Calendario desde el Hub de Presidencia (en móvil desde el Drawer ☰, en escritorio desde la barra superior)
    const desktopCalendarBtn = page.getByTestId('hub-nav-calendar');
    if (await desktopCalendarBtn.isVisible()) {
      await desktopCalendarBtn.click();
    } else {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-nav-calendar').click();
    }

    await expect(page.getByTestId('calendar-general-view')).toBeVisible();

    // En la píldora [ Jóvenes ], Presidencia SÍ ve el badge "💰 Con Presupuesto" y los montos "$ 10.000,00" y "$ 63.976,00"
    await page.getByTestId('calendar-pill-JOVENES').click();
    const presScroll = page.getByTestId('calendar-view-scroll-container');
    await expect(presScroll.getByText('Campeonato de Vóley HHJJ y MMJJ')).toBeVisible();
    await expect(presScroll.getByText('Campamento Anual HJ y MJ')).toBeVisible();
    await expect(presScroll.getByText('$ 10.000,00')).toBeVisible();
    await expect(presScroll.getByText('$ 63.976,00')).toBeVisible();
    await expect(page.getByTestId('calendar-confidential-budget-badge').first()).toBeVisible();
  });

  test('2. Escudo en el Botón Manual ("🔄 Sincronizar"), cuenta regresiva de 30s, escalado a 10m en la 4ª pulsación, filtros por píldoras y buscador en tiempo real', async ({
    page,
  }, testInfo) => {
    // Entrar como Administrador (Pablo Lamela) y abrir la pestaña Calendario
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();

    const desktopCalendarBtn = page.getByTestId('hub-nav-calendar');
    if (await desktopCalendarBtn.isVisible()) {
      await desktopCalendarBtn.click();
    } else {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-nav-calendar').click();
    }

    await expect(page.getByTestId('calendar-general-view')).toBeVisible();

    // 2.1 Verificar estado inicial del botón: "🔄 Sincronizar" habilitado
    const syncBtn = page.getByTestId('lcr-sync-button');
    await expect(syncBtn).toBeEnabled();
    await expect(syncBtn).toContainText('🔄 Sincronizar');

    // 1ª Pulsación: pasa a Sincronizando... y luego a "✓ Calendario al día" (deshabilitado) con cuenta regresiva de 30s
    await syncBtn.click();
    await expect(syncBtn).toBeDisabled();
    await expect(syncBtn).toContainText('✓ Calendario al día');

    const cooldownHint = page.getByTestId('lcr-sync-cooldown-hint');
    await expect(cooldownHint).toBeVisible();
    await expect(cooldownHint).toContainText('⏱️ Próxima sincronización manual disponible en');
    await expect(page.getByTestId('lcr-sync-countdown-value')).toContainText('s');

    const artifactDir =
      'C:/Users/Pablo/.gemini/antigravity/brain/62fbf75c-7edb-420d-8e4a-03d04293c255';
    await page.evaluate(() => window.scrollTo(0, 0));
    if (testInfo.project.name === 'Desktop Chrome') {
      await page.screenshot({
        path: `${artifactDir}/calendar_view_desktop.png`,
        fullPage: true,
      });
    }

    // 2.2 Simular que ya hubo 3 pulsaciones previas cuyo cooldown expiró para verificar que la 4ª pulsación activa el bloqueo de 10 minutos (10m / 9m XXs)
    await page.evaluate(() => {
      localStorage.setItem(
        'estaca_lcr_sync_btn_state_v1',
        JSON.stringify({
          clickCount: 3,
          lastClickTimestamp: Date.now() - 35000,
          cooldownUntil: Date.now() - 1000,
        })
      );
    });

    // Esperar a que el intervalo de 500ms reactive el botón y ejecutar la 4ª pulsación consecutiva
    await expect(syncBtn).toBeEnabled();
    await syncBtn.click();
    await expect(syncBtn).toBeDisabled();
    await expect(syncBtn).toHaveAttribute('data-click-count', '4');
    await expect(page.getByTestId('lcr-sync-countdown-value')).toContainText('m');

    // 2.3 Verificar buscador en tiempo real por nombre o lugar
    const searchInput = page.getByTestId('calendar-search-input');
    await searchInput.fill('Nicolich');
    const scrollContainer = page.getByTestId('calendar-view-scroll-container');
    await expect(
      scrollContainer.getByRole('heading', { name: 'Presentación Primaria Colonia Nicolich' })
    ).toBeVisible();
    await expect(
      scrollContainer.getByRole('heading', { name: 'Consejo de Estaca' })
    ).toHaveCount(0);

    // Limpiar búsqueda y verificar píldora [ Estaca General ]
    await page.getByTestId('calendar-search-clear').click();
    await page.getByTestId('calendar-pill-ESTACA_GENERAL').click();
    await expect(
      scrollContainer.getByRole('heading', { name: 'Consejo de Estaca' })
    ).toBeVisible();
    await expect(
      scrollContainer.getByRole('heading', { name: 'Conferencia de Estaca Octubre' })
    ).toBeVisible();
    await expect(
      scrollContainer.getByRole('heading', { name: 'Presentación Primaria Colonia Nicolich' })
    ).toHaveCount(0);
  });
});
