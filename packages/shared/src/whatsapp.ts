/**
 * Construcción del link de WhatsApp a partir de la plantilla configurada
 * (BLUEPRINT §4.1/§4.3). Adaptación de whatsapp.ts de Jaw con el placeholder
 * nuevo `[tamaño]`. Plantilla por idioma (default en whatsapp_config):
 * "Hola 👋 Quiero pedir: *[nombre]* ([tamaño]) — [precio]. [link]"
 */
export interface WhatsappLinkParams {
  phoneNumber: string;
  messageTemplate: string;
  itemName: string;
  /** Etiqueta del tamaño elegido, ya en el idioma activo. Omitir/null si el ítem no tiene tamaños. */
  sizeLabel?: string | null;
  price: string;
  itemUrl: string;
}

export function buildWhatsappLink(params: WhatsappLinkParams): string {
  const { phoneNumber, messageTemplate, itemName, sizeLabel, price, itemUrl } = params;

  // replaceAll: si la plantilla repite algún placeholder, se sustituyen todas
  // las ocurrencias (con .replace() solo se reemplazaba la primera).
  let message = messageTemplate
    .replaceAll('[nombre]', itemName)
    .replaceAll('[precio]', price)
    .replaceAll('[link]', itemUrl);

  message = sizeLabel ? message.replaceAll('[tamaño]', sizeLabel) : stripSizePlaceholder(message);

  const digits = phoneNumber.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Ítems sin tamaño (categorías `hasSizes = false`, ej. bebidas/promos): en
 * vez de dejar "*Tequeños* () — S/ 12.00" con paréntesis vacíos, se quita
 * `[tamaño]` junto con el paréntesis que lo envuelve en la plantilla. Si la
 * plantilla no usa paréntesis alrededor del placeholder, igual se limpia.
 */
function stripSizePlaceholder(message: string): string {
  return message
    .replace(/\s*\(\[tamaño\]\)/g, '')
    .replace(/\[tamaño\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
