import { test, expect, Page } from '@playwright/test';

async function openAdminSection(page: Page, section: 'USERS' | 'OPERATIONS') {
  const mobileToggle = page.getByTestId('mobile-menu-toggle');
  if (await mobileToggle.isVisible()) {
    await mobileToggle.click();
    await page
      .getByTestId(
        section === 'USERS' ? 'drawer-admin-users-btn' : 'drawer-admin-operations-btn'
      )
      .click();
  } else {
    const adminTrigger = page.getByTestId('hub-admin-menu-trigger');
    if (await adminTrigger.isVisible()) {
      await adminTrigger.click();
    }
    await page
      .getByTestId(section === 'USERS' ? 'hub-admin-users-btn' : 'hub-admin-operations-btn')
      .click();
  }
}

test.describe('Paso 6.4 — Panel de Administrador (AdminPanel)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Seleccionar perfil de Administrador Permanente: Pablo Lamela
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();
    await expect(page.getByTestId('presidency-hub-view')).toBeVisible();
  });

  test('1. Gestión de Usuarios y Regla de Auto-Protección Inmutable (banner oficial y bloqueo de fila propia y permanentes)', async ({
    page,
  }) => {
    // Ir a Gestión de Usuarios
    await openAdminSection(page, 'USERS');
    await expect(page.getByTestId('user-management-panel')).toBeVisible();

    // Desplegar Presidencia si está colapsado
    const presidenciaToggle = page.getByTestId('org-accordion-toggle-PRESIDENCIA');
    if (await presidenciaToggle.isVisible()) {
      const isExpanded = await presidenciaToggle.getAttribute('aria-expanded');
      if (isExpanded !== 'true') {
        await presidenciaToggle.click();
      }
    }

    // 1. Verificar texto oficial innegociable del banner de seguridad en el modal informativo (PROJECT_CONTEXT.md §4.3)
    await page.getByTestId('admin-security-info-btn').click();
    const bannerText = page.getByTestId('security-banner-official-text');
    await expect(bannerText).toContainText(
      'Por seguridad del sistema, ningún administrador puede revocar sus propios permisos ni eliminarse a sí mismo. Las modificaciones de administradores deben ser realizadas por otro administrador activo.'
    );
    await page.getByRole('button', { name: 'Entendido' }).click();

    // 2. Verificar que la propia fila de Pablo Lamela (pres-secretario-financiero, pablosud52@gmail.com) está protegida e inmutable
    const pabloRow = page.getByTestId('directory-row-pres-secretario-financiero');
    await expect(pabloRow).toBeVisible();
    await expect(pabloRow).toContainText('pablosud52@gmail.com');
    await expect(pabloRow).toContainText('Inmutable');
    await expect(page.getByTestId('toggle-access-pres-secretario-financiero')).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Rol de Secretario Financiero' })).toBeDisabled();

    // 3. Verificar que el Presidente de Estaca (pres-presidente) también es un administrador inmutable
    const presidentRow = page.getByTestId('directory-row-pres-presidente');
    await expect(presidentRow).toBeVisible();
    await expect(presidentRow).toContainText('Inmutable');
    await expect(page.getByTestId('toggle-access-pres-presidente')).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Rol de Presidente de Estaca' })).toBeDisabled();

    // 4. Verificar que un puesto no inmutable (ej. Primer Consejero) sí permite cambiar acceso y rol
    const counselorAccessBtn = page.getByTestId('toggle-access-pres-consejero-1');
    await expect(counselorAccessBtn).toBeEnabled();
    const counselorRoleSelect = page.getByRole('combobox', { name: 'Rol de Primer Consejero' });
    await expect(counselorRoleSelect).toBeEnabled();
  });

  test('2. Monitor de Conciliación en Vivo con LCR y Centro de Carga Rápida con atajo "MMDD-MONTO"', async ({
    page,
  }) => {
    // Abrir Centro de Edición y Carga
    await openAdminSection(page, 'OPERATIONS');
    await expect(page.getByTestId('admin-operations-center')).toBeVisible();
    await expect(page.getByTestId('lcr-reconciliation-monitor')).toBeVisible();

    // 1. Verificar métricas iniciales de cuadratura LCR en formato $ #.##0,00
    await expect(page.getByTestId('monitor-total-withdrawn')).toContainText('$ 439.000,00');
    await expect(page.getByTestId('monitor-pending-lcr-count')).toContainText('2 en mano');
    await expect(page.getByTestId('monitor-pending-lcr-amount')).toContainText('$ 15.506,00');

    // 2. Probar atajo inteligente "0315-1250" -> autocompleta 15/03/2026 y $ 1.250,00
    const shortcutInput = page.getByTestId('mmdd-shortcut-input');
    await shortcutInput.fill('0315-1250');

    await expect(page.getByTestId('shortcut-parsed-preview')).toContainText('15/03/2026');
    await expect(page.getByTestId('shortcut-parsed-preview')).toContainText('$ 1.250,00');
    await expect(page.getByTestId('expense-date-input')).toHaveValue('2026-03-15');
    await expect(page.getByTestId('expense-gross-amount-input')).toHaveValue('1250');
    await expect(page.getByTestId('expense-date-formatted-hint')).toContainText('15/03/2026');
    await expect(page.getByTestId('expense-amount-formatted-hint')).toContainText('$ 1.250,00');

    // 3. Probar Checkbox "Gasto Directo" y registrar comprobante
    await page.getByTestId('direct-expense-checkbox').check();
    await page.getByTestId('expense-concept-input').fill('Compra directa de materiales de liderazgo');
    await page.getByTestId('submit-quick-expense-btn').click();

    await expect(page.getByTestId('admin-ops-toast')).toContainText('$ 1.250,00');

    // 4. Conciliar en vivo el comprobante pendiente de Primaria (ID 34: $ 12.394,00) y verificar que baja a 1 en mano ($ 3.112,00)
    await page.getByTestId('reconcile-lcr-btn-34').click();
    await expect(page.getByTestId('monitor-pending-lcr-count')).toContainText('1 en mano');
    await expect(page.getByTestId('monitor-pending-lcr-amount')).toContainText('$ 3.112,00');
  });

  test('3. Herramienta "Distribuir Gasto de Actividad de Estaca" (Opción B) y Sincronización Bidireccional con Excel', async ({
    page,
  }) => {
    await openAdminSection(page, 'OPERATIONS');

    // 1. Abrir herramienta de distribución de gasto de actividad general (Opción B)
    await page.getByTestId('ops-subtab-distribute').click();
    await expect(page.getByTestId('distribute-stake-expense-form')).toBeVisible();

    await page.getByTestId('stake-event-name-input').fill('Conferencia de Juventud');
    await page.getByTestId('stake-event-total-input').fill('9000');

    // Por defecto están seleccionadas MJ, HJ y PRIMARIA (3 organizaciones -> $ 3.000,00 c/u)
    await expect(page.getByTestId('dist-preview-amount-MJ')).toContainText('$ 3.000,00');
    await expect(page.getByTestId('dist-preview-amount-HJ')).toContainText('$ 3.000,00');
    await expect(page.getByTestId('dist-preview-amount-PRIMARIA')).toContainText('$ 3.000,00');

    await page.getByTestId('confirm-distribute-stake-btn').click();

    // Debe volver a la vista del libro mayor mostrando el toast con la etiqueta estándar
    await expect(page.getByTestId('admin-ops-toast')).toContainText(
      'Actividad General de Estaca: Conferencia de Juventud'
    );

    // 2. Abrir pestaña de Sincronización con Excel y probar vista previa e importación
    await page.getByTestId('ops-subtab-excel').click();
    await expect(page.getByTestId('excel-sync-panel')).toBeVisible();
    await expect(page.getByTestId('btn-export-excel')).toBeVisible();
    await expect(page.getByTestId('btn-import-excel-trigger')).toBeVisible();

    // Validar plantilla en memoria con preview previo antes de impactar
    await page.getByTestId('btn-preview-template-excel').click();
    await expect(page.getByTestId('excel-import-preview-card')).toBeVisible();

    await page.getByTestId('confirm-excel-import-btn').click();
    await expect(page.getByTestId('excel-sync-toast')).toContainText('Sincronización confirmada');
  });
});
