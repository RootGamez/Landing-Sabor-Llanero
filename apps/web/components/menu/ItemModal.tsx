"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  CATALOG_COPY,
  displayDescription,
  formatPrice,
  type Lang,
  type MenuItemWithPrices,
  type Size,
  type WhatsappConfig,
} from "@sabor/shared";
import { CloseIcon, PizzaSliceIcon, StarIcon } from "@/components/ui/icons";
import AddToCartButton from "@/components/menu/AddToCartButton";
import OrderButton from "@/components/menu/OrderButton";
import SizeSelector from "@/components/menu/SizeSelector";
import { mediaUrl } from "@/lib/api";
import { accentStyle } from "@/lib/catalogAccent";
import { CATALOG_UI } from "@/lib/catalogUi";
import { parseIngredients } from "@/lib/catalogText";
import { optionKindOf, priceSummary } from "@/lib/priceOptions";
import { useItemOrder } from "@/lib/useItemOrder";

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
 * A diferencia de la card, aquí el primer tamaño viene PRESELECCIONADO: en la
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
  const description = displayDescription(item, lang);
  const ingredients = description ? parseIngredients(description) : null;
  // Dos ids distintos: el CTA se renderiza dos veces (barra fija de móvil +
  // inline de escritorio, una de cada par siempre oculta por CSS), y el hint
  // de "elige un tamaño" no puede compartir `id` entre ambas copias.
  const disabledHintIdDesktop = useId();
  const disabledHintIdMobile = useId();

  // Tamaños: el primero viene preseleccionado (pedir en un toque). Presentaciones
  // (Media docena, 1 docena…): sin preselección, para no pedir una cantidad que
  // el cliente no eligió; el CTA queda bloqueado hasta que escoja una.
  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(() =>
    optionKindOf(item.prices) === "portion" ? null : (item.prices[0]?.sizeId ?? null),
  );
  const order = useItemOrder({ item, sizes, lang, whatsapp, selectedSizeId });
  const { name, hasOptions, needsChoice } = order;
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

  const summary = hasOptions
    ? priceSummary(item.prices, selectedSizeId)
    : item.price != null
      ? { mode: "single" as const, amount: item.price }
      : null;

  /**
   * Botones de acción compartidos entre la barra fija de móvil (siempre
   * visible, fuera del área con scroll) y la ubicación inline de escritorio
   * (al pie de la columna de texto). Una sola función evita que el CTA de
   * WhatsApp — el más importante de la pantalla — se desincronice entre
   * ambos layouts; recibe el `hintId` de cada copia para no duplicar el
   * `id` del hint "elegí un tamaño" en el DOM.
   */
  const renderCta = (hintId: string) => (
    <>
      <AddToCartButton
        onAdd={order.addToCart}
        disabled={!order.canAddToCart}
        label={`${ui.addToCart}: ${name}`}
        addedAnnouncement={`${name} — ${ui.addedToCart}`}
        ariaDescribedBy={needsChoice ? hintId : undefined}
      />
      <div className="min-w-0 flex-1">
        <OrderButton
          href={order.orderHref}
          itemId={item.id}
          lang={lang}
          disabledHint={needsChoice ? order.chooseHint : undefined}
          hintId={hintId}
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
    </>
  );

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
        className="animate-modal-in relative flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border-2 border-[var(--accent)] bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-3xl"
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

        {/* Único contenedor con scroll: la foto y el texto pueden crecer y
            desplazarse aquí sin arrastrar consigo el CTA de abajo. */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid md:grid-cols-2">
            {/* Foto. En móvil la mayoría de las fotos son verticales (3:4, 9:16):
                con `object-cover` se recortaban muchísimo. Aquí se muestran
                completas con `object-contain` sobre un fondo desenfocado de la
                misma foto, así se ve el producto entero sin franjas vacías. En
                desktop el panel es alto y `object-cover` llena la mitad sin
                recortar de más. */}
            <div className="relative aspect-[4/5] max-h-[46dvh] w-full overflow-hidden bg-cream-deep md:aspect-auto md:max-h-none md:min-h-[28rem]">
              {item.coverImageKey ? (
                <>
                  <Image
                    src={mediaUrl(item.coverImageKey)}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="scale-110 object-cover opacity-35 blur-2xl md:hidden"
                  />
                  <Image
                    src={mediaUrl(item.coverImageKey)}
                    alt={`${ui.photoOf} ${name}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain md:object-cover"
                  />
                </>
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  aria-hidden="true"
                >
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
                {summary && (
                  <p
                    aria-live="polite"
                    aria-atomic="true"
                    className="font-display mt-2 text-3xl text-brand-red tabular-nums"
                  >
                    {summary.mode === "from" && (
                      <span className="mr-2 font-sans text-sm font-bold tracking-wider text-ink/70 uppercase">
                        {copy.from}
                      </span>
                    )}
                    {formatPrice(summary.amount)}
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
                description && (
                  <p className="text-base leading-relaxed text-ink/70">{description}</p>
                )
              )}

              {hasOptions && (
                <SizeSelector
                  prices={item.prices}
                  sizes={sizes}
                  lang={lang}
                  selectedSizeId={selectedSizeId}
                  onSelect={setSelectedSizeId}
                  label={ui.optionLegend[order.optionKind]}
                  variant="modal"
                />
              )}

              {/* En escritorio el CTA vive al pie de esta columna; en móvil se
                  oculta aquí porque una barra fija (fuera del área con scroll,
                  más abajo) lo mantiene siempre visible sin importar cuánto
                  haya que desplazar la descripción. */}
              <div className="mt-auto hidden items-start gap-2 pt-1 sm:flex">
                {renderCta(disabledHintIdDesktop)}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de acción fija en móvil: queda siempre visible aunque la
            descripción/ingredientes sean largos, así "Pedir por WhatsApp"
            nunca se pierde por falta de scroll. */}
        <div className="shrink-0 border-t border-ink/10 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
          <div className="flex items-start gap-2">{renderCta(disabledHintIdMobile)}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
