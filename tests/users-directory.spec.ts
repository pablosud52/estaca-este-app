import { test, expect, Page } from '@playwright/test';

async function openUsersPanel(page: Page) {
  const mobileToggle = page.getByTestId('mobile-menu-toggle');
  if (await mobileToggle.isVisible()) {
    await mobileToggle.click();
    await page.getByTestId('drawer-admin-users-btn').click();
  } else {
    const adminTrigger = page.getByTestId('hub-admin-menu-trigger');
    if (await adminTrigger.isVisible()) {
      await adminTrigger.click();
    }
    await page.getByTestId('hub-admin-users-btn').click();
  }
  await expect(page.getByTestId('user-management-panel')).toBeVisible();
}

async function openDirectoryView(page: Page) {
  const mobileToggle = page.getByTestId('mobile-menu-toggle');
  if (await mobileToggle.isVisible()) {
    await mobileToggle.click();
    await page.getByTestId('drawer-nav-directory').click();
  } else {
    await page.getByTestId('hub-nav-directory').click();
  }
  await expect(page.getByTestId('leaders-directory-view')).toBeVisible();
}

test.describe('Fase 6.5 — Gestión de Usuarios y Directorio de Líderes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();
    await expect(page.getByTestId('presidency-hub-view')).toBeVisible();
  });

  test('1. Acordeones plegados por defecto, validación Gmail/09xxxxxxx y regla de Admins permanentes', async ({
    page,
  }, testInfo) => {
    await openUsersPanel(page);

    // Verificar organizaciones principales plegadas por defecto y aviso de incompletos oculto al estar todo completo
    await expect(page.getByTestId('incomplete-contacts-filter-btn')).toBeHidden();
    await expect(page.getByTestId('org-accordion-toggle-PRESIDENCIA')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(page.getByTestId('admin-security-info-btn')).toBeHidden();
    await expect(page.getByTestId('year-selector-dropdown')).toBeHidden();
    await expect(page.getByTestId('org-accordion-toggle-MJ')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(page.getByTestId('org-accordion-toggle-SUMO_CONSEJO')).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Desplegar Presidencia -> aparece icono de info de seguridad y abre modal
    await page.getByTestId('org-accordion-toggle-PRESIDENCIA').click();
    await expect(page.getByTestId('admin-security-info-btn')).toBeVisible();
    await page.getByTestId('admin-security-info-btn').click();
    await expect(page.getByTestId('admin-security-info-modal')).toContainText(
      'Seguridad de administradores'
    );
    await page.getByRole('button', { name: 'Entendido' }).click();
    await expect(page.getByTestId('toggle-access-pres-presidente')).toBeDisabled();
    await expect(page.getByTestId('toggle-access-pres-secretario')).toBeDisabled();
    await expect(page.getByTestId('toggle-access-pres-secretario-financiero')).toBeDisabled();

    // Regla combinada de Limpiar campos: bloqueado en sí mismo, habilitado en Presidente
    await page.getByTestId('edit-btn-pres-secretario-financiero').click();
    await expect(page.getByTestId('clear-fields-pres-secretario-financiero')).toBeDisabled();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByTestId('edit-btn-pres-presidente').click();
    await expect(page.getByTestId('clear-fields-pres-presidente')).toBeEnabled();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // Desplegar MJ y probar validación estricta de celular y @gmail.com
    await page.getByTestId('org-accordion-toggle-MJ').click();
    await page.getByTestId('edit-btn-mj-consejera-1').click();
    const row = page.getByTestId('directory-row-mj-consejera-1');

    await row.getByPlaceholder('Nombre', { exact: true }).fill('Sofía');
    await row.getByPlaceholder('Apellido', { exact: true }).fill('Gómez');
    await row.getByPlaceholder('099123456').fill('091234');
    await page.getByTestId('save-edit-mj-consejera-1').click();
    await expect(row).toContainText('Celular inválido: debe ingresarse 09xxxxxxx');

    await row.getByPlaceholder('099123456').fill('099888777');
    await row.getByPlaceholder('nombre@gmail.com').fill('sofia@hotmail.com');
    await page.getByTestId('save-edit-mj-consejera-1').click();
    await expect(row).toContainText('solo se permiten cuentas @gmail.com');

    // Guardar válido sin Gmail para disparar badge de incompleto y alerta parpadeante en Hub
    await row.getByPlaceholder('nombre@gmail.com').fill('');
    await page.getByTestId('save-edit-mj-consejera-1').click();
    await expect(page.getByTestId('org-incomplete-badge-MJ')).toContainText('1 incompleto');

    const isMobile = (testInfo.project.name || '').toLowerCase().includes('mobile');
    if (isMobile) {
      await page.getByTestId('mobile-menu-toggle').click();
      await page.getByTestId('drawer-nav-dashboard').click();
      await expect(page.getByTestId('mobile-menu-alert-dot')).toBeVisible();
      await page.getByTestId('mobile-menu-toggle').click();
      await expect(page.getByTestId('drawer-directory-alert-dot')).toBeVisible();
      await page.getByTestId('drawer-admin-users-btn').click();
    } else {
      await page.getByTestId('hub-nav-dashboard').click();
      await expect(page.getByTestId('admin-menu-alert-dot')).toBeVisible();
      await page.getByTestId('hub-admin-menu-trigger').click();
      await expect(page.getByTestId('admin-directory-alert-dot')).toBeVisible();
      await page.getByTestId('hub-admin-users-btn').click();
    }
    await expect(page.getByTestId('user-management-panel')).toBeVisible();
  });

  test('2. Regla de relevo de Presidente/a (corrección conserva consejeros; relevo los vacía sin tocar Secretaria)', async ({
    page,
  }) => {
    await openUsersPanel(page);
    await page.getByTestId('org-accordion-toggle-MJ').click();

    // Cargar 1ª Consejera y Secretaria en MJ
    await page.getByTestId('edit-btn-mj-consejera-1').click();
    const c1Row = page.getByTestId('directory-row-mj-consejera-1');
    await c1Row.getByPlaceholder('Nombre', { exact: true }).fill('Elena');
    await c1Row.getByPlaceholder('Apellido', { exact: true }).fill('Pérez');
    await page.getByTestId('save-edit-mj-consejera-1').click();
    await expect(c1Row).toContainText('Elena Pérez');

    await page.getByTestId('edit-btn-mj-secretaria').click();
    const secRow = page.getByTestId('directory-row-mj-secretaria');
    await secRow.getByPlaceholder('Nombre', { exact: true }).fill('Marta');
    await secRow.getByPlaceholder('Apellido', { exact: true }).fill('López');
    await page.getByTestId('save-edit-mj-secretaria').click();
    await expect(secRow).toContainText('Marta López');

    // Editar Presidenta -> Solo corrección de datos: consejera y secretaria permanecen
    await page.getByTestId('edit-btn-mj-presidenta').click();
    const presRow = page.getByTestId('directory-row-mj-presidenta');
    await presRow.getByPlaceholder('099123456').fill('099201102');
    await page.getByTestId('save-edit-mj-presidenta').click();
    await expect(page.getByTestId('presidency-release-modal')).toBeVisible();
    await page.getByTestId('president-correction-only-btn').click();
    await expect(c1Row).toContainText('Elena Pérez');
    await expect(secRow).toContainText('Marta López');

    // Editar Presidenta -> Nuevo Presidente/a (relevo): borra consejeras, conserva secretaria
    await page.getByTestId('edit-btn-mj-presidenta').click();
    await presRow.getByPlaceholder('Nombre', { exact: true }).fill('Ana');
    await presRow.getByPlaceholder('Apellido', { exact: true }).fill('Silva');
    await page.getByTestId('save-edit-mj-presidenta').click();
    await expect(page.getByTestId('presidency-release-modal')).toBeVisible();
    await page.getByTestId('president-new-release-btn').click();

    await expect(c1Row).toContainText('Puesto vacante');
    await expect(secRow).toContainText('Marta López');
  });

  test('3. Límite de 3 extras en MJ y 2 auxiliares en CFS', async ({ page }) => {
    await openUsersPanel(page);

    await page.getByTestId('org-accordion-toggle-CFS').click();
    for (let i = 1; i <= 2; i++) {
      await page.getByTestId('add-extra-btn-CFS').click();
      const cfsCard = page.getByTestId('org-card-CFS');
      await cfsCard.getByPlaceholder('Nombre', { exact: true }).fill(`Aux${i}`);
      await cfsCard.getByPlaceholder('Apellido', { exact: true }).fill('CFS');
      await cfsCard.getByRole('button', { name: 'Agregar', exact: true }).click();
    }
    await expect(page.getByTestId('add-extra-btn-CFS')).toBeDisabled();

    await page.getByTestId('org-accordion-toggle-MJ').click();
    for (let i = 1; i <= 3; i++) {
      await page.getByTestId('add-extra-btn-MJ').click();
      const mjCard = page.getByTestId('org-card-MJ');
      await mjCard.getByPlaceholder('Nombre', { exact: true }).fill(`Asesor${i}`);
      await mjCard.getByPlaceholder('Apellido', { exact: true }).fill('MJ');
      await mjCard.getByRole('button', { name: 'Agregar', exact: true }).click();
    }
    await expect(page.getByTestId('add-extra-btn-MJ')).toBeDisabled();
  });

  test('4. Directorio de Líderes con acordeones plegados, auto-despliegue al filtrar y Copiar/WhatsApp (sin selector de año)', async ({
    page,
  }) => {
    await expect(page.getByTestId('year-selector-dropdown')).toBeVisible();
    await openDirectoryView(page);
    await expect(page.getByTestId('year-selector-dropdown')).toBeHidden();

    const presToggle = page.getByTestId('directory-org-accordion-toggle-PRESIDENCIA');
    await expect(presToggle).toHaveAttribute('aria-expanded', 'false');

    // Al seleccionar Presidencia desde la pastilla rápida, filtra y despliega automáticamente
    await page.getByTestId('directory-quick-chip-PRESIDENCIA').click();
    await expect(presToggle).toHaveAttribute('aria-expanded', 'true');

    const pabloCopyBtn = page.getByTestId('copy-phone-pres-secretario-financiero');
    const pabloWaBtn = page.getByTestId('whatsapp-btn-pres-secretario-financiero');

    await expect(page.getByTestId('leaders-directory-view')).toContainText('099 123 456');
    await expect(pabloCopyBtn).toBeVisible();
    await expect(pabloWaBtn).toHaveAttribute('href', 'https://wa.me/59899123456');
  });
});
