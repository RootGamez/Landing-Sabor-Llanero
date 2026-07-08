/**
 * Deep link de WhatsApp por ítem del catálogo (BLUEPRINT §2.6/§4.3): arma el
 * mensaje con `buildWhatsappLink` de @sabor/shared usando la plantilla del
 * idioma activo.
 *
 * Fuente de la config de WhatsApp: GET /api/whatsapp es público (sin guard de
 * auth en apps/api/src/routes/whatsapp.ts — solo el PATCH exige rol), así que
 * se usa como fuente primaria porque trae la plantilla real configurada por
 * el dueño (con el placeholder [tamaño]). Si la API no responde, se cae a un
 * fallback estático con el número de BRAND (@sabor/shared) y una plantilla
 * por defecto equivalente a la semilla del backend (BLUEPRINT §4.1), para que
 * el botón de pedir nunca quede roto aunque el catálogo no cargue.
 */
import { BRAND, buildWhatsappLink, formatPrice, type Lang, type WhatsappConfig } from "@sabor/shared";

const FALLBACK_TEMPLATE: Record<Lang, string> = {
  es: "Hola 👋 Quiero pedir: *[nombre]* ([tamaño]) — [precio]. [link]",
  en: "Hi 👋 I'd like to order: *[nombre]* ([tamaño]) — [precio]. [link]",
};

export const FALLBACK_WHATSAPP_CONFIG: WhatsappConfig = {
  id: 0,
  phoneNumber: BRAND.whatsapp.number,
  messageTemplateEs: FALLBACK_TEMPLATE.es,
  messageTemplateEn: FALLBACK_TEMPLATE.en,
  updatedAt: "",
};

interface OrderLinkParams {
  config: WhatsappConfig;
  lang: Lang;
  itemName: string;
  price: number;
  sizeLabel?: string | null;
  /** Anchor de vuelta al ítem dentro de la landing (no hay página de detalle: export estático). */
  itemUrl: string;
}

export function buildItemOrderLink(params: OrderLinkParams): string {
  const template = params.lang === "en" ? params.config.messageTemplateEn : params.config.messageTemplateEs;
  return buildWhatsappLink({
    phoneNumber: params.config.phoneNumber,
    messageTemplate: template,
    itemName: params.itemName,
    sizeLabel: params.sizeLabel,
    price: formatPrice(params.price),
    itemUrl: params.itemUrl,
  });
}
