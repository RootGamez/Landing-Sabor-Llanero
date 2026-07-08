/**
 * Punto único de configuración de marca (BLUEPRINT §5), migrado de
 * `apps/web/lib/siteConfig.ts`. NO se borra `siteConfig.ts` todavía — la web
 * se integra con `packages/shared` recién en la fase 5 del refactor; hasta
 * entonces ambos archivos coexisten con los mismos datos.
 */
export const BRAND = {
  name: 'Sabor Llanero',
  fullName: 'Pizzería Sabor Llanero',
  slogan: 'Pizza artesanal con sabor de dos tierras',
  description:
    'Pizzería artesanal familiar en Pisco, Ica. Fusión de sabores de Venezuela y Perú: masa artesanal, ingredientes frescos y delivery a todo Pisco y San Andrés. Promociones todos los días.',

  /** URL pública del sitio. */
  url: 'https://saborllanero.online',

  phone: '+51 932 770 766',
  phoneHref: 'tel:+51932770766',

  whatsapp: {
    number: '51932770766',
    defaultMessage: '¡Hola! 👋 Quisiera hacer un pedido en Pizzería Sabor Llanero.',
  },

  address: {
    street: 'Urb. La Alborada Mz. D Lt. 22',
    locality: 'Pisco',
    region: 'Ica',
    country: 'PE',
    display: 'Pisco, Ica, Perú',
  },

  /** Coordenadas del local (pin de la ficha de Google). */
  geo: {
    latitude: -13.7064761,
    longitude: -76.2135703,
  },

  /** Zona de reparto y promociones. */
  delivery: {
    areas: 'Todo Pisco y San Andrés',
    note: 'Promociones todos los días',
  },

  socials: [
    { name: 'Instagram', url: 'https://www.instagram.com/saborllanero_pisco/' },
    { name: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61551465756868' },
    { name: 'WhatsApp', url: 'https://wa.me/51932770766' },
  ],
} as const;

export type Brand = typeof BRAND;
