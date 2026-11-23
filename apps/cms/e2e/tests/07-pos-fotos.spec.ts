import { expect, test } from '@playwright/test';
import { PosPage } from '../pages/PosPage';
import { closeOpenSession } from '../support/api';
import { storageStatePath } from '../support/env';

/**
 * Cuadrícula del POS: categorías -> productos, con el interruptor "Mostrar fotos".
 * El catálogo sintético no tiene fotos: sin foto la celda debe seguir completa (ícono, nada roto).
 */
test.use({ storageState: storageStatePath('owner') });
test.setTimeout(90_000);

test('las celdas funcionan con y sin fotos, y la preferencia se recuerda', async ({ page }) => {
  await closeOpenSession();
  const pos = new PosPage(page);
  await pos.goto();
  await pos.openRegister('50');

  await test.step('con fotos (por defecto) se abre una categoría y se ve el producto', async () => {
    await expect(pos.photosSwitch).toBeChecked();
    await pos.openCategory('Bebidas');
    await expect(pos.product('Gaseosa Demo')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Productos' }).locator('img')).toHaveCount(0);
  });

  await test.step('apagar las fotos persiste tras recargar', async () => {
    await pos.photosSwitch.click();
    await expect(pos.photosSwitch).not.toBeChecked();
    await page.reload();
    await expect(pos.photosSwitch).not.toBeChecked();
    await expect(pos.categoryTile('Pizzas')).toBeVisible();
  });
});
