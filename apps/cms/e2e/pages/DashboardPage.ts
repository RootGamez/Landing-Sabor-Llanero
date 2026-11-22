import { expect, type Locator, type Page } from '@playwright/test';

export class DashboardPage {
  readonly kpis: Locator;

  constructor(private readonly page: Page) {
    this.kpis = page.getByRole('region', { name: 'Indicadores del período' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  }

  async selectPeriod(label: string): Promise<void> {
    const button = this.page.getByRole('group', { name: 'Período' }).getByRole('button', { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }

  /** Valor de un indicador por su etiqueta ("Ingresos" -> "S/ 51.00"): el span que sigue a la etiqueta. */
  kpiValue(label: string): Locator {
    return this.kpis.locator(`xpath=.//span[normalize-space()="${label}"]/following-sibling::span[1]`);
  }
}
