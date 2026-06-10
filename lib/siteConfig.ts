import type { NavLink, SocialLink } from "@/types";

/**
 * ÚNICA fuente de verdad de los datos del negocio.
 * Cambia aquí teléfono, dirección, redes y links — nada está
 * hardcodeado dentro de los componentes.
 */
export const siteConfig = {
  name: "Sabor Llanero",
  fullName: "Pizzería Sabor Llanero",
  slogan: "Pizza artesanal con sabor de dos tierras",
  description:
    "Pizzería artesanal familiar en Ocucaje, Ica. Fusión de sabores de Venezuela y Perú: masa artesanal, ingredientes frescos y atención con cariño de familia.",

  /** URL pública del sitio (cámbiala cuando tengas dominio propio) */
  url: "https://pizzeriasaborllanero.com",

  phone: "+51 932 770 766",
  phoneHref: "tel:+51932770766",

  whatsapp: {
    number: "51932770766",
    message: "¡Hola! 👋 Quisiera hacer un pedido en Pizzería Sabor Llanero.",
    get url(): string {
      return `https://wa.me/${this.number}?text=${encodeURIComponent(this.message)}`;
    },
  },

  address: {
    street: "Calle Principal s/n", // ← reemplaza por la dirección exacta
    locality: "Ocucaje",
    region: "Ica",
    country: "PE",
    display: "Ocucaje, Ica, Perú",
  },

  /** Coordenadas aproximadas de Ocucaje — ajusta a la ubicación exacta del local */
  geo: {
    latitude: -14.3454,
    longitude: -75.6711,
  },

  googleMapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Pizzer%C3%ADa+Sabor+Llanero+Ocucaje+Ica",

  socials: [
    { name: "Instagram", url: "https://instagram.com/pizzeriasaborllanero" },
    { name: "Facebook", url: "https://facebook.com/pizzeriasaborllanero" },
    { name: "WhatsApp", url: "https://wa.me/51932770766" },
  ] satisfies SocialLink[],

  navLinks: [
    { label: "Inicio", href: "#inicio" },
    { label: "Nosotros", href: "#nosotros" },
    { label: "Galería", href: "#galeria" },
    { label: "Reseñas", href: "#resenas" },
    { label: "Ubicación", href: "#ubicacion" },
  ] satisfies NavLink[],

  /** Rutas de medios de marca */
  media: {
    logo: "/images/brand/logo.jpg",
    localVideo: "/videos/local.mp4",
    alborada: "/images/featured/pizza-alborada.jpg",
    tequenos: "/images/featured/tequenos.png",
  },

  /** ID del widget de Featurable (reseñas reales de Google) */
  featurableId: "featurable-c01d0c94-1a52-42ba-a5b6-558847cf2dac",
} as const;
