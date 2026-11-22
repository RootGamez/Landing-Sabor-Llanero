import { expect, type Locator, type Page } from '@playwright/test';

interface ReconciledClose {
  /** Efectivo contado escrito a mano, en soles ("98.00"). */
  countedSoles: string;
  notes?: string;
}

/** Cierre de caja y resumen del día (imagen para compartir). */
export class ClosuresPage {
  readonly reconcileCheckbox: Locator;
  readonly closeButton: Locator;
  readonly closedTitle: Locator;
  readonly downloadButton: Locator;

  constructor(private readonly page: Page) {
    this.reconcileCheckbox = page.getByRole('checkbox', { name: 'Cuadrar caja (contar efectivo)' });
    this.closeButton = page.getByRole('button', { name: 'Cerrar caja', exact: true });
    this.closedTitle = page.getByRole('heading', { name: 'Caja cerrada' });
    this.downloadButton = page.getByRole('button', { name: 'Descargar PNG' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/ventas/cierres');
    await expect(this.closeButton).toBeVisible();
  }

  /** Cuadra la caja contando el efectivo y deja ver el "esperado" antes de cerrar. */
  async fillReconciliation({ countedSoles, notes }: ReconciledClose): Promise<void> {
    await this.reconcileCheckbox.check();
    await this.page.getByRole('radio', { name: 'Escribir el monto' }).click();
    await this.page.getByLabel('Efectivo contado (S/)').fill(countedSoles);
    if (notes) await this.page.getByLabel('Notas del cierre (opcional)').fill(notes);
  }

  expectedCashRow(): Locator {
    return this.page.locator('dl').filter({ hasText: 'Efectivo esperado' });
  }

  differenceStatus(): Locator {
    return this.page.getByRole('status').filter({ hasText: /Faltante|Sobrante|Cuadra/ });
  }

  async confirmClose(): Promise<void> {
    await this.closeButton.click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Sí, cerrar caja' }).click();
    await expect(this.closedTitle).toBeVisible();
  }

  /** Descarga el PNG del resumen y devuelve su nombre y bytes. */
  async downloadImage(): Promise<{ fileName: string; bytes: Buffer }> {
    await expect(this.downloadButton).toBeEnabled({ timeout: 15_000 });
    const [download] = await Promise.all([this.page.waitForEvent('download'), this.downloadButton.click()]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    return { fileName: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
  }
}
