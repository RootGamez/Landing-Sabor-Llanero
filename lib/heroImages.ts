import type { SiteImage } from "@/types";

/**
 * Fotos del carrusel del hero.
 * Para cambiar fotos: reemplaza los archivos en /public/images/hero/
 * (o agrega nuevos) y actualiza este array. Nada más que tocar.
 */
export const heroImages: SiteImage[] = [
  {
    src: "/images/hero/hero-1.jpg",
    alt: "Pizza artesanal recién salida del horno en Pizzería Sabor Llanero",
  },
  {
    src: "/images/hero/hero-2.jpg",
    alt: "Interior acogedor del local familiar de Sabor Llanero en Ocucaje",
  },
  {
    src: "/images/hero/hero-3.jpg",
    alt: "Pizza familiar con ingredientes frescos y queso derretido",
  },
  {
    src: "/images/hero/hero-4.jpg",
    alt: "Tequeños venezolanos dorados, especialidad de la casa",
  },
  {
    src: "/images/hero/hero-5.jpg",
    alt: "Equipo familiar de Pizzería Sabor Llanero preparando pizza artesanal",
  },
];
