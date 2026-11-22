import { test, expect } from '@playwright/test';
import {
  findMatchingLcrEvent,
  isGlobalChurchwideEvent,
  isLcrLinkedActivity,
  matchesDateRange,
  mergeLocalWithLcrActivity,
  normalizeActivityTitle,
} from '../src/lib/calendarHelpers';
import { ActivityRecord } from '../src/types/database';

test.describe('Unit — calendarHelpers (normalización, vinculación LCR, protección global y fechas)', () => {
  test('normaliza títulos ignorando mayúsculas, tildes y espacios extra', () => {
    expect(normalizeActivityTitle('  Noche  de   Jóvenes  ')).toBe('noche de jovenes');
    expect(normalizeActivityTitle('REUNIÓN DE SOC. SOC.')).toBe('reunion de soc. soc.');
  });

  test('identifica eventos globales Churchwide y eventos vinculados a LCR', () => {
    expect(isGlobalChurchwideEvent({ organization: 'CHURCHWIDE' })).toBe(true);
    expect(isGlobalChurchwideEvent({ organization: 'ESTACA' })).toBe(false);

    expect(isLcrLinkedActivity({ ical_uid: 'LCR-2026-1206-ESTACA-CONSEJO', status: 'APROBADA' })).toBe(true);
    expect(isLcrLinkedActivity({ ical_uid: 'PENDIENTE_LCR-123', status: 'APROBADA' })).toBe(false);
    expect(isLcrLinkedActivity({ ical_uid: 'PROPUESTA_LIDER-123', status: 'APROBADA' })).toBe(false);
    expect(isLcrLinkedActivity({ ical_uid: 'NO_LCR_123', status: 'APROBADA' })).toBe(false);
    expect(isLcrLinkedActivity({ ical_uid: 'LCR-123', status: 'PROPUESTA' })).toBe(false);
  });

  test('encuentra coincidencia automática por misma fecha y nombre normalizado y fusiona preservando datos de la app', () => {
    const localAct: ActivityRecord = {
      id: 501,
      ical_uid: 'PENDIENTE_LCR-501',
      title: '  consejo de   estaca ',
      event_date: '2026-12-06',
      start_time: '09:00',
      location: 'Por definir',
      description: 'Traer reportes trimestrales',
      app_notes: 'Traer carpetas de organizaciones',
      organization: 'MJ',
      estimated_cost: 4500,
      has_budget: true,
      origin: 'propuesta_lider',
      status: 'APROBADA',
    };

    const lcrAct: ActivityRecord = {
      id: 901,
      ical_uid: 'LCR-2026-1206-ESTACA-CONSEJO',
      title: 'Consejo de Estaca',
      event_date: '2026-12-06',
      start_time: '08:30',
      end_time: '11:00',
      location: 'Centro de Estaca',
      description: 'Reunión oficial del Consejo de Estaca.',
      organization: 'ESTACA',
      estimated_cost: 0,
      has_budget: false,
      origin: 'lcr',
      status: 'APROBADA',
    };

    const match = findMatchingLcrEvent(localAct, [localAct, lcrAct]);
    expect(match?.id).toBe(901);

    const merged = mergeLocalWithLcrActivity(localAct, lcrAct);
    // LCR manda en datos oficiales
    expect(merged.ical_uid).toBe('LCR-2026-1206-ESTACA-CONSEJO');
    expect(merged.title).toBe('Consejo de Estaca');
    expect(merged.start_time).toBe('08:30');
    expect(merged.location).toBe('Centro de Estaca');
    expect(merged.description).toBe('Reunión oficial del Consejo de Estaca.');
    // La app conserva ID, organización, presupuesto y notas complementarias
    expect(merged.id).toBe(501);
    expect(merged.organization).toBe('MJ');
    expect(merged.estimated_cost).toBe(4500);
    expect(merged.has_budget).toBe(true);
    expect(merged.app_notes).toBe('Traer carpetas de organizaciones');
  });

  test('filtra correctamente por rango de fechas Desde / Hasta', () => {
    expect(matchesDateRange('2026-11-15', '2026-11-01', '2026-11-30')).toBe(true);
    expect(matchesDateRange('2026-10-31', '2026-11-01', '2026-11-30')).toBe(false);
    expect(matchesDateRange('2026-12-01', '2026-11-01', '2026-11-30')).toBe(false);
    expect(matchesDateRange('2026-11-15', '2026-11-15', '')).toBe(true);
    expect(matchesDateRange('2026-11-15', '', '2026-11-15')).toBe(true);
  });
});

