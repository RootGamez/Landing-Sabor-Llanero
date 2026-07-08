import type { SiteImage } from "@/types";

/**
 * Secuencia real del armado de la pizza (sección "Así nace tu pizza").
 * Guarda tus 5 fotos en /public/images/builder/ con estos nombres,
 * en orden: masa → salsa → queso → ingredientes → horneada.
 * Formatos válidos: .png, .jpg o .webp (ajusta la extensión aquí).
 */
export const builderImages: SiteImage[] = [
  { src: "/images/builder/etapa-1.png", alt: "Masa de pizza artesanal estirada a mano" },
  { src: "/images/builder/etapa-2.png", alt: "Masa con salsa de tomate de la casa" },
  { src: "/images/builder/etapa-3.png", alt: "Pizza con mozzarella fresca recién rallada" },
  { src: "/images/builder/etapa-4.png", alt: "Pizza con jamón, champiñones y maíz antes del horno" },
  { src: "/images/builder/etapa-5.png", alt: "Pizza artesanal recién salida del horno de Sabor Llanero" },
];
