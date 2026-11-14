import { test, expect, Page } from '@playwright/test';

async function openUsersPanel(page: Page) {
  const mobileToggle = page.getByTestId('mobile-menu-toggle');
  if (await mobileToggle.isVisible()) {
    await mobileToggle.click();
    await page.getByTestId('drawer-admin-users-btn').click();
  } else {
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

  test('1. Organizaciones separadas, validación Gmail/celular 09xxxxxxx y protección inmutable', async ({
    page,
  }) => {
    await openUsersPanel(page);

    // Verificar organizaciones principales y nuevas (Sumo Consejo, Escuela Dominical, Bienestar, Música, CFS)
    await expect(page.getByTestId('org-card-PRESIDENCIA')).toBeVisible();
    await expect(page.getByTestId('org-card-SUMO_CONSEJO')).toBeVisible();
    await expect(page.getByTestId('org-card-CFS')).toBeVisible();
    await expect(page.getByTestId('org-card-BIENESTAR')).toBeVisible();
    await expect(page.getByTestId('org-card-MUSICA')).toBeVisible();

    // Auto-protección inmutable en Pablo Lamela y Presidente
    await expect(page.getByTestId('toggle-access-pres-secretario-financiero')).toBeDisabled();
    await expect(page.getByTestId('toggle-access-pres-presidente')).toBeDisabled();

    // Editar 1ª Consejera de MJ y probar validación estricta de celular y @gmail.com
    await page.getByTestId('edit-btn-mj-consejera-1').click();
    const row = page.getByTestId('directory-row-mj-consejera-1');

    await row.getByPlaceholder('Nombre', { exact: true }).fill('Sofía');
    await row.getByPlaceholder('Apellido', { exact: true }).fill('Gómez');
    await row.getByPlaceholder('099123456').fill('091234'); // inválido (< 9 dígitos)
    await page.getByTestId('save-edit-mj-consejera-1').click();
    await expect(row).toContainText('Celular inválido: debe ingresarse 09xxxxxxx');

    await row.getByPlaceholder('099123456').fill('099888777');
    await row.getByPlaceholder('nombre@gmail.com').fill('sofia@hotmail.com'); // no Gmail
    await page.getByTestId('save-edit-mj-consejera-1').click();
    await expect(row).toContainText('solo se permiten cuentas @gmail.com');

    // Guardar válido sin Gmail para disparar alerta de datos incompletos
    await row.getByPlaceholder('nombre@gmail.com').fill('');
    await page.getByTestId('save-edit-mj-consejera-1').click();
    await expect(page.getByTestId('incomplete-contacts-filter-btn')).toContainText('con datos incompletos');

    // Volver al Dashboard de Presidencia y verificar alerta parpadeante
    await page.getByRole('button', { name: 'Panel' }).first().click();
    await expect(page.getByTestId('presidency-incomplete-contacts-alert')).toBeVisible();
  });

  test('2. Límite de 3 extras en MJ y 2 auxiliares en CFS', async ({ page }) => {
    await openUsersPanel(page);

    // Agregar 2 auxiliares en CFS (máximo 2)
    for (let i = 1; i <= 2; i++) {
      await page.getByTestId('add-extra-btn-CFS').click();
      const cfsCard = page.getByTestId('org-card-CFS');
      await cfsCard.getByPlaceholder('Nombre', { exact: true }).fill(`Aux${i}`);
      await cfsCard.getByPlaceholder('Apellido', { exact: true }).fill('CFS');
      await cfsCard.getByRole('button', { name: 'Agregar', exact: true }).click();
    }
    await expect(page.getByTestId('add-extra-btn-CFS')).toBeDisabled();

    // Agregar 3 extras en MJ (máximo 3)
    for (let i = 1; i <= 3; i++) {
      await page.getByTestId('add-extra-btn-MJ').click();
      const mjCard = page.getByTestId('org-card-MJ');
      await mjCard.getByPlaceholder('Nombre', { exact: true }).fill(`Asesor${i}`);
      await mjCard.getByPlaceholder('Apellido', { exact: true }).fill('MJ');
      await mjCard.getByRole('button', { name: 'Agregar', exact: true }).click();
    }
    await expect(page.getByTestId('add-extra-btn-MJ')).toBeDisabled();
  });

  test('3. Directorio de Líderes muestra celular en grupos de 3 dígitos con Copiar y WhatsApp', async ({
    page,
  }) => {
    await openDirectoryView(page);

    const pabloCopyBtn = page.getByTestId('copy-phone-pres-secretario-financiero');
    const pabloWaBtn = page.getByTestId('whatsapp-btn-pres-secretario-financiero');

    await expect(page.getByTestId('leaders-directory-view')).toContainText('099 123 456');
    await expect(pabloCopyBtn).toBeVisible();
    await expect(pabloWaBtn).toHaveAttribute('href', 'https://wa.me/59899123456');
  });
});
