import type { SiteImage } from "@/types";

/**
 * Imágenes VERTICALES del carrusel del hero (tarjeta tipo póster).
 * Para cambiar fotos: agrega archivos a /public/images/ y actualiza
 * este array. Orden = orden de aparición.
 */
export const heroImages: SiteImage[] = [
  {
    src: "/images/featured/pizza-alborada.jpg",
    alt: "Pizza Alborada con tocino ahumado, maíz tierno y champiñones, recién horneada",
  },
  {
    src: "/images/promos/pizza-montanera.jpg",
    alt: "Pizza Montañera con pepperoni, maíz y champiñones de Sabor Llanero",
  },
  {
    src: "/images/promos/pizza-full-beef.jpg",
    alt: "Pizza Full Beef con carne molida, mozzarella y salchicha ahumada",
  },
  {
    src: "/images/promos/pizza-hawaiana.jpg",
    alt: "Pizza Hawaiana edición artesanal con piña fresca en almíbar",
  },
];
