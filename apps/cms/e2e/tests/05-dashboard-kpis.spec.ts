import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { closeOpenSession, seedClosedDayWithSale } from '../support/api';
import { storageStatePath } from '../support/env';

/**
 * Flujo (e) del plan F10: Dashboard carga KPIs para "Hoy" tras haber ventas.
 */
test.use({ storageState: storageStatePath('owner') });
test.setTimeout(90_000);

test('el dashboard carga KPIs para "Hoy" tras registrar ventas', async ({ page }) => {
  await closeOpenSession();
  await seedClosedDayWithSale();

  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await test.step('selecciona el filtro "Hoy" y valida que los KPIs carguen', async () => {
    await dashboard.selectPeriod('Hoy');
    await expect(dashboard.kpis).toBeVisible();

    // Valida que los KPIs muestren formato numérico en soles y cantidad
    await expect(dashboard.kpiValue('Ingresos')).toContainText('S/');
    await expect(dashboard.kpiValue('Ticket promedio')).toContainText('S/');
    await expect(dashboard.kpiValue('Ventas')).not.toHaveText('0');
  });
});
