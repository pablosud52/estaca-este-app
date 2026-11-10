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

    // 1. Verificar texto oficial innegociable del banner de seguridad (PROJECT_CONTEXT.md §4.3)
    const bannerText = page.getByTestId('security-banner-official-text');
    await expect(bannerText).toContainText(
      'Por seguridad del sistema, ningún administrador puede revocar sus propios permisos ni eliminarse a sí mismo. Las modificaciones de administradores deben ser realizadas por otro administrador activo.'
    );

    // 2. Verificar que la propia fila de Pablo Lamela (admin-pablo-01, pablosud52@gmail.com) está protegida y deshabilitada
    await expect(page.getByTestId('self-session-badge-admin-pablo-01')).toBeVisible();
    await expect(page.getByTestId('immutable-admin-pill-admin-pablo-01')).toContainText(
      'Admin Vitalicio (Propietario del Sistema)'
    );
    await expect(page.getByTestId('user-row-admin-pablo-01')).toContainText('pablosud52@gmail.com');
    await expect(page.getByTestId('role-select-admin-pablo-01')).toBeDisabled();
    await expect(page.getByTestId('toggle-active-btn-admin-pablo-01')).toBeDisabled();
    await expect(page.getByTestId('edit-superadmin-calling-btn')).toBeVisible();

    // 3. Verificar que el Presidente de Estaca (admin-presidente-01) también está permanentemente protegido
    await expect(page.getByTestId('immutable-admin-pill-admin-presidente-01')).toBeVisible();
    await expect(page.getByTestId('role-select-admin-presidente-01')).toBeDisabled();
    await expect(page.getByTestId('toggle-active-btn-admin-presidente-01')).toBeDisabled();

    // 4. Verificar que el administrador SÍ puede modificar permisos de otro usuario no inmutable (ej. Secretario de Estaca)
    const secretaryApproveBtn = page.getByTestId('toggle-approve-perm-presidencia-secretario-01');
    await expect(secretaryApproveBtn).toBeEnabled();
    await expect(secretaryApproveBtn).toContainText('Solo Lectura');
    await secretaryApproveBtn.click();
    await expect(secretaryApproveBtn).toContainText('✓ Aprueba Actividades');
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
