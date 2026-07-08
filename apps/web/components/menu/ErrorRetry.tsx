"use client";

import type { Lang } from "@sabor/shared";
import { CATALOG_UI } from "@/lib/catalogUi";

interface ErrorRetryProps {
  lang: Lang;
  onRetry: () => void;
}

/**
 * Estado de error amigable del catálogo: mensaje claro + acción de
 * reintento. No filtra detalles técnicos del error (los mensajes de la API
 * ya vienen saneados, pero al usuario final solo le sirve "reintentar").
 */
export default function ErrorRetry({ lang, onRetry }: ErrorRetryProps) {
  const ui = CATALOG_UI[lang];
  return (
    <div
      role="alert"
      className="mx-auto max-w-md rounded-2xl border border-ink/8 bg-white p-8 text-center shadow-card"
    >
      <p className="font-display text-2xl tracking-wide text-ink">{ui.errorTitle}</p>
      <p className="mt-2 text-sm text-ink/65">{ui.errorHint}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-brand-blue-deep active:scale-95"
      >
        {ui.retry}
      </button>
    </div>
  );
}
