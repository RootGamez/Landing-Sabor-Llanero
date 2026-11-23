import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ImportPage } from '../pages/ImportPage';
import { E2E_DIR, storageStatePath } from '../support/env';

/**
 * Flujo (d) del plan F10: importación de HomeBank .xhb sintético (fixture).
 * Verifica resumen, mapeo de categorías, commit y que la reimportación
 * sea idempotente (reporta 0 nuevos y 5 existentes).
 */
test.use({ storageState: storageStatePath('owner') });
test.setTimeout(120_000);

const FIXTURE_PATH = path.join(E2E_DIR, 'fixtures', 'homebank-demo.xhb');

test('importa un .xhb sintético y la reimportación da 0 nuevos', async ({ page }) => {
  const importer = new ImportPage(page);
  await importer.goto();

  await test.step('sube archivo sintético y valida el resumen en el paso 2', async () => {
    await importer.upload(FIXTURE_PATH);
    await expect(importer.stat('Gastos')).toContainText('3');
    await expect(importer.stat('Gastos')).toContainText('S/ 183.75');
    await expect(importer.stat('Ingresos')).toContainText('2');
    await expect(importer.stat('Ingresos')).toContainText('S/ 830.50');
    // Los ingresos no se importan por defecto (evita duplicar las ventas de Aronium/POS).
    await expect(page.getByRole('checkbox', { name: /ingresos como ventas/i })).not.toBeChecked();
  });

  await test.step('pasa al paso 3, crea categorías faltantes y ejecuta la importación', async () => {
    await importer.continueToCategories();
    await importer.createAllMissingCategories();
    await importer.runImport();
    await expect(page.getByText('3 nuevos')).toBeVisible();
    await expect(page.getByText('2 nuevos')).toHaveCount(0);
  });

  await test.step('reimportar el mismo archivo reporta 0 nuevos (idempotencia)', async () => {
    await importer.restart();
    await importer.upload(FIXTURE_PATH);
    await importer.continueToCategories();
    await expect(page.getByText('No hay filas nuevas para importar.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: 'Se importarán 0 gastos' })).toBeVisible();
  });
});
