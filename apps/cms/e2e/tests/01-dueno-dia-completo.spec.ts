import { expect, test, type Page } from '@playwright/test';
import { ClosuresPage } from '../pages/ClosuresPage';
import { ExpensesPage } from '../pages/ExpensesPage';
import { LoginPage } from '../pages/LoginPage';
import { PosPage } from '../pages/PosPage';
import { closeOpenSession } from '../support/api';
import { USERS } from '../support/env';

/**
 * Flujo (a) del plan F10: el dueño abre caja, vende, anula, anota un gasto de caja,
 * cierra cuadrando con diferencia y descarga la imagen del resumen.
 *
 * Cuentas (soles): apertura 100.00 + venta 1 en efectivo 25.50 − gasto de caja 27.00
 * = 98.50 esperados. Se cuentan 98.00 → "Faltante S/ 0.50". La venta 3 se anula y no suma.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(150_000);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function signInAndOpenRegister(page: Page): Promise<PosPage> {
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn(USERS.owner);
  await expect(page).toHaveURL(/\/$/);
  const pos = new PosPage(page);
  await pos.goto();
  await pos.openRegister('100');
  return pos;
}

async function sellPizzaAndSodaInCash(pos: PosPage): Promise<void> {
  await pos.addProduct('Pizza Demo', 'Mediana');
  await pos.addProduct('Gaseosa Demo');
  await expect(pos.chargeButton).toBeEnabled();
  await pos.charge();
  await pos.pay({ method: 'Efectivo', received: '50' });
  await expect(pos.toast('Venta #1 registrada · Vuelto S/ 24.50')).toBeVisible();
}

async function sellWithoutChoosingMethod(pos: PosPage, product: string): Promise<void> {
  await pos.addProduct(product);
  await pos.charge();
  await expect(pos.dialog.getByText('Si no eliges, se registra como Yape.')).toBeVisible();
  await pos.pay();
}

async function registerCashExpense(page: Page): Promise<void> {
  const expenses = new ExpensesPage(page);
  await expenses.goto();
  await expenses.register({ amount: '12+10+5', newCategory: 'Empaques', fromRegister: true });
  await expect(expenses.toast('Gasto guardado: S/ 27.00')).toBeVisible();
  await expect(expenses.listedExpense('Empaques')).toBeVisible();
}

test('el dueño cubre el día completo: caja, ventas, anulación, gasto, cierre e imagen', async ({ page }) => {
  await closeOpenSession();

  const pos = await test.step('inicia sesión por la UI y abre la caja con S/ 100', () => signInAndOpenRegister(page));

  await test.step('vende pizza mediana + gaseosa en efectivo con vuelto', () => sellPizzaAndSodaInCash(pos));

  await test.step('vende sin elegir método: se registra como Yape', async () => {
    await sellWithoutChoosingMethod(pos, 'Gaseosa Demo');
    await expect(pos.toast('Venta #2 registrada')).toBeVisible();
  });

  await test.step('vende una tercera y la anula con motivo', async () => {
    await sellWithoutChoosingMethod(pos, 'Agua Demo');
    await pos.voidSale(3, 'Cliente se arrepintió');
    await expect(pos.toast('Venta #3 anulada')).toBeVisible();
  });

  await test.step('registra un gasto 12+10+5 con tipo nuevo "Empaques" pagado de caja', () => registerCashExpense(page));

  const closures = new ClosuresPage(page);
  await test.step('cierra cuadrando: esperado S/ 98.50, contado S/ 98.00 → Faltante S/ 0.50', async () => {
    await closures.goto();
    await closures.fillReconciliation({ countedSoles: '98', notes: 'E2E: diferencia de 50 céntimos' });
    await expect(closures.expectedCashRow()).toContainText('S/ 98.50');
    await expect(closures.differenceStatus()).toContainText('Faltante S/ 0.50');
    await closures.confirmClose();
  });

  await test.step('el resumen muestra el día y el botón Descargar genera un PNG', async () => {
    await expect(page.getByRole('img', { name: /S\/ 31\.00 vendidos en 2 ventas/ })).toBeVisible();
    await expect(page.getByText('Faltante S/ 0.50').first()).toBeVisible();
    const { fileName, bytes } = await closures.downloadImage();
    expect(fileName).toMatch(/\.png$/);
    expect(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);
    expect(bytes.length).toBeGreaterThan(10_000);
  });
});
