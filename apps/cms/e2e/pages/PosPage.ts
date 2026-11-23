import { expect, type Locator, type Page } from '@playwright/test';

export type PaymentChoice = 'Efectivo' | 'Yape' | 'Plin' | 'Tarjeta' | 'Transferencia';

interface PayOptions {
  /** Sin método: la API registra Yape por defecto (D15). */
  method?: PaymentChoice;
  /** Solo efectivo: lo que entrega el cliente, en soles ("50"). */
  received?: string;
}

/** Punto de venta: abrir caja, armar el ticket, cobrar y anular ventas del turno. */
export class PosPage {
  readonly dialog: Locator;
  /** "Cobrar" del ticket (escritorio) o de la barra inferior (móvil); el otro está oculto. */
  readonly chargeButton: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog');
    this.chargeButton = page.getByRole('button', { name: /^Cobrar(\s+Enter)?$/ });
  }

  async goto(): Promise<void> {
    await this.page.goto('/ventas/pos');
  }

  async openRegister(openingSoles: string): Promise<void> {
    await this.page.getByLabel('Efectivo inicial (S/)').fill(openingSoles);
    await this.page.getByRole('button', { name: 'Abrir caja' }).click();
    await expect(this.page.getByText('Caja abierta desde')).toBeVisible();
  }

  product(name: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${name},`) });
  }

  /** Interruptor "Mostrar fotos" de la barra del catálogo. */
  get photosSwitch(): Locator {
    return this.page.getByRole('switch', { name: 'Mostrar fotos' });
  }

  categoryTile(name: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${name},`) });
  }

  /** Abre una categoría desde la cuadrícula inicial (las celdas de producto aparecen después). */
  async openCategory(name: string): Promise<void> {
    await this.categoryTile(name).click();
    await expect(this.page.getByRole('button', { name: /^Volver a las categorías/ })).toBeVisible();
  }

  /**
   * Toca un producto; si tiene tamaños, elige `size` en el selector. El POS arranca en la vista de
   * categorías, así que el producto se localiza con el buscador (resultados globales) y se limpia después.
   */
  async addProduct(name: string, size?: string): Promise<void> {
    const search = this.page.getByLabel('Buscar producto');
    await search.fill(name);
    await this.product(name).click();
    if (size) await this.dialog.getByRole('button', { name: new RegExp(`^${size}`) }).click();
    await expect(this.dialog).toBeHidden();
    await search.fill('');
  }

  async charge(): Promise<void> {
    await this.chargeButton.click();
    await expect(this.dialog.getByText('Total a cobrar')).toBeVisible();
  }

  /** Elige método/recibido y confirma. Reintenta el clic: el diálogo ignora envíos en sus primeros 400 ms. */
  async pay({ method, received }: PayOptions = {}): Promise<void> {
    if (method) await this.dialog.getByRole('button', { name: method, exact: true }).click();
    if (received) await this.dialog.getByLabel('Recibido (S/)').fill(received);
    const confirm = this.dialog.getByRole('button', { name: /^Cobrar \(/ });
    await expect(async () => {
      if (await confirm.isVisible()) await confirm.click({ timeout: 1_000 });
      await expect(this.dialog).toBeHidden({ timeout: 2_000 });
    }).toPass({ timeout: 10_000 });
  }

  /** Vuelto mostrado en el diálogo de cobro (texto del bloque de estado). */
  changeDisplay(): Locator {
    return this.dialog.locator('#pos-change');
  }

  toast(text: string | RegExp): Locator {
    return this.page.getByRole('status').filter({ hasText: text });
  }

  async openSessionSales(): Promise<Locator> {
    await this.page.getByRole('button', { name: /^Ventas( del turno)?$/ }).click();
    const sheet = this.page.getByRole('dialog', { name: 'Ventas del turno' });
    await expect(sheet).toBeVisible();
    return sheet;
  }

  async voidSale(number: number, reason: string): Promise<void> {
    const sheet = await this.openSessionSales();
    const row = sheet.getByRole('listitem').filter({ hasText: `Venta #${number}` });
    await row.getByRole('button', { name: 'Anular', exact: true }).click();
    await row.getByLabel('Motivo de la anulación').fill(reason);
    await row.getByRole('button', { name: 'Anular venta' }).click();
    await expect(row.getByText('Anulada')).toBeVisible();
    await expect(row.getByText(`Motivo: ${reason}`)).toBeVisible();
    await this.page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  }
}
