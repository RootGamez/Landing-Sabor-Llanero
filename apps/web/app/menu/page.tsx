import type { Metadata } from "next";
import Footer from "@/components/sections/Footer";
import Menu from "@/components/sections/Menu";
import Navbar from "@/components/sections/Navbar";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";
import { siteConfig } from "@/lib/siteConfig";

const PAGE_DESCRIPTION =
  "Carta completa de Pizzería Sabor Llanero en Pisco: pizzas artesanales, tequeños venezolanos y promos del día. Pide por WhatsApp con delivery a Pisco y San Andrés.";

// El layout raíz aplica el template `%s | Pizzería Sabor Llanero`.
export const metadata: Metadata = {
  title: "Carta y Menú con Precios",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/menu/" },
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: `${siteConfig.url}/menu/`,
    siteName: siteConfig.fullName,
    title: `Carta y Menú con Precios | ${siteConfig.fullName}`,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: "/images/featured/pizza-alborada.jpg",
        width: 960,
        height: 1280,
        alt: `Pizza artesanal de ${siteConfig.fullName}`,
      },
    ],
  },
  // Sin esto heredaría el twitter card genérico de la home (merge por campo)
  twitter: {
    card: "summary_large_image",
    title: `Carta y Menú con Precios | ${siteConfig.fullName}`,
    description: PAGE_DESCRIPTION,
    images: ["/images/featured/pizza-alborada.jpg"],
  },
};

/** JSON-LD BreadcrumbList: Inicio → Menú (página interior) */
function buildBreadcrumbJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Menú", item: `${siteConfig.url}/menu/` },
    ],
  });
}

/**
 * Ruta dedicada de la carta (export estático → out/menu/index.html).
 * El navbar arranca sólido porque aquí el fondo es crema, no el hero
 * oscuro de la landing.
 */
export default function MenuPage() {
  return (
    <>
      <Navbar solid />
      {/* Compensa la altura del navbar fijo (h-16 / 4.5rem + barra tricolor) */}
      <main className="pt-[4.25rem] md:pt-[4.75rem]">
        {/* H1 único de la página; el visible "Nuestra Carta" queda como h2
            para no saltar niveles (los bloques del catálogo usan h3) */}
        <h1 className="sr-only">Carta y menú de {siteConfig.fullName}</h1>
        <Menu />
      </main>
      <Footer />
      <FloatingWhatsApp />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildBreadcrumbJsonLd() }}
      />
    </>
  );
}
