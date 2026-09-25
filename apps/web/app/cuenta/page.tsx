import type { Metadata } from "next";
import AccountPageContent from "@/components/account/AccountPageContent";
import Footer from "@/components/sections/Footer";
import Navbar from "@/components/sections/Navbar";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Mi Cuenta",
  description: `Tu saldo de puntos, historial de pedidos y premios canjeables en ${siteConfig.fullName}.`,
  alternates: { canonical: "/cuenta/" },
  robots: { index: false, follow: true },
};

/** Perfil de cliente (P2.8, export estático → out/cuenta/index.html). Requiere sesión (guardia en AccountPageContent). */
export default function CuentaPage() {
  return (
    <>
      <Navbar solid />
      <main className="min-h-dvh bg-cream pt-[4.25rem] md:pt-[4.75rem]">
        <AccountPageContent />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
