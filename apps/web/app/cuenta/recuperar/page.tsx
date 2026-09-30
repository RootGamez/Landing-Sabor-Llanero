import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/account/ForgotPasswordForm";
import Footer from "@/components/sections/Footer";
import Navbar from "@/components/sections/Navbar";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Recuperar Contraseña",
  description: `Recupera el acceso a tu cuenta de ${siteConfig.fullName}.`,
  alternates: { canonical: "/cuenta/recuperar/" },
  robots: { index: false, follow: true },
};

/** Ruta de "olvidé mi contraseña" de cliente (export estático → out/cuenta/recuperar/index.html). */
export default function RecuperarPage() {
  return (
    <>
      <Navbar solid />
      <main className="flex min-h-dvh items-center justify-center bg-cream px-4 pt-[4.25rem] pb-16 md:pt-[4.75rem]">
        <div className="w-full max-w-sm rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-card md:p-8">
          <h1 className="font-display text-center text-3xl tracking-wide text-ink">Recuperar contraseña</h1>
          <p className="mt-1 text-center text-sm text-ink/60">
            Ingresa tu email y te enviamos un link para crear una nueva.
          </p>
          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
