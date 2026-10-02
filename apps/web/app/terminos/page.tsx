import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { termsIntro, termsSections } from "@/content/legal/terms";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: `Términos y condiciones de uso del sitio, los pedidos y el programa de puntos de ${siteConfig.fullName}.`,
  alternates: { canonical: "/terminos/" },
};

/** Ruta pública (export estático → out/terminos/index.html). El texto vive en content/legal/terms.ts. */
export default function TerminosPage() {
  return <LegalDocument title="Términos y Condiciones" intro={termsIntro} sections={termsSections} />;
}
