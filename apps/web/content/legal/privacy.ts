import type { LegalSection } from "@/components/legal/LegalDocument";
import { siteConfig } from "@/lib/siteConfig";

export const privacyIntro = `En ${siteConfig.fullName} cuidamos tus datos personales. Esta política explica qué datos recogemos cuando usas el sitio ${siteConfig.url.replace("https://", "")} o creas una cuenta, para qué los usamos y qué derechos tienes, conforme a la Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento.`;

export const privacySections: LegalSection[] = [
  {
    id: "responsable",
    title: "Quién es el responsable",
    blocks: [
      `${siteConfig.fullName}, con domicilio en ${siteConfig.address.street}, ${siteConfig.address.display}, es quien decide cómo se tratan tus datos. Puedes contactarnos al ${siteConfig.phone} (llamada o WhatsApp).`,
    ],
  },
  {
    id: "datos-que-recogemos",
    title: "Qué datos recogemos",
    blocks: [
      [
        "Datos de tu cuenta: nombre y apellido, email, número de celular y contraseña. La contraseña se guarda cifrada (hash); nosotros no podemos verla.",
        "Datos de tus pedidos: qué pediste, el monto, el código del pedido, su estado y la fecha.",
        "Datos del programa de puntos: tu saldo, los puntos que sumas o gastas, los premios que canjeas y tus participaciones en sorteos.",
        "Aceptación de términos: la versión de los Términos y la Política que aceptaste y la fecha en que lo hiciste.",
        "Estadísticas anónimas de la carta: cuántas veces se pulsa el botón de pedir de cada producto. No se asocian a ti ni a tu cuenta.",
      ],
      "Si solo navegas la carta o armas un carrito sin crear una cuenta, no te pedimos datos personales. Si nos escribes por WhatsApp, recibimos tu número y lo que nos envíes, según las condiciones de WhatsApp.",
    ],
  },
  {
    id: "para-que-los-usamos",
    title: "Para qué usamos tus datos",
    blocks: [
      [
        "Crear y mantener tu cuenta y permitirte iniciar sesión.",
        "Gestionar tus pedidos: confirmarlos, coordinar la entrega y contactarte por ellos.",
        "Administrar tus puntos, premios y participaciones en sorteos, incluida la comunicación con los ganadores.",
        "Enviarte correos de servicio, como el de recuperación de contraseña.",
        "Atender tus consultas, quejas y reclamos.",
        "Mantener la seguridad del sitio y prevenir fraudes o abusos.",
        "Mejorar nuestra carta con estadísticas anónimas.",
      ],
      "No usamos tus datos para publicidad de terceros ni los vendemos. Si en el futuro quisiéramos enviarte promociones, te pediremos tu consentimiento por separado.",
    ],
  },
  {
    id: "base-legal",
    title: "Por qué podemos tratar tus datos",
    blocks: [
      "Los tratamos con tu consentimiento, que nos das al marcar la casilla de aceptación al crear tu cuenta (o, si ya tenías cuenta antes de que existiera esa casilla, al seguir usándola después de que te avisemos), y porque son necesarios para atender los pedidos y el programa de puntos que solicitas. Puedes retirar tu consentimiento pidiéndonos cerrar tu cuenta; esto no afecta lo tratado antes.",
    ],
  },
  {
    id: "con-quien-compartimos",
    title: "Con quién compartimos tus datos",
    blocks: [
      "No vendemos tus datos. Solo los compartimos con proveedores que nos prestan servicios técnicos y que los tratan por nuestra cuenta:",
      [
        "Cloudflare: alojamiento del sitio, de la base de datos y de las imágenes.",
        "Amazon Web Services: envío de los correos del sistema, como el de recuperación de contraseña.",
        "Featurable: widget que muestra las reseñas de Google en el sitio. Al cargarlo, recibe datos técnicos de tu visita, como tu dirección IP.",
        "Google (Google Maps y reseñas de Google) y Meta (WhatsApp, Instagram, Facebook): cuando usas sus funciones desde el sitio, ellos reciben los datos propios de ese servicio.",
      ],
      "También podemos entregar datos si una autoridad competente nos lo exige conforme a la ley.",
    ],
  },
  {
    id: "transferencia-internacional",
    title: "Transferencia fuera del Perú",
    blocks: [
      "Algunos de estos proveedores tienen sus servidores en otros países, por lo que tus datos pueden almacenarse o procesarse fuera del Perú. Elegimos proveedores con medidas de seguridad adecuadas y solo les encargamos lo necesario para prestar el servicio.",
    ],
  },
  {
    id: "cuanto-tiempo",
    title: "Cuánto tiempo los conservamos",
    blocks: [
      "Conservamos los datos de tu cuenta mientras la mantengas activa. Si pides cerrarla, eliminamos o anonimizamos tus datos personales (nombre, email y celular), salvo los que debamos conservar por obligaciones legales o para atender reclamos pendientes. Los datos de pedidos pueden conservarse el tiempo que exijan las normas contables y tributarias.",
    ],
  },
  {
    id: "tus-derechos",
    title: "Tus derechos",
    blocks: [
      "Puedes ejercer, de forma gratuita, tus derechos de información, acceso, rectificación, cancelación (eliminación), oposición y revocación del consentimiento:",
      [
        "Desde tu cuenta puedes ver y corregir tu nombre y celular, y cambiar tu contraseña.",
        `Para lo demás, escríbenos o llámanos al ${siteConfig.phone} indicando tu nombre y el email de tu cuenta. Podemos pedirte confirmar tu identidad antes de atender la solicitud.`,
      ],
      "Si crees que no atendimos bien tu solicitud, puedes presentar un reclamo ante la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia y Derechos Humanos.",
    ],
  },
  {
    id: "seguridad",
    title: "Cómo protegemos tus datos",
    blocks: [
      "Usamos conexión cifrada (HTTPS), guardamos las contraseñas con hash, separamos las cuentas de clientes de las del personal y limitamos el acceso a los datos al personal que los necesita. Ningún sistema es 100 % seguro, pero trabajamos para reducir los riesgos.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies y almacenamiento local",
    blocks: [
      "Nuestro sitio no usa cookies de publicidad ni de seguimiento propias. Para funcionar guarda en tu navegador (almacenamiento local):",
      [
        "Tu sesión, si iniciaste sesión (se borra al cerrar sesión).",
        "Tu carrito de compras.",
        "Tu preferencia de idioma.",
        "Si cerraste el recordatorio de premios (solo durante esa visita).",
      ],
      "Los servicios de terceros incrustados en el sitio, como el mapa de Google y el widget de reseñas, pueden usar sus propias cookies según sus políticas. Puedes borrar los datos del sitio desde la configuración de tu navegador; si lo haces, se cerrará tu sesión y se vaciará tu carrito.",
    ],
  },
  {
    id: "menores",
    title: "Menores de edad",
    blocks: [
      "El sitio no está dirigido a menores de 14 años y no recogemos sus datos a sabiendas. Si eres menor de 18, crea tu cuenta con la autorización de tus padres o tutores. Si detectamos una cuenta de un menor sin autorización, la eliminaremos.",
    ],
  },
  {
    id: "cambios",
    title: "Cambios a esta política",
    blocks: [
      "Podemos actualizar esta política. Publicaremos la versión nueva en esta página con su fecha de actualización, y si el cambio es importante te lo avisaremos en el sitio.",
    ],
  },
];
