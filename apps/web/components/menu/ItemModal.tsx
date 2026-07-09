"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
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
import { CloseIcon, PizzaSliceIcon, StarIcon } from "@/components/ui/icons";
import OrderButton from "@/components/menu/OrderButton";
import SizeSelector from "@/components/menu/SizeSelector";
import { mediaUrl } from "@/lib/api";
import { accentStyle } from "@/lib/catalogAccent";
import { CATALOG_UI, sizeLabelFor } from "@/lib/catalogUi";
import { parseIngredients } from "@/lib/catalogText";
import { siteConfig } from "@/lib/siteConfig";
import { buildItemOrderLink } from "@/lib/whatsapp";

interface ItemModalProps {
  item: MenuItemWithPrices;
  sizes: Size[];
  lang: Lang;
  whatsapp: WhatsappConfig;
  onClose: () => void;
}

/** Selector del atrapa-foco: lo tabulable dentro del panel. */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Detalle de un ítem del catálogo: foto grande a un lado, descripción legible
 * (ingredientes en chips cuando el texto lo permite) y el botón de WhatsApp
 * al costado. Se monta solo cuando hay un ítem activo, así que el estado del
 * tamaño elegido se reinicia solo entre productos.
 *
 * A diferencia de la card, acá el primer tamaño viene PRESELECCIONADO: en la
 * vista de detalle el usuario ya eligió el producto y pedir debe ser un solo
 * toque. El chip activo y el precio grande dejan claro qué se está pidiendo.
 *
 * Accesibilidad: `role="dialog"` + `aria-modal`, foco inicial en cerrar, Tab
 * atrapado dentro del panel, Escape y clic en el backdrop cierran, y el foco
 * vuelve a la card que lo abrió al desmontar.
 */
export default function ItemModal({ item, sizes, lang, whatsapp, onClose }: ItemModalProps) {
  const copy = CATALOG_COPY[lang];
  const ui = CATALOG_UI[lang];
  const name = displayName(item, lang);
  const description = displayDescription(item, lang);
  const ingredients = description ? parseIngredients(description) : null;
  const hasSizes = item.prices.length > 0;

  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(
    () => item.prices[0]?.sizeId ?? null,
  );
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  /**
   * Oculta el resto de la página del árbol de accesibilidad mientras el modal
   * está abierto. El atrapa-foco solo intercepta Tab; un usuario de VoiceOver
   * o TalkBack navegando por swipe llegaría igual al buscador y a las cards de
   * atrás, contradiciendo el `aria-modal="true"` que declara el panel.
   */
  useEffect(() => {
    if (!mounted) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const siblings = Array.from(document.body.children).filter((el) => el !== overlay);
    // Se guarda el valor previo: algún hermano podría venir ya oculto.
    const previous = siblings.map((el) => el.getAttribute("aria-hidden"));
    siblings.forEach((el) => el.setAttribute("aria-hidden", "true"));

    return () => {
      siblings.forEach((el, index) => {
        const before = previous[index];
        if (before === null || before === undefined) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", before);
      });
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const selectedPrice = hasSizes
    ? (item.prices.find((price) => price.sizeId === selectedSizeId) ?? null)
    : null;
  const displayedPrice = hasSizes ? selectedPrice?.price : item.price;

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

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6"
    >
      {/* Backdrop como <button> (y no un div con onClick) para que el clic
          fuera sea un control real. Queda fuera del árbol de accesibilidad y
          del orden de tabulación: el botón X visible ya expone "Cerrar", y
          duplicarlo haría que un lector anunciase dos cierres seguidos. */}
      <button
        type="button"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
        className="animate-overlay-in absolute inset-0 h-full w-full cursor-default bg-ink/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`item-modal-title-${item.id}`}
        style={accentStyle(item)}
        className="animate-modal-in relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-y-auto rounded-t-3xl border-2 border-[var(--accent)] bg-white shadow-2xl sm:rounded-3xl"
      >
        {/* Franja tricolor: firma de marca, también arriba del modal */}
        <div className="flex h-1.5 shrink-0" aria-hidden="true">
          <span className="flex-1 bg-brand-yellow" />
          <span className="flex-1 bg-brand-blue" />
          <span className="flex-1 bg-brand-red" />
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={ui.close}
          className="absolute top-5 right-4 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur-sm transition-colors duration-200 hover:bg-brand-red hover:text-white"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <div className="grid md:grid-cols-2">
          {/* Foto */}
          <div className="relative aspect-[4/3] w-full bg-cream-deep md:aspect-auto md:min-h-[26rem]">
            {item.coverImageKey ? (
              <Image
                src={mediaUrl(item.coverImageKey)}
                alt={`${ui.photoOf} ${name}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
                <PizzaSliceIcon className="h-20 w-20 text-brand-blue/20" />
              </div>
            )}
            {item.isFeatured && (
              <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-3 py-1.5 text-[11px] font-bold tracking-wider text-ink uppercase shadow-md">
                <StarIcon className="h-3.5 w-3.5" />
                {copy.featured}
              </span>
            )}
          </div>

          {/* Descripción, tamaños y CTA */}
          <div className="flex flex-col gap-5 p-6 md:p-8">
            <div>
              <h2
                id={`item-modal-title-${item.id}`}
                className="font-display pr-12 text-3xl leading-tight tracking-wide text-ink md:text-4xl"
              >
                {name}
              </h2>
              {displayedPrice != null && (
                <p className="font-display mt-2 text-3xl text-brand-red tabular-nums">
                  {formatPrice(displayedPrice)}
                </p>
              )}
            </div>

            {ingredients ? (
              <div>
                <h3 className="text-xs font-bold tracking-[0.18em] text-ink/70 uppercase">
                  {ui.ingredients}
                </h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {ingredients.map((ingredient) => (
                    <li
                      key={ingredient}
                      className="rounded-full bg-brand-blue/6 px-3 py-1.5 text-sm font-medium text-ink/75"
                    >
                      {ingredient}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              description && <p className="text-base leading-relaxed text-ink/70">{description}</p>
            )}

            {hasSizes && (
              <SizeSelector
                prices={item.prices}
                sizes={sizes}
                lang={lang}
                selectedSizeId={selectedSizeId}
                onSelect={setSelectedSizeId}
                label={copy.sizes}
                variant="modal"
              />
            )}

            <div className="mt-auto pt-1">
              <OrderButton
                href={orderHref}
                itemId={item.id}
                lang={lang}
                disabledHint={hasSizes && !selectedPrice ? ui.chooseSize : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
