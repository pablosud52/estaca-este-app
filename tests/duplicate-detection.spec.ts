import { test, expect } from '@playwright/test';

test.describe('Detección de pagos duplicados y doble revisión', () => {
  test('Detecta duplicado al cargar, permite continuar a doble revisión, comparar lado a lado y eliminar o ignorar', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Ingresar como Administrador Permanente (Pablo Lamela)
    await page.getByTestId('dev-role-trigger').click();
    await page.getByTestId('switch-role-admin-pablo-01').click();
    await expect(page.getByTestId('presidency-hub-view')).toBeVisible();

    // Ir a Finanzas / Operaciones
    const adminTrigger = page.getByTestId('hub-admin-menu-trigger');
    if (await adminTrigger.isVisible()) {
      await adminTrigger.click();
    }
    await page.getByTestId('hub-admin-operations-btn').click();
    await expect(page.getByTestId('open-add-expense-modal-btn')).toBeVisible();

    // 1. Cargar gasto A (Tarjeta)
    await page.getByTestId('open-add-expense-modal-btn').click();
    await page.getByTestId('expense-type-DIRECTO_TARJETA').click();
    await page.getByTestId('expense-gross-amount-input').fill('4500');
    await page.getByTestId('expense-ref-input').fill('998877');
    await page.getByTestId('expense-concept-input').fill('Compra prueba duplicado');
    await page.getByTestId('submit-quick-expense-btn').click();
    await expect(page.getByTestId('admin-ops-toast')).toContainText('$ 4.500,00');

    // 2. Cargar gasto B idéntico -> debe mostrar alerta de posible duplicado
    await page.getByTestId('open-add-expense-modal-btn').click();
    await page.getByTestId('expense-type-DIRECTO_TARJETA').click();
    await page.getByTestId('expense-gross-amount-input').fill('4500');
    await page.getByTestId('expense-ref-input').fill('998877');
    await page.getByTestId('expense-concept-input').fill('Compra prueba duplicado');
    await page.getByTestId('submit-quick-expense-btn').click();

    await expect(page.getByTestId('expense-duplicate-warning')).toBeVisible();

    // Elegir "Continuar igualmente (doble revisión)"
    await page.getByTestId('continue-duplicate-expense-btn').click();
    await expect(page.getByTestId('expense-duplicate-warning')).toBeHidden();

    // 3. Verificar que aparece la alerta de doble revisión en el panel
    await expect(page.getByTestId('duplicate-payments-alert')).toBeVisible();
    await page.getByTestId('open-duplicate-review-btn').click();

    // 4. Verificar modal comparador lado a lado y eliminar el duplicado
    await expect(page.getByTestId('duplicate-review-modal')).toBeVisible();
    await expect(page.getByTestId('duplicate-card-0-0')).toBeVisible();
    await expect(page.getByTestId('duplicate-card-0-1')).toBeVisible();

    await page.getByTestId('delete-duplicate-0-0').click();
    await page.getByTestId('confirm-delete-duplicate-0-0').click();

    // Al eliminar uno del par, desaparece la alerta del panel
    await expect(page.getByTestId('duplicate-payments-alert')).toBeHidden();
  });
});
