import type { Metadata } from "next";
import ResetPasswordForm from "@/components/account/ResetPasswordForm";
import Footer from "@/components/sections/Footer";
import Navbar from "@/components/sections/Navbar";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Nueva Contraseña",
  description: `Elige una nueva contraseña para tu cuenta de ${siteConfig.fullName}.`,
  alternates: { canonical: "/cuenta/restablecer/" },
  // El link trae un token secreto en el fragment: nada de indexar ni de pasar el referrer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Destino del link del email de recuperación (export estático → out/cuenta/restablecer/index.html). */
export default function RestablecerPage() {
  return (
    <>
      <Navbar solid />
      <main className="flex min-h-dvh items-center justify-center bg-cream px-4 pt-[4.25rem] pb-16 md:pt-[4.75rem]">
        <div className="w-full max-w-sm rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-card md:p-8">
          <h1 className="font-display text-center text-3xl tracking-wide text-ink">Nueva contraseña</h1>
          <div className="mt-6">
            <ResetPasswordForm />
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
