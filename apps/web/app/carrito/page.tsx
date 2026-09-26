import type { Metadata } from "next";
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
      <main className="pt-[4.25rem] md:pt-[4.75rem]">
        <CartPageContent />
      </main>
      <Footer />
      <FloatingWhatsApp />
      <RewardsReminderBubble />
    </>
  );
}
