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
import { ExpandIcon, StarIcon } from "@/components/ui/icons";
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
  compact?: boolean;
}

/**
 * Card de ítem del catálogo. El relieve 3D (`.card-3d`) toma su color del
 * tricolor de marca vía `accentStyle`, y toda la superficie abre el modal de
 * detalle: el botón del título se estira sobre la card con `::after`
 * (stretched link) en vez de envolverla, para no anidar los chips de tamaño y
 * el CTA de WhatsApp dentro de otro botón — esos quedan encima con z-index.
 *
 * Ítems con precio por tamaño muestran chips seleccionables y exigen elegir
 * antes de pedir; ítems de precio propio muestran un solo precio y piden
 * directo.
 */
export default function ItemCard({
  item,
  sizes,
  lang,
  whatsapp,
  onOpen,
  imageSizes = "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw",
  compact = false,
}: ItemCardProps) {
  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);

  const copy = CATALOG_COPY[lang];
  const ui = CATALOG_UI[lang];
  const name = displayName(item, lang);
  const description = displayDescription(item, lang);
  const hasSizes = item.prices.length > 0;
  const selectedPrice = hasSizes ? (item.prices.find((p) => p.sizeId === selectedSizeId) ?? null) : null;

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

  return (
    <article
      id={`item-${item.slug}`}
      style={accentStyle(item)}
      className="card-3d group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white"
    >
      <div className="relative overflow-hidden">
        <MenuImage coverImageKey={item.coverImageKey} alt={`${ui.photoOf} ${name}`} sizes={imageSizes} />

        {/* Affordance de "abrir detalle": aparece al hover y al enfocar con
            teclado. aria-hidden porque el botón del título ya expone la misma
            acción ("Ver detalles: {nombre}") — anunciarla dos veces confunde. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-end justify-center bg-linear-to-t from-ink/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-ink shadow-md">
            <ExpandIcon className="h-3.5 w-3.5" />
            {ui.viewDetails}
          </span>
        </div>

        {item.isFeatured && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-brand-yellow px-3 py-1 text-[10px] font-bold tracking-wider text-ink uppercase shadow-md">
            <StarIcon className="h-3 w-3" />
            {copy.featured}
          </span>
        )}
      </div>

      <div className={`flex flex-1 flex-col ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-start justify-between gap-3">
          <h4 className={`font-display tracking-wide text-ink ${compact ? "text-xl" : "text-2xl"}`}>
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
            <p className="shrink-0 font-display text-xl text-brand-red tabular-nums">
              {formatPrice(item.price)}
            </p>
          )}
        </div>

        {description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink/65">{description}</p>
        )}

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

        <div className="relative z-10 mt-auto pt-4">
          <OrderButton
            href={orderHref}
            itemId={item.id}
            lang={lang}
            disabledHint={hasSizes && !selectedPrice ? ui.chooseSize : undefined}
            compact={compact}
          />
        </div>
      </div>
    </article>
  );
}