test.describe('E2E — Calendario Unificado y Edición Complementaria LCR', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('AC-1, AC-2, AC-3, AC-4 y AC-7: Sección única, Modo Lectura + Gestionar, Tarjetas/Lista, Rango de fechas y Edición LCR', async ({
    page,
  }) => {
    // 1. Cambiar a Admin (Pablo Lamela)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();

    // Verificar que no existe la entrada duplicada de Calendario en Administración (escritorio)
    const adminMenuTrigger = page.getByTestId('hub-admin-menu-trigger');
    if (await adminMenuTrigger.isVisible()) {
      await adminMenuTrigger.click();
      await expect(page.getByTestId('hub-nav-approvals')).toHaveCount(0);
      await adminMenuTrigger.click();
    }

    // Ir a Calendario unificado
    const desktopCalBtn = page.getByTestId('hub-nav-calendar');
    if (await desktopCalBtn.isVisible()) {
      await desktopCalBtn.click();
    } else {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-nav-calendar').click();
    }

    await expect(page.getByTestId('calendar-general-view')).toBeVisible();

    // AC-1: Arranca en Modo Lectura (Tarjetas), sin barra de gestión ni botones de editar
    await expect(page.getByTestId('calendar-manage-toggle')).toBeVisible();
    await expect(page.getByTestId('calendar-manage-bar')).toHaveCount(0);
    await expect(page.locator('[data-testid^="edit-activity-btn-"]')).toHaveCount(0);

    // AC-3: Filtro por rango de fechas (Desde / Hasta) funciona en Modo Lectura
    await page.getByTestId('calendar-date-filter-toggle').click();
    await page.getByTestId('calendar-date-from').fill('2026-12-01');
    await page.getByTestId('calendar-date-to').fill('2026-12-31');
    await expect(page.getByText('Consejo de Estaca')).toBeVisible();
    await page.getByTestId('calendar-date-clear').click();

    // AC-2: Activar Gestionar -> habilita Tarjetas / Lista, filtros rápidos y Crear Evento
    await page.getByTestId('calendar-manage-toggle').click();
    await expect(page.getByTestId('calendar-manage-bar')).toBeVisible();
    await expect(page.getByTestId('calendar-view-mode-switcher')).toBeVisible();
    await expect(page.getByTestId('cal-ctrl-create-event-btn')).toBeVisible();

    // Cambiar a Modo Lista y volver a Tarjetas
    await page.getByTestId('calendar-mode-list-btn').click();
    await expect(page.getByTestId('calendar-list-view-container')).toBeVisible();
    await page.getByTestId('calendar-mode-cards-btn').click();
    await expect(page.getByTestId('calendar-view-scroll-container')).toBeVisible();

    // AC-4: Editar un evento vinculado a LCR (Consejo de Estaca) -> campos LCR solo lectura + notas complementarias editables
    await page.getByTestId('calendar-search-input').fill('Consejo de Estaca');
    const consejoCard = page.locator('article[data-event-title="Consejo de Estaca"]').first();
    await expect(consejoCard).toBeVisible();
    await consejoCard.locator('[data-testid^="edit-activity-btn-"]').click();

    await expect(page.getByTestId('edit-approved-modal')).toBeVisible();
    await expect(page.getByTestId('lcr-readonly-summary')).toBeVisible();
    await expect(page.getByTestId('edit-activity-title')).toHaveCount(0);

    await page.getByTestId('edit-activity-app-notes').fill('Traer agenda impresa y lista de metas');
    await page.getByTestId('save-activity-edit-btn').click();

    // Confirmar que las notas complementarias se ven en la tarjeta
    await expect(consejoCard.getByText('Traer agenda impresa y lista de metas')).toBeVisible();

    // Desactivar Gestionar -> vuelve a Modo Lectura limpio, conservando las notas visibles
    await page.getByTestId('calendar-manage-toggle').click();
    await expect(page.getByTestId('calendar-manage-bar')).toHaveCount(0);
    await expect(consejoCard.getByText('Traer agenda impresa y lista de metas')).toBeVisible();
  });

  test('AC-9: Líder en Calendario nunca ve botón Gestionar ni controles administrativos', async ({
    page,
  }, testInfo) => {
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-lider-primaria-01').click();

    const isMobile = (testInfo.project.name || '').toLowerCase().includes('mobile');
    if (isMobile) {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-nav-calendar').click();
    } else {
      await page.getByTestId('leader-nav-calendar').click();
    }

    await expect(page.getByTestId('calendar-general-view')).toBeVisible();
    await expect(page.getByTestId('calendar-manage-toggle')).toHaveCount(0);
    await expect(page.getByTestId('calendar-manage-bar')).toHaveCount(0);
    await expect(page.locator('[data-testid^="edit-activity-btn-"]')).toHaveCount(0);
  });
});
