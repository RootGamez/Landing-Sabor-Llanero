import { expect, test } from '@playwright/test';
import { PosPage } from '../pages/PosPage';
import { closeOpenSession } from '../support/api';
import { storageStatePath } from '../support/env';

/**
 * Flujo (f) del plan F10: Viewport móvil (390px) para el POS.
 * En pantalla pequeña, el ticket lateral se oculta y la venta se
 * confirma desde la barra inferior fija (MobileTicketBar).
 */
test.use({ storageState: storageStatePath('owner') });
test.setTimeout(90_000);

test('en pantalla móvil se cobra desde la barra inferior', async ({ page }) => {
  await closeOpenSession();

  const pos = new PosPage(page);
  await pos.goto();
  await pos.openRegister('50');

  await test.step('agrega un producto y verifica la barra inferior móvil', async () => {
    await pos.addProduct('Pizza Demo', 'Mediana');
    await expect(page.getByText(/Ver ticket · 1 producto/)).toBeVisible();
    await expect(pos.chargeButton).toBeVisible();
  });

  await test.step('cobra desde la barra inferior usando Yape por omisión', async () => {
    await pos.charge();
    await pos.pay();
    await expect(pos.toast('Venta #1 registrada')).toBeVisible();
  });
});
