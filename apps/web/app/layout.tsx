import type { Metadata } from "next";
import { Bangers, Poppins } from "next/font/google";
import { businessHours } from "@/lib/businessHours";
import { siteConfig } from "@/lib/siteConfig";
import "./globals.css";

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bangers",
  display: "swap",
});

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.fullName} | Pizza Artesanal y Delivery en Pisco, Ica`,
    template: `%s | ${siteConfig.fullName}`,
  },
  description: siteConfig.description,
  keywords: [
    "pizzería Pisco",
    "pizza artesanal Pisco",
    "delivery pizza Pisco",
    "pizzería San Andrés Pisco",
    "pizza Ica",
    "Sabor Llanero",
    "pizza venezolana Perú",
    "tequeños Pisco",
    "restaurante Pisco",
    "pizza familiar Pisco",
  ],
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: siteConfig.url,
    siteName: siteConfig.fullName,
    title: `${siteConfig.fullName} | Pizza Artesanal y Delivery en Pisco, Ica`,
    description: siteConfig.description,
    images: [
      {
        url: "/images/featured/pizza-alborada.jpg",
        width: 960,
        height: 1280,
        alt: `Pizza artesanal de ${siteConfig.fullName}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.fullName} | Pizza Artesanal y Delivery en Pisco, Ica`,
    description: siteConfig.description,
    images: ["/images/featured/pizza-alborada.jpg"],
  },
  robots: { index: true, follow: true },
};

/** JSON-LD Schema.org tipo Restaurant para SEO local */
function buildRestaurantJsonLd(): string {
  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: siteConfig.fullName,
    description: siteConfig.description,
    url: siteConfig.url,
    telephone: siteConfig.phone,
    servesCuisine: ["Pizza", "Venezolana", "Peruana"],
    areaServed: ["Pisco", "San Andrés"],
    priceRange: "$$",
    image: `${siteConfig.url}/images/featured/pizza-alborada.jpg`,
    logo: `${siteConfig.url}${siteConfig.media.logo}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.street,
      addressLocality: siteConfig.address.locality,
      addressRegion: siteConfig.address.region,
      addressCountry: siteConfig.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: siteConfig.geo.latitude,
      longitude: siteConfig.geo.longitude,
    },
    openingHoursSpecification: businessHours
      .filter((d) => d.open && d.close)
      .map((d) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: dayNames[d.day],
        opens: d.open,
        closes: d.close,
      })),
    sameAs: siteConfig.socials.map((s) => s.url),
  });
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${bangers.variable} ${poppins.variable}`}>
      <body>
        {children}
        <script
          type="application/ld+json"
          // JSON-LD para Google: datos estructurados del restaurante
          dangerouslySetInnerHTML={{ __html: buildRestaurantJsonLd() }}
        />
      </body>
    </html>
  );
}
