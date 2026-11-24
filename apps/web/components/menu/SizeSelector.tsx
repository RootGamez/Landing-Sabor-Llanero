"use client";

import { useRef } from "react";
import { formatPrice, type Lang, type ResolvedPrice, type Size } from "@sabor/shared";
import { optionDetailFor, optionLabelFor } from "@/lib/priceOptions";

interface SizeSelectorProps {
  prices: ResolvedPrice[];
  sizes: Size[];
  lang: Lang;
  selectedSizeId: number | null;
  onSelect: (sizeId: number) => void;
  /** Texto del <legend>: "Tamaño" / "Presentación" según el tipo de opciones. */
  label: string;
  /** `card` = chips compactos; `modal` = chips grandes que reparten el ancho. */
  variant?: "card" | "modal";
}

/**
 * Selector de tamaño o presentación (Media docena, 1 docena…) compartido por
 * la card y el modal, implementado como el
 * radiogroup del patrón WAI-ARIA de verdad:
 *
 * - Un solo tab stop (roving tabindex): entra al grupo el radio seleccionado
 *   o, si no hay ninguno, el primero. Los demás llevan tabIndex -1.
 * - Las flechas mueven foco Y selección; Home/End van a los extremos.
 * - No se puede deseleccionar: un radio, una vez elegido, no vuelve a vacío.
 *
 * Antes cada chip era un `role="radio"` independiente dentro del orden de
 * tabulación y sin flechas: se anunciaba como grupo de radios pero se
 * comportaba como una fila de botones sueltos (incumple 4.1.2).
 */
export default function SizeSelector({
  prices,
  sizes,
  lang,
  selectedSizeId,
  onSelect,
  label,
  variant = "card",
}: SizeSelectorProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = prices.findIndex((price) => price.sizeId === selectedSizeId);
  // Sin selección, el tab stop es el primer radio (WAI-ARIA radiogroup).
  const tabStopIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const moveTo = (index: number): void => {
    const target = prices[index];
    if (!target) return;
    onSelect(target.sizeId);
    buttonsRef.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const last = prices.length - 1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveTo(index === last ? 0 : index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveTo(index === 0 ? last : index - 1);
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(last);
        break;
      default:
        break;
    }
  };

  const isModal = variant === "modal";

  return (
    // z-10 en la card: los chips deben quedar POR ENCIMA del ::after del
    // stretched link, o tocar un tamaño abriría el modal en vez de elegirlo.
    <fieldset className={isModal ? undefined : "relative z-10 mt-3"}>
      <legend
        className={isModal ? "text-xs font-bold tracking-[0.18em] text-ink/70 uppercase" : "sr-only"}
      >
        {label}
      </legend>
      <div
        role="radiogroup"
        aria-label={label}
        className={`gap-2 ${isModal ? "mt-3" : ""} ${
          // 4 presentaciones: cuadrícula 2x2 (en fila se parten en 3+1 con labels cortados).
          isModal && prices.length >= 4 ? "grid grid-cols-2" : "flex flex-wrap"
        }`}
      >
        {prices.map((price, index) => {
          const active = price.sizeId === selectedSizeId;
          const detail = optionDetailFor(price, sizes, lang);
          return (
            <button
              key={price.sizeId}
              ref={(node) => {
                buttonsRef.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={index === tabStopIndex ? 0 : -1}
              onClick={() => onSelect(price.sizeId)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`cursor-pointer border text-left transition-all duration-200 ${
                isModal
                  ? "min-h-12 flex-1 rounded-xl border-2 px-4 py-2"
                  : "min-h-11 rounded-xl px-3 py-1.5"
              } ${
                active
                  ? "border-brand-red bg-brand-red/5 shadow-sm"
                  : "border-ink/10 bg-white hover:border-brand-red/40"
              }`}
            >
              <span
                className={`block text-xs font-semibold ${active ? "text-brand-red" : "text-ink/70"}`}
              >
                {optionLabelFor(price, sizes, lang)}
              </span>
              {detail && (
                <span className="block text-[11px] leading-tight text-ink/70">{detail}</span>
              )}
              <span
                className={`block font-bold tabular-nums ${isModal ? "text-base" : "text-sm"} ${
                  active ? "text-brand-red" : "text-ink"
                }`}
              >
                {formatPrice(price.price)}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
