import { expect, type Locator, type Page } from '@playwright/test';

/** Tienda online > Categorías: alta/edición de categorías y su precio por tamaño. */
export class CategoriesPage {
  readonly save: Locator;

  constructor(private readonly page: Page) {
    this.save = page.getByRole('button', { name: 'Guardar cambios' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/tienda/categorias');
    await expect(this.page.getByRole('button', { name: 'Editar Pizzas' })).toBeVisible();
  }

  async edit(name: string): Promise<void> {
    await this.page.getByRole('button', { name: `Editar ${name}` }).click();
    await expect(this.save).toBeVisible();
  }

  sizePrice(label: string): Locator {
    return this.page.getByLabel(label, { exact: true });
  }

  toast(text: string | RegExp): Locator {
    return this.page.getByRole('status').filter({ hasText: text });
  }
}
