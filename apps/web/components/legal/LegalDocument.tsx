import Link from "next/link";
import { LEGAL_VERSION } from "@sabor/shared";
import Footer from "@/components/sections/Footer";
import Navbar from "@/components/sections/Navbar";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";

/** Un bloque es un párrafo (string) o una lista con viñetas (string[]). */
export type LegalBlock = string | string[];

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

interface LegalDocumentProps {
  title: string;
  intro: string;
  sections: LegalSection[];
}

/** "2026-10-02" → "2 de octubre de 2026". Se fija la hora al mediodía: `new Date("AAAA-MM-DD")` es medianoche UTC y en Perú (UTC-5) mostraría el día anterior. */
function formatLegalDate(version: string): string {
  return new Date(`${version}T12:00:00`).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Layout compartido de /terminos y /privacidad: título, fecha de vigencia
 * (LEGAL_VERSION), índice anclado y secciones numeradas. Server component:
 * el contenido es texto estático que entra en el export.
 */
export default function LegalDocument({ title, intro, sections }: LegalDocumentProps) {
  return (
    <>
      <Navbar solid />
      <main className="min-h-dvh bg-cream px-4 pt-[6.5rem] pb-20 md:pt-[7.5rem]">
        <article className="mx-auto max-w-3xl rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-card md:p-10">
          <h1 className="font-display text-4xl tracking-wide text-ink md:text-5xl">{title}</h1>
          <p className="mt-2 text-sm text-ink/60">Última actualización: {formatLegalDate(LEGAL_VERSION)}</p>
          <p className="mt-6 text-base leading-relaxed text-ink/80">{intro}</p>

          <nav aria-label="Contenido del documento" className="mt-8 rounded-2xl bg-cream p-5">
            <p className="text-sm font-semibold text-ink">Contenido</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-brand-blue hover:text-brand-red">
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="font-display text-2xl tracking-wide text-ink">
                  {index + 1}. {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-base leading-relaxed text-ink/80">
                  {section.blocks.map((block, blockIndex) =>
                    typeof block === "string" ? (
                      <p key={blockIndex}>{block}</p>
                    ) : (
                      <ul key={blockIndex} className="list-disc space-y-1.5 pl-6">
                        {block.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-12 border-t border-ink/10 pt-6 text-sm">
            <Link href="/" className="font-semibold text-brand-blue hover:text-brand-red">
              ← Volver al inicio
            </Link>
          </p>
        </article>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
