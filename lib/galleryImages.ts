import type { SiteImage } from "@/types";

/**
 * Galería (formato vertical 2:3 — afiches y fotos de productos).
 * Para cambiar: reemplaza archivos en /public/images/promos/ y
 * actualiza este array.
 */
export const galleryImages: SiteImage[] = [
  {
    src: "/images/promos/pizza-alborada-gourmet.jpg",
    alt: "Pizza Alborada Gourmet: mozzarella, tocino ahumado, maíz tierno y champiñones",
  },
  {
    src: "/images/promos/pizza-montanera.jpg",
    alt: "Nueva Pizza Montañera con pepperoni, maíz y champiñones",
  },
  {
    src: "/images/promos/pizza-full-beef.jpg",
    alt: "Pizza Full Beef con base de carne molida, mozzarella y salchicha ahumada",
  },
  {
    src: "/images/promos/pizza-hawaiana.jpg",
    alt: "La Hawaiana edición artesanal con piña fresca cocinada en casa",
  },
  {
    src: "/images/promos/promo-tequenos.jpg",
    alt: "Promoción de tequeños crocantes y pizza artesanal en Sabor Llanero",
  },
];
