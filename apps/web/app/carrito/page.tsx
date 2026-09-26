import type { Metadata } from "next";
import Link from "next/link";
import CartPageContent from "@/components/cart/CartPageContent";
import Footer from "@/components/sections/Footer";
import Navbar from "@/components/sections/Navbar";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";
import RewardsReminderBubble from "@/components/ui/RewardsReminderBubble";
import { siteConfig } from "@/lib/siteConfig";

// Contenido transitorio por visitante (localStorage): no aporta valor de
// búsqueda y no debe indexarse, a diferencia de /menu.
export const metadata: Metadata = {
  title: "Tu Carrito",
  description: `Revisa tu pedido antes de confirmarlo por WhatsApp con ${siteConfig.fullName}.`,
  alternates: { canonical: "/carrito/" },
  robots: { index: false, follow: true },
};

/**
 * Ruta del carrito de invitado (P2.7, export estático → out/carrito/index.html).
 * Mismo chrome que /menu (Navbar sólido + Footer + FloatingWhatsApp); todo el
 * estado real vive client-side en `CartPageContent` (Context + localStorage).
 */
export default function CarritoPage() {
  return (
    <>
      <Navbar solid />
      {/* Barra fija con "Volver a la carta" — siempre visible sin importar el
          scroll, para no depender del link que ya existe al final de la
          página (ver CartPageContent), útil recién cuando el carrito tiene
          varias líneas y hay que bajar para encontrarlo. */}
      <div className="fixed inset-x-0 top-[4.25rem] z-40 border-b border-ink/10 bg-cream/95 backdrop-blur-sm md:top-[4.75rem]">
        <div className="mx-auto flex h-11 max-w-2xl items-center px-4 md:px-6">
          <Link
            href="/menu/"
            className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-brand-blue hover:text-brand-red"
          >
            ← Volver a la carta
          </Link>
        </div>
      </div>
      <main className="pt-[7rem] md:pt-[7.5rem]">
        <CartPageContent />
      </main>
      <Footer />
      <FloatingWhatsApp />
      <RewardsReminderBubble />
    </>
  );
}
