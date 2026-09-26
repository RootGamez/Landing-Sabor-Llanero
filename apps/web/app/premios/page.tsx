import type { Metadata } from "next";
import Footer from "@/components/sections/Footer";
import Navbar from "@/components/sections/Navbar";
import PremiosPageContent from "@/components/rewards/PremiosPageContent";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Premios",
  description: `Canjeá tus puntos por premios reales en ${siteConfig.fullName}: catálogo completo, precios con descuento y tu saldo de puntos.`,
  alternates: { canonical: "/premios/" },
};

/**
 * Catálogo público de premios (P2.9, export estático → out/premios/index.html).
 * A diferencia de /cuenta, es público: sin guardia de sesión ni
 * `robots.index: false` — sirve también como vitrina para invitados
 * (guardia real y estado logueado/invitado viven en PremiosPageContent).
 */
export default function PremiosPage() {
  return (
    <>
      <Navbar solid />
      <main className="min-h-dvh bg-cream pt-[4.25rem] md:pt-[4.75rem]">
        <PremiosPageContent />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
