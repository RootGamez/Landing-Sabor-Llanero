import { expect, test } from '@playwright/test';
import { CategoriesPage } from '../pages/CategoriesPage';
import { MenuItemPage } from '../pages/MenuItemPage';
import { PosPage } from '../pages/PosPage';
import { closeOpenSession } from '../support/api';
import { CATALOG, storageStatePath } from '../support/env';

/**
 * Presentaciones por ítem (Media docena, 1 docena, Docena y media, 2 docenas).
 * Tequeños Demo (categoría sin tamaños, S/ 36.00) se configura desde el formulario y se vende en el POS:
 * media docena S/ 20.00 + docena y media S/ 54.00 (sugerido: 36 x 1,5) = S/ 74.00.
 */
test.use({ storageState: storageStatePath('owner') });
test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

test('el dueño activa presentaciones en un ítem y se venden por presentación en el POS', async ({ page }) => {
  await closeOpenSession();
  const item = new MenuItemPage(page);

  await test.step('activa "Vender por presentaciones": la docena toma el precio actual y se usan los sugeridos', async () => {
    await item.goto(CATALOG.tequenosDemo);
    await expect(item.portionsSwitch).not.toBeChecked();
    await item.portionsSwitch.click();
    await expect(item.portionPrice('1 docena')).toHaveValue('36');
    await item.useSuggested.click();
    await expect(item.portionPrice('Media docena')).toHaveValue('18');
    await expect(item.portionPrice('Docena y media')).toHaveValue('54');
    await expect(item.portionPrice('2 docenas')).toHaveValue('72');
  });

  await test.step('ajusta la media docena, quita 2 docenas y guarda', async () => {
    await item.portionPrice('Media docena').fill('20');
    await item.portionPrice('2 docenas').fill('');
    await item.save.click();
    await expect(item.toast('Ítem actualizado')).toBeVisible();
  });

  await test.step('al recargar las presentaciones quedan precargadas', async () => {
    await page.reload();
    await expect(item.portionsSwitch).toBeChecked();
    await expect(item.portionPrice('Media docena')).toHaveValue('20');
    await expect(item.portionPrice('1 docena')).toHaveValue('36');
    await expect(item.portionPrice('2 docenas')).toHaveValue('');
  });

  const pos = new PosPage(page);
  await test.step('en el POS la tarjeta dice "desde" y el selector pide la presentación', async () => {
    await pos.goto();
    await pos.openRegister('50');
    await pos.openCategory('Entradas');
    await expect(pos.product('Tequeños Demo')).toHaveAccessibleName(/desde S\/\s20\.00/);
    await pos.product('Tequeños Demo').click();
    await expect(pos.dialog.getByText('Elige la presentación para agregarlo al ticket.')).toBeVisible();
    await expect(pos.dialog.getByText('6 unidades')).toBeVisible();
    await expect(pos.dialog.getByRole('button', { name: /^2 docenas/ })).toHaveCount(0);
    await pos.dialog.getByRole('button', { name: /^Media docena/ }).click();
    await expect(pos.dialog).toBeHidden();
  });

  await test.step('vende media docena y docena y media con el total correcto', async () => {
    await pos.addProduct('Tequeños Demo', 'Docena y media');
    await pos.charge();
    await expect(pos.dialog.getByRole('status').filter({ hasText: 'Total a cobrar' })).toContainText('S/ 74.00');
    await pos.pay({ method: 'Efectivo', received: '100' });
    await expect(pos.toast(/Venta #\d+ registrada · Vuelto S\/\s26\.00/)).toBeVisible();
    const sheet = await pos.openSessionSales();
    await expect(sheet).toContainText('Tequeños Demo (Media docena)');
    await expect(sheet).toContainText('Tequeños Demo (Docena y media)');
  });
});

test('quitar las presentaciones devuelve el ítem a su precio único', async ({ page }) => {
  const item = new MenuItemPage(page);
  await item.goto(CATALOG.tequenosDemo);
  await expect(item.portionsSwitch).toBeChecked();
  await item.portionsSwitch.click();
  await item.save.click();
  await expect(item.toast('Ítem actualizado')).toBeVisible();
  await page.reload();
  await expect(item.portionsSwitch).not.toBeChecked();
  await expect(page.getByLabel('Precio', { exact: true })).toHaveValue('36');
});

test('una categoría de pizzas se sigue pudiendo editar y solo pide sus tamaños', async ({ page }) => {
  const categories = new CategoriesPage(page);
  await categories.goto();
  await categories.edit('Pizzas');
  await expect(categories.sizePrice('Mediana')).toHaveValue('20');
  await expect(categories.sizePrice('Grande')).toHaveValue('30');
  await expect(page.getByLabel('Media docena', { exact: true })).toHaveCount(0);
  await categories.save.click();
  await expect(categories.toast('Categoría actualizada')).toBeVisible();
});
