"use client";

import type { Lang } from "@sabor/shared";
import { GlobeIcon } from "@/components/ui/icons";
import { CATALOG_UI } from "@/lib/catalogUi";
import { useLang } from "@/lib/lang";

const OPTIONS: Array<{ value: Lang; label: string }> = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

/**
 * Selector de idioma del catálogo: pill grande y explícita (nunca "ES"/"EN")
 * pensada para vivir en la esquina del nuevo Hero del menú, sobre el fondo
 * oscuro tricolor — de ahí el estilo "glass" en vez del blanco de antes.
 * Solo cambia el idioma de la sección de menú (decisión §7.3, ver lib/lang).
 */
export default function LangToggle() {
  const { lang, setLang } = useLang();
  const ui = CATALOG_UI[lang];

  return (
    <div
      role="group"
      aria-label={ui.langToggle}
      className="inline-flex gap-1 rounded-full border border-white/15 bg-white/10 p-1.5 shadow-[0_10px_30px_-6px_rgba(0,0,0,0.45)] backdrop-blur-md"
    >
      {OPTIONS.map((option) => {
        const active = option.value === lang;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(option.value)}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-bold transition-all duration-200 sm:px-5 sm:text-[15px] ${
              active ? "bg-brand-yellow text-ink" : "text-white/85 hover:bg-white/10"
            }`}
          >
            <GlobeIcon className="h-4 w-4 shrink-0" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
