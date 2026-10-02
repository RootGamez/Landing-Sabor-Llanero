import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { privacyIntro, privacySections } from "@/content/legal/privacy";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: `Cómo ${siteConfig.fullName} recoge, usa y protege tus datos personales, y cómo ejercer tus derechos.`,
  alternates: { canonical: "/privacidad/" },
};

/** Ruta pública (export estático → out/privacidad/index.html). El texto vive en content/legal/privacy.ts. */
export default function PrivacidadPage() {
  return <LegalDocument title="Política de Privacidad" intro={privacyIntro} sections={privacySections} />;
}
