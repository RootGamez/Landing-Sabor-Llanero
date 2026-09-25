"use client";

import { useRef } from "react";
import Link from "next/link";
import { formatPrice } from "@sabor/shared";
import { CartIcon, WhatsAppIcon } from "@/components/ui/icons";
import CartLineRow from "@/components/cart/CartLineRow";
import { useCart, type CartLine } from "@/lib/cart";
import { trackOrderClick } from "@/lib/events";
import { fetchWhatsappConfig } from "@/lib/menuData";
import { siteConfig } from "@/lib/siteConfig";
import { useAsync } from "@/lib/useAsync";
import { buildCartOrderLink, FALLBACK_WHATSAPP_CONFIG } from "@/lib/whatsapp";

/**
 * Vista del carrito de invitado (P2.7): nada toca D1 acá, solo localStorage
 * vía `useCart` — confirmar arma un único wa.me con todas las líneas y limpia
 * el carrito (mismo criterio de "carrito se vacía al pasar a checkout" de
 * cualquier e-commerce; no hay pedido real que rastrear todavía, eso es P2.8
 * con cuenta de cliente).
 */
export default function CartPageContent() {
  const { lines, updateQuantity, removeLine, clear, subtotal } = useCart();
  const whatsappState = useAsync(fetchWhatsappConfig);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const focusHeading = (): void => headingRef.current?.focus();

  const handleIncrement = (line: CartLine): void => updateQuantity(line.key, line.quantity + 1);
  const handleDecrement = (line: CartLine): void => {
    if (line.quantity <= 1) focusHeading();
    updateQuantity(line.key, line.quantity - 1);
  };
  const handleRemove = (line: CartLine): void => {
    focusHeading();
    removeLine(line.key);
  };

  // GET /whatsapp es público y trae el número real editado por el dueño
  // (mismo criterio que ItemCard/ItemModal); si falla, cae al fallback
  // estático — el botón de confirmar nunca queda roto.
  const phoneNumber = (whatsappState.data ?? FALLBACK_WHATSAPP_CONFIG).phoneNumber;
  const orderHref = buildCartOrderLink({
    phoneNumber,
    lines: lines.map((line) => ({
      name: line.name,
      sizeLabel: line.sizeLabel,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    subtotal,
    cartUrl: `${siteConfig.url}/carrito/`,
  });

  const handleConfirmClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    // preventDefault + window.open con el href ya cerrado en esta variable:
    // si se dejara navegar al <a> de forma nativa, el order en que el
    // navegador lee el atributo `href` del DOM vs. el commit de `clear()`
    // (que dispara un re-render con `lines: []`) no es un contrato
    // garantizado — más vale no depender de ese timing implícito.
    event.preventDefault();
    const href = orderHref;
    lines.forEach((line) => trackOrderClick(line.itemId));
    window.open(href, "_blank", "noopener,noreferrer");
    clear();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-6 md:py-14">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display rounded-sm text-3xl tracking-wide text-ink outline-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand-blue md:text-4xl"
      >
        Tu carrito
      </h1>

      {lines.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <ul className="mt-8 space-y-3">
            {lines.map((line) => (
              <CartLineRow
                key={line.key}
                line={line}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onRemove={handleRemove}
              />
            ))}
          </ul>

          <div className="mt-8 rounded-2xl border-2 border-ink/10 bg-white p-5">
            <div className="flex items-center justify-between" role="status">
              <span className="font-display text-lg text-ink">Subtotal</span>
              <span className="font-display text-2xl text-brand-red tabular-nums">{formatPrice(subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-ink/60">El pago y la entrega se coordinan por WhatsApp al confirmar.</p>

            <a
              href={orderHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleConfirmClick}
              className="btn-shine mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:bg-brand-red-deep active:scale-95 md:text-base"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Confirmar pedido por WhatsApp
            </a>
          </div>

          <Link
            href="/menu/"
            className="mt-6 inline-block min-h-11 py-2 text-sm font-medium text-brand-blue hover:text-brand-red"
          >
            ← Seguir viendo la carta
          </Link>
        </>
      )}
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mt-10 rounded-3xl border-2 border-dashed border-ink/10 bg-white/60 px-6 py-16 text-center backdrop-blur-sm">
      <span
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue/8 text-brand-blue"
        aria-hidden="true"
      >
        <CartIcon className="h-7 w-7" />
      </span>
      <h2 className="font-display text-2xl tracking-wide text-ink">Tu carrito está vacío</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">
        Agrega productos desde la carta para armar tu pedido.
      </p>
      <Link
        href="/menu/"
        className="btn-shine mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-brand-red px-6 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-[1.03] hover:bg-brand-red-deep active:scale-95"
      >
        Ver la carta
      </Link>
    </div>
  );
}
