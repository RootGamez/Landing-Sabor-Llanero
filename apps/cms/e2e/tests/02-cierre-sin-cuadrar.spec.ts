import { expect, test } from '@playwright/test';
import { ClosuresPage } from '../pages/ClosuresPage';
import { PosPage } from '../pages/PosPage';
import { closeOpenSession } from '../support/api';
import { storageStatePath } from '../support/env';

/**
 * Flujo (b) del plan F10: cierre de caja sin cuadrar (D15).
 * El check "Cuadrar caja" viene desmarcado por defecto; cerrar así
 * muestra "Caja no cuadrada" en la tarjeta y el badge "Sin cuadrar" en el historial.
 */
test.use({ storageState: storageStatePath('owner') });
test.setTimeout(90_000);

test('cierre sin cuadrar muestra "Caja no cuadrada" y badge en historial', async ({ page }) => {
  await closeOpenSession();

  const pos = new PosPage(page);
  await test.step('abre caja con S/ 50 y vende una gaseosa', async () => {
    await pos.goto();
    await pos.openRegister('50');
    await pos.addProduct('Gaseosa Demo');
    await pos.charge();
    await pos.pay({ method: 'Yape' });
    await expect(pos.toast('Venta #1 registrada')).toBeVisible();
  });

  const closures = new ClosuresPage(page);
  await test.step('cierra la caja sin marcar el conteo de efectivo', async () => {
    await closures.goto();
    await expect(closures.reconcileCheckbox).not.toBeChecked();
    await closures.confirmClose();
  });

  await test.step('resumen muestra "Caja no cuadrada" y oculta esperado/diferencia', async () => {
    await expect(page.getByText('Caja no cuadrada').first()).toBeVisible();
    await expect(page.getByText('Efectivo esperado')).toBeHidden();
    await expect(page.getByText('Faltante')).toBeHidden();
    await expect(page.getByText('Sobrante')).toBeHidden();
  });

  await test.step('en el historial de cierres aparece con el badge "Sin cuadrar"', async () => {
    await page.goto('/ventas/cierres');
    const table = page.getByRole('table');
    await expect(table.getByText('Sin cuadrar').first()).toBeVisible();
  });
});
