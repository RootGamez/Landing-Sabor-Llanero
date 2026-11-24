import { expect, type Locator, type Page } from '@playwright/test';

/** Formulario de ítem del menú (Tienda online > Menú > Editar) y sus presentaciones. */
export class MenuItemPage {
  readonly portionsSwitch: Locator;
  readonly useSuggested: Locator;
  readonly save: Locator;

  constructor(private readonly page: Page) {
    this.portionsSwitch = page.getByRole('switch', { name: 'Vender por presentaciones' });
    this.useSuggested = page.getByRole('button', { name: 'Usar sugeridos' });
    this.save = page.getByRole('button', { name: 'Guardar cambios' });
  }

  async goto(itemId: number): Promise<void> {
    await this.page.goto(`/tienda/menu/${itemId}`);
    await expect(this.portionsSwitch).toBeVisible();
  }

  /** Campo de precio de una presentación ("Media docena", "1 docena", "Docena y media", "2 docenas"). */
  portionPrice(label: string): Locator {
    return this.page.getByLabel(label, { exact: true });
  }

  toast(text: string | RegExp): Locator {
    return this.page.getByRole('status').filter({ hasText: text });
  }
}
