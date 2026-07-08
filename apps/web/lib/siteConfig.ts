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
    "Pizzería artesanal familiar en Pisco, Ica. Fusión de sabores de Venezuela y Perú: masa artesanal, ingredientes frescos y delivery a todo Pisco y San Andrés. Promociones todos los días.",

  /** URL pública del sitio */
  url: "https://saborllanero.online",

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
    street: "Urb. La Alborada Mz. D Lt. 22",
    locality: "Pisco",
    region: "Ica",
    country: "PE",
    display: "Pisco, Ica, Perú",
  },

  /** Coordenadas del local (pin de la ficha de Google) */
  geo: {
    latitude: -13.7064761,
    longitude: -76.2135703,
  },

  /** Botón "Cómo llegar": abre la ficha real del negocio en Google Maps (CID) */
  googleMapsUrl: "https://maps.google.com/?cid=8331271402479403448",

  /** Mapa embebido — SOLO la URL del src del iframe oficial de tu ficha de Google */
  googleMapsEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3876.1976473100926!2d-76.2135703!3d-13.7064761!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91106fa6a9c72deb%3A0x739e9f331827c1b8!2sPizzeria%20-%20Sabor%20llanero!5e0!3m2!1sen!2spe!4v1781191403496!5m2!1sen!2spe",

  /** Zona de reparto y promociones */
  delivery: {
    areas: "Todo Pisco y San Andrés",
    note: "Promociones todos los días",
  },

  /** Tamaños disponibles — ajusta porciones y medidas a tu carta real */
  pizzaSizes: [
    { name: "Mediana", detail: "8 porciones · 30 cm", scale: 0.58, featured: false },
    { name: "Grande", detail: "10 porciones · 35 cm", scale: 0.78, featured: false },
    { name: "Familiar", detail: "12 porciones · 40 cm", scale: 1, featured: true },
  ],

  /** Gancho de variedad (del flyer: "Más de 15 sabores para elegir") */
  flavorsClaim: "Más de 20 sabores para elegir",

  socials: [
    { name: "Instagram", url: "https://www.instagram.com/saborllanero_pisco/" },
    { name: "Facebook", url: "https://www.facebook.com/profile.php?id=61551465756868" },
    { name: "WhatsApp", url: "https://wa.me/51932770766" },
  ] satisfies SocialLink[],

  // Hrefs absolutos: desde la landing siguen haciendo scroll al anchor;
  // desde /menu navegan de vuelta a la home. "Menú" va a su ruta dedicada.
  navLinks: [
    { label: "Inicio", href: "/#inicio" },
    { label: "Nosotros", href: "/#nosotros" },
    { label: "Menú", href: "/menu/" },
    { label: "Galería", href: "/#galeria" },
    { label: "Reseñas", href: "/#resenas" },
    { label: "Ubicación", href: "/#ubicacion" },
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
