"use client";

import { useState } from "react";
import {
  CATALOG_COPY,
  displayDescription,
  displayName,
  formatPrice,
  type Lang,
  type MenuItemWithPrices,
  type Size,
  type WhatsappConfig,
} from "@sabor/shared";
import { ChevronRightIcon, ExpandIcon, StarIcon } from "@/components/ui/icons";
import { siteConfig } from "@/lib/siteConfig";
import { accentStyle } from "@/lib/catalogAccent";
import { CATALOG_UI, sizeLabelFor } from "@/lib/catalogUi";
import { buildItemOrderLink } from "@/lib/whatsapp";
// sizeLabelFor sigue usándose para el label del deep link de WhatsApp.
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
 *   tamaño preseleccionado. Así entran 4-5 productos por pantalla.
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

  const copy = CATALOG_COPY[lang];
  const ui = CATALOG_UI[lang];
  const name = displayName(item, lang);
  const description = displayDescription(item, lang);
  const hasSizes = item.prices.length > 0;
  const selectedPrice = hasSizes ? (item.prices.find((p) => p.sizeId === selectedSizeId) ?? null) : null;
  const fromPrice = hasSizes ? Math.min(...item.prices.map((p) => p.price)) : null;

  const itemUrl = `${siteConfig.url}/menu/#item-${item.slug}`;
  let orderHref: string | null = null;
  if (hasSizes && selectedPrice) {
    orderHref = buildItemOrderLink({
      config: whatsapp,
      lang,
      itemName: name,
      price: selectedPrice.price,
      sizeLabel: sizeLabelFor(selectedPrice, sizes, lang),
      itemUrl,
    });
  } else if (!hasSizes && item.price != null) {
    orderHref = buildItemOrderLink({
      config: whatsapp,
      lang,
      itemName: name,
      price: item.price,
      sizeLabel: null,
      itemUrl,
    });
  }

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
          {!hasSizes && item.price != null && (
            <p
              className={`shrink-0 font-display text-xl text-brand-red tabular-nums ${
                compact ? "" : "hidden sm:block"
              }`}
            >
              {formatPrice(item.price)}
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
            {hasSizes && fromPrice != null
              ? `${copy.from} ${formatPrice(fromPrice)}`
              : item.price != null
                ? formatPrice(item.price)
                : ""}
          </p>
        )}

        {/* Chips de tamaño + CTA: en la card vertical (rails y grid desde sm). */}
        <div className={compact ? "" : "hidden sm:block"}>
          {hasSizes && (
            <SizeSelector
              prices={item.prices}
              sizes={sizes}
              lang={lang}
              selectedSizeId={selectedSizeId}
              onSelect={setSelectedSizeId}
              label={copy.sizes}
            />
          )}
        </div>

        <div
          className={`relative z-10 mt-auto pt-4 ${compact ? "" : "hidden sm:block"}`}
        >
          <OrderButton
            href={orderHref}
            itemId={item.id}
            lang={lang}
            disabledHint={hasSizes && !selectedPrice ? ui.chooseSize : undefined}
            compact={compact}
          />
        </div>
      </div>

      {/* Pista visual de "tocá para ver" en la fila de móvil. */}
      {!compact && (
        <ChevronRightIcon
          className="mr-1 h-5 w-5 shrink-0 self-center text-ink/25 sm:hidden"
        />
      )}
    </article>
  );
}
