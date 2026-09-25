import type { Metadata } from "next";
import LoginForm from "@/components/account/LoginForm";
import Footer from "@/components/sections/Footer";
import Navbar from "@/components/sections/Navbar";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Iniciar Sesión",
  description: `Iniciá sesión en tu cuenta de ${siteConfig.fullName} para ver tus puntos y canjear premios.`,
  alternates: { canonical: "/cuenta/login/" },
  robots: { index: false, follow: true },
};

/** Ruta de login de cliente (P2.8, export estático → out/cuenta/login/index.html). */
export default function LoginPage() {
  return (
    <>
      <Navbar solid />
      <main className="flex min-h-dvh items-center justify-center bg-cream px-4 pt-[4.25rem] pb-16 md:pt-[4.75rem]">
        <div className="w-full max-w-sm rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-card md:p-8">
          <h1 className="font-display text-center text-3xl tracking-wide text-ink">Iniciar sesión</h1>
          <p className="mt-1 text-center text-sm text-ink/60">Accedé a tus puntos y premios.</p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
