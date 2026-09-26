import type { Metadata } from "next";
import Link from "next/link";
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
      {/* Barra fija con "Volver al menú", mismo patrón que /carrito: siempre
          visible sin importar el scroll, para volver a la carta sin abrir
          el menú hamburguesa ni depender del botón "Pedir ahora" del navbar. */}
      <div className="fixed inset-x-0 top-[4.25rem] z-40 border-b border-ink/10 bg-cream/95 backdrop-blur-sm md:top-[4.75rem]">
        <div className="mx-auto flex h-11 max-w-5xl items-center px-4 md:px-6">
          <Link
            href="/menu/"
            className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-brand-blue hover:text-brand-red"
          >
            ← Volver al menú
          </Link>
        </div>
      </div>
      <main className="min-h-dvh bg-cream pt-[7rem] md:pt-[7.5rem]">
        <PremiosPageContent />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
