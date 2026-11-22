import { expect, test } from '@playwright/test';
import { ClosuresPage } from '../pages/ClosuresPage';
import { PosPage } from '../pages/PosPage';
import { closeOpenSession } from '../support/api';
import { storageStatePath } from '../support/env';

/**
 * Flujo (c) del plan F10: el cajero tiene acceso exclusivo al POS.
 * Aterriza en /ventas/pos; si navega a / o /gastos es redirigido al POS;
 * puede operar su caja y cerrarla.
 */
test.use({ storageState: storageStatePath('cashier') });
test.setTimeout(90_000);

test('el cajero es redirigido al POS y no puede acceder al dashboard ni a gastos', async ({ page }) => {
  await closeOpenSession();

  await test.step('navegar a la raíz redirige a /ventas/pos', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/ventas\/pos$/);
  });

  await test.step('navegar a /gastos redirige a /ventas/pos', async () => {
    await page.goto('/gastos');
    await expect(page).toHaveURL(/\/ventas\/pos$/);
  });

  await test.step('navegar a /ajustes/usuarios redirige a /ventas/pos', async () => {
    await page.goto('/ajustes/usuarios');
    await expect(page).toHaveURL(/\/ventas\/pos$/);
  });

  const pos = new PosPage(page);
  await test.step('puede abrir caja, vender un producto y cerrar su turno', async () => {
    await pos.goto();
    await pos.openRegister('20');
    await pos.addProduct('Agua Demo');
    await pos.charge();
    await pos.pay({ method: 'Yape' });
    await expect(pos.toast('Venta #1 registrada')).toBeVisible();

    const closures = new ClosuresPage(page);
    await closures.goto();
    await closures.confirmClose();
    await expect(closures.closedTitle).toBeVisible();
  });
});
