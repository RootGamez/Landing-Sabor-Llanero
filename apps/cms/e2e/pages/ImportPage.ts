import { expect, type Locator, type Page } from '@playwright/test';

/** Asistente de importación de HomeBank (.xhb / .csv). */
export class ImportPage {
  readonly fileInput: Locator;

  constructor(private readonly page: Page) {
    this.fileInput = page.locator('input[type="file"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/gastos/importar');
    await expect(this.page.getByRole('heading', { name: '1. Sube tu archivo' })).toBeVisible();
  }

  async upload(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
    await expect(this.page.getByRole('heading', { name: '2. Revisa el resumen' })).toBeVisible();
  }

  stat(label: string): Locator {
    return this.page.locator('dl > div').filter({ has: this.page.getByText(label, { exact: true }) });
  }

  async continueToCategories(): Promise<void> {
    await this.page.getByRole('button', { name: 'Continuar' }).click();
    await expect(this.page.getByRole('heading', { name: '3. Ordena las categorías' })).toBeVisible();
  }

  /** Para cada categoría nueva del archivo elige "Crear «…»". */
  async createAllMissingCategories(): Promise<void> {
    const selects = this.page.getByRole('combobox', { name: /^Destino de/ });
    const count = await selects.count();
    for (let index = 0; index < count; index += 1) {
      await selects.nth(index).click();
      await this.page.getByRole('option', { name: /^Crear/ }).click();
    }
  }

  async runImport(): Promise<void> {
    await this.page.getByRole('button', { name: 'Importar', exact: true }).click();
    await expect(this.page.getByText('Importación terminada')).toBeVisible({ timeout: 30_000 });
  }

  async restart(): Promise<void> {
    await this.page.getByRole('button', { name: 'Importar otro archivo' }).click();
    await expect(this.page.getByRole('heading', { name: '1. Sube tu archivo' })).toBeVisible();
  }
}
