import type { LegalSection } from "@/components/legal/LegalDocument";
import { siteConfig } from "@/lib/siteConfig";

export const termsIntro = `Estos Términos y Condiciones regulan el uso del sitio ${siteConfig.url.replace("https://", "")} y de la cuenta de cliente de ${siteConfig.fullName} ("nosotros"). Al crear una cuenta o usar el sitio, aceptas estos términos. Si no estás de acuerdo, no crees una cuenta; igual puedes escribirnos por WhatsApp para hacer tu pedido.`;

export const termsSections: LegalSection[] = [
  {
    id: "quienes-somos",
    title: "Quiénes somos",
    blocks: [
      `${siteConfig.fullName} es una pizzería artesanal ubicada en ${siteConfig.address.street}, ${siteConfig.address.display}. Atendemos en el local y con delivery. Zona de reparto: ${siteConfig.delivery.areas}.`,
      `Para consultas, pedidos o reclamos puedes escribirnos o llamarnos al ${siteConfig.phone} (también por WhatsApp).`,
    ],
  },
  {
    id: "que-ofrece-el-sitio",
    title: "Qué ofrece el sitio",
    blocks: [
      "El sitio te permite:",
      [
        "Ver nuestra carta, precios y promociones.",
        "Armar un carrito y enviarnos tu pedido por WhatsApp.",
        "Crear una cuenta para guardar tu historial de pedidos, acumular puntos y canjear premios.",
      ],
      "El sitio no procesa pagos en línea: el pago y la entrega se coordinan por WhatsApp al confirmar el pedido.",
    ],
  },
  {
    id: "tu-cuenta",
    title: "Tu cuenta de cliente",
    blocks: [
      "Para crear una cuenta debes:",
      [
        "Ser mayor de 18 años, o tener la autorización de tus padres o tutores.",
        "Darnos datos reales y mantenerlos actualizados (nombre, email y celular).",
        "Tener una sola cuenta personal; no puedes crearla con los datos de otra persona.",
      ],
      "Eres responsable de la confidencialidad de tu contraseña y de lo que se haga con tu cuenta. Si crees que alguien más la usa, cambia tu contraseña o avísanos de inmediato.",
      "Podemos suspender o cerrar cuentas con datos falsos, uso fraudulento o que incumplan estos términos.",
    ],
  },
  {
    id: "pedidos-y-precios",
    title: "Pedidos, precios y pagos",
    blocks: [
      [
        "Los precios se muestran en soles (S/) y pueden cambiar sin previo aviso. Se aplica el precio vigente al momento de confirmar tu pedido.",
        "Enviar un pedido desde el sitio es una solicitud: el pedido queda confirmado cuando nosotros lo confirmamos contigo por WhatsApp.",
        "Los productos están sujetos a disponibilidad. Si algo no está disponible, te lo diremos y podrás elegir un cambio o cancelar esa parte del pedido.",
        "El costo de delivery, el medio de pago y el tiempo estimado de entrega se coordinan por WhatsApp; los tiempos son referenciales.",
        "Las fotos de la carta son referenciales y el producto puede variar ligeramente.",
        "Para modificar o cancelar un pedido, escríbenos cuanto antes; si ya está en preparación, puede que no sea posible.",
      ],
      "Si tienes alguna alergia o restricción alimentaria, avísanos antes de pedir. Nuestros productos se preparan en una cocina donde se manejan varios ingredientes.",
    ],
  },
  {
    id: "puntos-y-premios",
    title: "Programa de puntos, premios y sorteos",
    blocks: [
      [
        "Los puntos se suman cuando confirmamos un pedido hecho con tu cuenta, según la regla vigente (por ejemplo, puntos por cada sol gastado y un monto mínimo de pedido). Esa regla puede verse en el sitio y puede cambiar.",
        "Los pedidos que se hacen canjeando premios no suman puntos ni participaciones en sorteos.",
        "Los puntos no son dinero, no se pueden cambiar por efectivo ni transferir a otra persona.",
        "Puedes canjear tus puntos por los premios disponibles en la página de Premios. Los premios dependen de su disponibilidad y el canje descuenta los puntos de tu saldo.",
        "Los pedidos confirmados pueden dar participaciones en sorteos que anunciaremos en el sitio o en nuestras redes. Las condiciones de cada sorteo se publicarán junto con su anuncio.",
        "Podemos corregir saldos por errores y anular puntos, canjes o participaciones obtenidos de forma fraudulenta.",
        "Podemos modificar o terminar el programa de puntos, avisando en el sitio. Intentaremos darte un plazo razonable para canjear los puntos acumulados.",
      ],
    ],
  },
  {
    id: "uso-aceptable",
    title: "Uso aceptable",
    blocks: [
      "No puedes usar el sitio para:",
      [
        "Intentar acceder a cuentas o datos de otras personas, o a las partes internas del sistema.",
        "Hacer pedidos falsos, abusar de los puntos o premios, o automatizar el uso del sitio.",
        "Interferir con el funcionamiento del sitio o enviar contenido dañino.",
      ],
    ],
  },
  {
    id: "propiedad-intelectual",
    title: "Propiedad intelectual",
    blocks: [
      `El nombre, el logo, las fotos, los textos y el diseño del sitio pertenecen a ${siteConfig.fullName} o se usan con autorización. No puedes copiarlos ni usarlos con fines comerciales sin nuestro permiso por escrito.`,
    ],
  },
  {
    id: "terceros",
    title: "Servicios y enlaces de terceros",
    blocks: [
      "El sitio usa o enlaza servicios de terceros, como WhatsApp, Google Maps, las reseñas de Google, Instagram y Facebook. Cada uno se rige por sus propios términos y políticas, y no controlamos su contenido ni su disponibilidad.",
    ],
  },
  {
    id: "responsabilidad",
    title: "Disponibilidad y responsabilidad",
    blocks: [
      "Hacemos lo posible para que el sitio funcione sin interrupciones, pero no garantizamos que esté siempre disponible ni libre de errores. Podemos suspenderlo por mantenimiento.",
      "En la medida permitida por la ley, no respondemos por daños indirectos derivados del uso del sitio. Esto no limita los derechos que te reconoce la ley como consumidor.",
    ],
  },
  {
    id: "reclamos",
    title: "Quejas y reclamos",
    blocks: [
      `Si tienes una queja o reclamo sobre un pedido, un producto o el sitio, escríbenos o llámanos al ${siteConfig.phone} y lo atenderemos lo antes posible. Esto no afecta tus derechos conforme al Código de Protección y Defensa del Consumidor (Ley N.° 29571).`,
    ],
  },
  {
    id: "datos-personales",
    title: "Datos personales",
    blocks: [
      "Tratamos tus datos personales como se explica en nuestra Política de Privacidad, que forma parte de estos términos.",
    ],
  },
  {
    id: "cambios",
    title: "Cambios a estos términos",
    blocks: [
      "Podemos actualizar estos términos. Publicaremos la versión nueva en esta página con su fecha de actualización. Si sigues usando tu cuenta después del cambio, entendemos que lo aceptas; si no estás de acuerdo, puedes pedirnos cerrar tu cuenta.",
    ],
  },
  {
    id: "ley-aplicable",
    title: "Ley aplicable",
    blocks: [
      `Estos términos se rigen por las leyes de la República del Perú. Cualquier controversia se someterá a los jueces y tribunales de ${siteConfig.address.locality}, ${siteConfig.address.region}, sin perjuicio de los derechos que la ley te reconozca como consumidor.`,
    ],
  },
];
