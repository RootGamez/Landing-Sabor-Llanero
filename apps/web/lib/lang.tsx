"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Lang } from "@sabor/shared";

/**
 * Idioma del CATÁLOGO (BLUEPRINT §4.3 y §7.3): el toggle ES/EN solo afecta la
 * sección de menú; el resto de la landing queda en español tal cual. Se
 * persiste en localStorage y el default es español.
 *
 * Nota de hidratación: el sitio es export estático, así que el HTML servido
 * siempre viene en español. El idioma guardado se aplica recién en un
 * useEffect (post-hidratación) para no provocar mismatch servidor/cliente.
 */
const STORAGE_KEY = "sabor-llanero-menu-lang";
const DEFAULT_LANG: Lang = "es";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue | null>(null);

function readStoredLang(): Lang | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "es" || stored === "en" ? stored : null;
  } catch {
    return null; // localStorage bloqueado (modo privado estricto): usar default
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const stored = readStoredLang();
    if (stored) setLangState(stored);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sin persistencia disponible: el toggle igual funciona en la sesión
    }
  }, []);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang debe usarse dentro de <LangProvider>");
  return ctx;
}
