import { expect, type Locator, type Page } from '@playwright/test';

interface QuickExpense {
  /** Monto o suma estilo HomeBank ("12+10+5"). */
  amount: string;
  /** Tipo de gasto: si no existe, se crea al guardar. */
  newCategory: string;
  fromRegister: boolean;
}

export class ExpensesPage {
  readonly amount: Locator;
  readonly category: Locator;
  readonly save: Locator;

  constructor(private readonly page: Page) {
    this.amount = page.getByLabel('Monto (S/)');
    this.category = page.getByRole('combobox', { name: 'Otro tipo' });
    this.save = page.getByRole('button', { name: 'Guardar gasto' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/gastos');
    await expect(this.amount).toBeVisible();
  }

  async register({ amount, newCategory, fromRegister }: QuickExpense): Promise<void> {
    await this.amount.fill(amount);
    await this.category.fill(newCategory);
    await this.page.getByRole('option', { name: new RegExp(`Usar «${newCategory}» como nuevo tipo`) }).click();
    if (fromRegister) await this.page.getByRole('checkbox', { name: 'Pagado con efectivo de caja' }).check();
    await this.save.click();
  }

  toast(text: string): Locator {
    return this.page.getByRole('status').filter({ hasText: text });
  }

  listedExpense(category: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: category });
  }
}
