"use client";

import { CATALOG_COPY, type Lang } from "@sabor/shared";
import { WhatsAppIcon } from "@/components/ui/icons";
import { trackOrderClick } from "@/lib/events";

interface OrderButtonProps {
  /** Deep link wa.me ya armado, o null si aún no se puede pedir (falta elegir tamaño). */
  href: string | null;
  itemId: number;
  lang: Lang;
  /** Hint accesible mostrado cuando el botón está deshabilitado. */
  disabledHint?: string;
  /** Tratamiento visual: primario rojo (default) o compacto para cards de rail. */
  compact?: boolean;
}

/**
 * "Pedir por WhatsApp" por ítem (patrón OrderButton de Jaw, BLUEPRINT §2.6):
 * registra el evento order_click (fire-and-forget) y abre wa.me en otra
 * pestaña. Es un <a> real — no window.open — para no pelear con bloqueadores
 * de pop-ups; deshabilitado se degrada a <button disabled> con hint visible.
 */
export default function OrderButton({ href, itemId, lang, disabledHint, compact = false }: OrderButtonProps) {
  const copy = CATALOG_COPY[lang];
  const baseClasses = `inline-flex w-full items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 ${
    compact ? "px-4 py-2.5 text-sm" : "px-5 py-3 text-sm md:text-base"
  }`;

  if (!href) {
    return (
      <div>
        <button type="button" disabled className={`${baseClasses} cursor-not-allowed bg-ink/10 text-ink/40`}>
          <WhatsAppIcon className="h-4 w-4" />
          {copy.orderOnWhatsapp}
        </button>
        {disabledHint && (
          <p className="mt-1.5 text-center text-xs text-ink/50" role="status">
            {disabledHint}
          </p>
        )}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackOrderClick(itemId)}
      className={`${baseClasses} btn-shine bg-brand-red text-white shadow-md hover:scale-[1.03] hover:bg-brand-red-deep active:scale-95`}
    >
      <WhatsAppIcon className="h-4 w-4" />
      {copy.orderOnWhatsapp}
    </a>
  );
}
