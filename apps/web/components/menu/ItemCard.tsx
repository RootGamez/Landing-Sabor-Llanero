"use client";

import { useId, useState } from "react";
import {
  CATALOG_COPY,
  displayDescription,
  formatPrice,
  type Lang,
  type MenuItemWithPrices,
  type Size,
  type WhatsappConfig,
} from "@sabor/shared";
import { ChevronRightIcon, ExpandIcon, StarIcon } from "@/components/ui/icons";
import { accentStyle } from "@/lib/catalogAccent";
import { CATALOG_UI } from "@/lib/catalogUi";
import { priceSummary, type PriceSummary } from "@/lib/priceOptions";
import { useItemOrder } from "@/lib/useItemOrder";
import AddToCartButton from "@/components/menu/AddToCartButton";
import MenuImage from "@/components/menu/MenuImage";
import OrderButton from "@/components/menu/OrderButton";
import SizeSelector from "@/components/menu/SizeSelector";

interface ItemCardProps {
  item: MenuItemWithPrices;
  sizes: Size[];
  lang: Lang;
  whatsapp: WhatsappConfig;
  /** Abre el modal de detalle. Toda la card es zona de toque (stretched link). */
  onOpen: (item: MenuItemWithPrices) => void;
  /** sizes attr de la imagen (difiere entre grid y carrusel). */
  imageSizes?: string;
  /**
   * `true` en los rails de merchandising: card SIEMPRE vertical y compacta,
   * pensada para el carrusel horizontal. En el grid por categorías (`false`)
   * la card es una FILA horizontal en móvil y vuelve a card vertical desde
   * `sm`, para que quepan varios productos por pantalla.
   */
  compact?: boolean;
}

/**
 * Card de ítem del catálogo. El relieve 3D (`.card-3d`) toma su color del
 * tricolor de marca vía `accentStyle`, y toda la superficie abre el modal de
 * detalle: el botón del título se estira sobre la card con `::after`
 * (stretched link) en vez de envolverla.
 *
 * Layout del grid (no `compact`):
 * - Móvil: fila horizontal (miniatura + nombre + descripción + precio "desde").
 *   Elegir tamaño y pedir viven en el modal — un toque los abre con el primer
 *   tamaño preseleccionado (las presentaciones se eligen siempre a mano). Así entran 4-5 productos por pantalla.
 * - `sm`+: card vertical con foto grande, chips de tamaño y CTA de WhatsApp
 *   en la propia card.
 */
