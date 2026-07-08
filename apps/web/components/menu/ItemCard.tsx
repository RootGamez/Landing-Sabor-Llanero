"use client";

import { useState } from "react";
import {
  CATALOG_COPY,
  displayDescription,
  displayName,
  displaySizeLabel,
  formatPrice,
  type Lang,
  type MenuItemWithPrices,
  type ResolvedPrice,
  type Size,
  type WhatsappConfig,
} from "@sabor/shared";
import { StarIcon } from "@/components/ui/icons";
import { siteConfig } from "@/lib/siteConfig";
import { CATALOG_UI, SIZE_KEY_FALLBACK } from "@/lib/catalogUi";
import { buildItemOrderLink } from "@/lib/whatsapp";
import MenuImage from "@/components/menu/MenuImage";
import OrderButton from "@/components/menu/OrderButton";

interface ItemCardProps {
  item: MenuItemWithPrices;
  sizes: Size[];
  lang: Lang;
  whatsapp: WhatsappConfig;
  /** sizes attr de la imagen (difiere entre grid y carrusel). */
  imageSizes?: string;
  compact?: boolean;
}

function sizeLabelFor(price: ResolvedPrice, sizes: Size[], lang: Lang): string {
  const size = sizes.find((s) => s.id === price.sizeId);
  if (size) return displaySizeLabel(size, lang);
  // Fallback si /sizes no cargó: primero el diccionario bilingüe de keys
  // conocidos ('mediana' → 'Medium' en inglés); si el key no está mapeado,
  // se capitaliza el key crudo como último recurso.
  const known = SIZE_KEY_FALLBACK[lang][price.sizeKey];
  if (known) return known;
  return price.sizeKey.charAt(0).toUpperCase() + price.sizeKey.slice(1);
}

/**
 * Card de ítem del catálogo, con la anatomía de las cards existentes de la
 * landing (Features/Gallery): rounded-2xl, shadow-card → shadow-card-hover,
 * -translate-y al hover. Ítems con precio por tamaño muestran chips
 * seleccionables (Mediana/Grande/Familiar) y exigen elegir antes de pedir;
 * ítems de precio propio muestran un solo precio y piden directo.
 */
export default function ItemCard({
  item,
  sizes,
  lang,
  whatsapp,
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

  const itemUrl = `${siteConfig.url}/#item-${item.slug}`;
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
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
    >
      <div className="relative">
        <MenuImage coverImageKey={item.coverImageKey} alt={`${ui.photoOf} ${name}`} sizes={imageSizes} />
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
            {name}
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
          <fieldset className="mt-3">
            <legend className="sr-only">{copy.sizes}</legend>
            {/* role=radiogroup: la selección de tamaño es excluyente, no un
                grupo de toggles independientes (aria-pressed no aplicaba). */}
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={copy.sizes}>
              {item.prices.map((price) => {
                const active = price.sizeId === selectedSizeId;
                return (
                  <button
                    key={price.sizeId}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelectedSizeId(active ? null : price.sizeId)}
                    className={`min-h-11 cursor-pointer rounded-xl border px-3 py-1.5 text-left transition-all duration-200 ${
                      active
                        ? "border-brand-red bg-brand-red/5 shadow-sm"
                        : "border-ink/10 bg-white hover:border-brand-red/40"
                    }`}
                  >
                    <span className={`block text-xs font-semibold ${active ? "text-brand-red" : "text-ink/70"}`}>
                      {sizeLabelFor(price, sizes, lang)}
                    </span>
                    <span className={`block text-sm font-bold tabular-nums ${active ? "text-brand-red" : "text-ink"}`}>
                      {formatPrice(price.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="mt-auto pt-4">
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
