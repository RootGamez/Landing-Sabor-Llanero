import type { EmailData, EmailTemplate } from '@sabor/shared';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateDefinition<T extends EmailTemplate> {
  /** Campos de `data` que son links: el handler valida que su origen esté permitido. */
  linkFields: ReadonlyArray<keyof EmailData<T> & string>;
  /**
   * Validación estricta de cada link, sobre la URL ya parseada (ruta, query y
   * formato del token esperados). Complementa la lista de orígenes permitidos.
   */
  isAllowedLink(url: URL): boolean;
  render(data: EmailData<T>): RenderedEmail;
}

/**
 * Una entrada por plantilla del contrato compartido. Al sumar una variante a
 * `emailRequestSchema` (en @sabor/shared), TypeScript exige agregarla aquí.
 */
export type TemplateRegistry = { [T in EmailTemplate]: TemplateDefinition<T> };