export default function ItemCard({
  item,
  sizes,
  lang,
  whatsapp,
  onOpen,
  imageSizes = "(max-width: 640px) 45vw, (max-width: 1024px) 45vw, 30vw",
  compact = false,
}: ItemCardProps) {
  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);
  const disabledHintId = useId();

  const copy = CATALOG_COPY[lang];
  const ui = CATALOG_UI[lang];
  const description = displayDescription(item, lang);
  const order = useItemOrder({ item, sizes, lang, whatsapp, selectedSizeId });
  const { name, hasOptions, needsChoice } = order;

  // Con opciones: "Desde S/ X" hasta elegir una, y el precio de la elegida después.
  const summary: PriceSummary | null = hasOptions
    ? priceSummary(item.prices, selectedSizeId)
    : item.price != null
      ? { mode: "single", amount: item.price }
      : null;

  // Card vertical siempre (rails); card responsiva (grid) es fila en móvil.
  const rootLayout = compact ? "flex-col" : "flex-row sm:flex-col";
  const imageFrame = compact
    ? "aspect-[4/3] w-full"
    : "h-full w-full sm:h-auto sm:aspect-[4/3]";
  const imageWrap = compact ? "relative overflow-hidden" : "relative w-28 shrink-0 sm:w-full";

  return (
    <article
      id={`item-${item.slug}`}
      style={accentStyle(item)}
      className={`card-3d group relative flex h-full overflow-hidden rounded-2xl bg-white ${rootLayout}`}
    >
      <div className={imageWrap}>
        <MenuImage
          coverImageKey={item.coverImageKey}
          alt={`${ui.photoOf} ${name}`}
          sizes={imageSizes}
          frameClassName={imageFrame}
        />

        {/* Affordance de "abrir detalle" al hover/focus (solo en card vertical). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden items-end justify-center bg-linear-to-t from-ink/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 sm:flex"
        >
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-ink shadow-md">
            <ExpandIcon className="h-3.5 w-3.5" />
            {ui.viewDetails}
          </span>
        </div>

        {item.isFeatured && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-brand-yellow px-2 py-1 text-[10px] font-bold tracking-wider text-ink uppercase shadow-md sm:top-3 sm:left-3 sm:px-3">
            <StarIcon className="h-3 w-3" />
            <span className="hidden sm:inline">{copy.featured}</span>
          </span>
        )}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col ${compact ? "p-4" : "p-3.5 sm:p-5"}`}>
        <div className="flex items-start justify-between gap-3">
          <h4
            className={`font-display leading-tight tracking-wide text-ink ${
              compact ? "text-xl" : "text-lg sm:text-2xl"
            }`}
          >
            <button
              type="button"
              onClick={() => onOpen(item)}
              aria-label={`${ui.viewDetails}: ${name}`}
              className="card-open-btn cursor-pointer text-left transition-colors duration-200 group-hover:text-brand-red"
            >
              {name}
            </button>
          </h4>
          {summary && (
            <p
              aria-live={hasOptions ? "polite" : undefined}
              aria-atomic="true"
              className={`shrink-0 text-right font-display text-xl text-brand-red tabular-nums ${
                compact ? "" : "hidden sm:block"
              }`}
            >
              {summary.mode === "from" && (
                <span className="block font-sans text-[11px] leading-none font-bold tracking-wider text-ink/70 uppercase">
                  {copy.from}
                </span>
              )}
              {formatPrice(summary.amount)}
            </p>
          )}
        </div>

        {description && (
          <p
            className={`mt-1 line-clamp-2 leading-relaxed text-ink/65 ${
              compact ? "text-sm" : "text-xs sm:mt-1.5 sm:text-sm"
            }`}
          >
            {description}
          </p>
        )}

        {/* Precio compacto solo en la fila de móvil del grid. */}
        {!compact && (
          <p className="mt-auto pt-2 font-display text-base text-brand-red tabular-nums sm:hidden">
            {summary
              ? `${summary.mode === "from" ? `${copy.from} ` : ""}${formatPrice(summary.amount)}`
              : ""}
          </p>
        )}

        {/* Chips de tamaño + CTA: en la card vertical (rails y grid desde sm). */}
        <div className={compact ? "" : "hidden sm:block"}>
          {hasOptions && (
            <SizeSelector
              prices={item.prices}
              sizes={sizes}
              lang={lang}
              selectedSizeId={selectedSizeId}
              onSelect={setSelectedSizeId}
              label={ui.optionLegend[order.optionKind]}
            />
          )}
        </div>

        <div
          className={`relative z-10 mt-auto items-start gap-2 pt-4 ${compact ? "flex" : "hidden sm:flex"}`}
        >
          <AddToCartButton
            onAdd={order.addToCart}
            disabled={!order.canAddToCart}
            compact={compact}
            label={`${ui.addToCart}: ${name}`}
            addedAnnouncement={`${name} — ${ui.addedToCart}`}
            ariaDescribedBy={needsChoice ? disabledHintId : undefined}
          />
          <div className="min-w-0 flex-1">
            <OrderButton
              href={order.orderHref}
              itemId={item.id}
              lang={lang}
              disabledHint={needsChoice ? order.chooseHint : undefined}
              compact={compact}
              hintId={disabledHintId}
              onConfirm={order.onQuickOrder}
              loading={order.submitting}
            />
            {order.error && (
              <p role="alert" className="mt-1.5 text-xs text-brand-red">
                {order.error}
              </p>
            )}
            {order.manualLink && (
              <p role="alert" className="mt-1.5 text-xs text-ink/70">
                Tu pedido ya se creó, pero el navegador bloqueó la pestaña de WhatsApp.{" "}
                <a
                  href={order.manualLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-blue hover:text-brand-red"
                >
                  Toca aquí para abrirla
                </a>
                .
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pista visual de "toca para ver" en la fila de móvil. */}
      {!compact && (
        <ChevronRightIcon
          className="mr-1 h-5 w-5 shrink-0 self-center text-ink/25 sm:hidden"
        />
      )}
    </article>
  );
}
