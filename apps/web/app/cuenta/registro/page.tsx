import type { Metadata } from "next";
import RegisterForm from "@/components/account/RegisterForm";
import Footer from "@/components/sections/Footer";
import Navbar from "@/components/sections/Navbar";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Crear Cuenta",
  description: `Creá tu cuenta en ${siteConfig.fullName} y empezá a sumar puntos con cada pedido.`,
  alternates: { canonical: "/cuenta/registro/" },
  robots: { index: false, follow: true },
};

/** Ruta de alta de cliente (P2.8, export estático → out/cuenta/registro/index.html). */
export default function RegistroPage() {
  return (
    <>
      <Navbar solid />
      <main className="flex min-h-dvh items-center justify-center bg-cream px-4 pt-[4.25rem] pb-16 md:pt-[4.75rem]">
        <div className="w-full max-w-sm rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-card md:p-8">
          <h1 className="font-display text-center text-3xl tracking-wide text-ink">Crear cuenta</h1>
          <p className="mt-1 text-center text-sm text-ink/60">Sumá puntos con cada pedido confirmado.</p>
          <div className="mt-6">
            <RegisterForm />
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
