"use client";

import type { Lang } from "@sabor/shared";
import { CATALOG_UI } from "@/lib/catalogUi";
import { useLang } from "@/lib/lang";

const OPTIONS: Array<{ value: Lang; label: string }> = [
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
];

/**
 * Toggle ES/EN del catálogo (BLUEPRINT §4.3): pill segmentada consistente
 * con los badges de la landing. Solo cambia el idioma de la sección de menú;
 * el resto de la landing queda en español (decisión §7.3).
 */
export default function LangToggle() {
  const { lang, setLang } = useLang();
  const ui = CATALOG_UI[lang];

  return (
    <div
      role="group"
      aria-label={ui.langToggle}
      className="inline-flex rounded-full border border-ink/10 bg-white p-1 shadow-card"
    >
      {OPTIONS.map((option) => {
        const active = option.value === lang;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(option.value)}
            className={`min-h-9 cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
              active ? "bg-brand-blue text-white shadow-sm" : "text-ink/60 hover:text-brand-blue"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
