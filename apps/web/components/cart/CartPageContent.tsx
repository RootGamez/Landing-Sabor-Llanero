"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatPrice, type OrderDto } from "@sabor/shared";
import { CartIcon, WhatsAppIcon } from "@/components/ui/icons";
import CartLineRow from "@/components/cart/CartLineRow";
import { ApiError, api } from "@/lib/api";
import { useCart, type CartLine } from "@/lib/cart";
import { useCustomerAuth } from "@/lib/customerAuth";
import { trackOrderClick } from "@/lib/events";
import { fetchWhatsappConfig } from "@/lib/menuData";
import { siteConfig } from "@/lib/siteConfig";
import { useAsync } from "@/lib/useAsync";
import { buildCartOrderLink, FALLBACK_WHATSAPP_CONFIG } from "@/lib/whatsapp";

/**
 * Vista del carrito: invitado (P2.7) o logueado (P2.8). Sin sesión, confirmar
 * solo arma el wa.me y no toca D1 — igual que antes. Con sesión, primero crea
 * el pedido real (`POST /orders`, queda `pending`) y su código entra en el
 * mensaje de WhatsApp; el dueño lo confirma desde el CMS (P2.5) y ahí recién
 * se acreditan los puntos (se reflejan al volver a /cuenta).
 */
export default function CartPageContent() {
  const { lines, updateQuantity, removeLine, clear, subtotal } = useCart();
  const { customer } = useCustomerAuth();
  const whatsappState = useAsync(fetchWhatsappConfig);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const manualLinkRef = useRef<HTMLAnchorElement>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // El pedido ya se creó y el carrito ya se vació para cuando esto puede
  // aparecer (ver `confirmLoggedIn`) — es la única forma que le queda al
  // cliente de llegar a WhatsApp, así que el foco debe ir ahí solo, no
  // quedarse en el botón "Confirmar" que disparó el intento fallido.
  useEffect(() => {
    if (manualLink) manualLinkRef.current?.focus();
  }, [manualLink]);

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
  // estático — confirmar nunca queda roto.
  const phoneNumber = (whatsappState.data ?? FALLBACK_WHATSAPP_CONFIG).phoneNumber;
  const buildLink = (orderCode?: string): string =>
    buildCartOrderLink({
      phoneNumber,
      lines: lines.map((line) => ({
        name: line.name,
        sizeLabel: line.sizeLabel,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      subtotal,
      cartUrl: `${siteConfig.url}/carrito/`,
      orderCode,
    });

  /** Invitado: arma el link y abre — sin red de por medio, cero riesgo de bloqueo de pop-up. */
  const confirmAsGuest = (): void => {
    lines.forEach((line) => trackOrderClick(line.itemId));
    window.open(buildLink(), "_blank", "noopener,noreferrer");
    clear();
  };

  /**
   * Logueado: crea el pedido real ANTES de abrir WhatsApp. `tab` ya se abrió
   * en blanco dentro del gesto síncrono del click (ver `handleConfirmClick`)
   * — recién acá, tras el `await`, se le asigna la URL final. Abrir la
   * pestaña DESPUÉS de este `await` sería bloqueado por Safari/Firefox al
   * perder el gesto de usuario original.
   *
   * El `try/catch` cubre SOLO la creación del pedido — a propósito, no la
   * navegación posterior. Si el pedido ya se creó en D1 y solo falla abrir/
   * redirigir la pestaña (ej. el cliente la cerró a mano mientras esperaba),
   * eso NO es un fallo de "no se pudo crear el pedido": mostrar ese mensaje y
   * dejar el carrito intacto invitaría a reintentar y crear un pedido real
   * duplicado. En ese caso se limpia igual el carrito y se ofrece el link a mano.
   */
  const confirmLoggedIn = async (tab: Window | null): Promise<void> => {
    setSubmitting(true);
    setCheckoutError(null);
    setManualLink(null);

    let order: OrderDto | undefined;
    try {
      order = await api.post<OrderDto>("/orders", {
        items: lines.map((line) => ({
          itemId: line.itemId,
          sizeId: line.sizeId ?? undefined,
          quantity: line.quantity,
        })),
      });
      if (!order) throw new ApiError(500, "Respuesta inesperada del servidor");
    } catch (err) {
      tab?.close();
      if (mountedRef.current) {
        setCheckoutError(err instanceof ApiError ? err.message : "No se pudo crear el pedido. Intentá de nuevo.");
        setSubmitting(false);
      }
      return;
    }

    // El pedido ya existe: de acá en más nunca se vuelve a mostrar "no se
    // pudo crear el pedido" ni se deja el carrito con las mismas líneas.
    const href = buildLink(order.code);
    lines.forEach((line) => trackOrderClick(line.itemId));
    clear();

    let opened = false;
    if (tab) {
      try {
        // `tab` no pudo abrirse con "noopener" (esa flag hace que window.open
        // devuelva null, y acá se necesita la referencia para setear la URL
        // recién cuando el pedido ya existe) — se compensa cortando `opener`
        // a mano antes de navegar. El destino es siempre wa.me, nunca una URL
        // que dependa de esta pestaña, así que no hay superficie de tabnabbing real.
        tab.opener = null;
        tab.location.href = href;
        opened = true;
      } catch {
        // El usuario pudo haber cerrado la pestaña en blanco mientras se
        // esperaba la respuesta — se sigue al fallback de abajo.
      }
    }
    if (!opened) {
      opened = Boolean(window.open(href, "_blank", "noopener,noreferrer"));
    }

    if (mountedRef.current) {
      if (!opened) setManualLink(href);
      setSubmitting(false);
    }
  };

  const handleConfirmClick = (): void => {
    if (!customer) {
      confirmAsGuest();
      return;
    }
    const tab = window.open("", "_blank");
    void confirmLoggedIn(tab);
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

      {manualLink && (
        // Fuera del if de abajo a propósito: para cuando esto aparece, `clear()`
        // ya vació `lines` y de otro modo quedaría atrapado dentro de la rama
        // que ya no se renderiza (se muestra <EmptyCart /> en su lugar).
        <p role="alert" className="mt-4 text-sm text-ink/70">
          Tu pedido ya se creó, pero el navegador bloqueó la pestaña de WhatsApp.{" "}
          <a
            ref={manualLinkRef}
            href={manualLink}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-blue hover:text-brand-red"
          >
            Tocá acá para abrirla
          </a>
          .
        </p>
      )}

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

            {customer ? (
              <p className="mt-1 text-xs text-ink/60">
                Vas a confirmar como <span className="font-semibold text-ink">{customer.name}</span>: se crea tu
                pedido y sumás puntos cuando el local lo confirme.
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink/60">
                El pago y la entrega se coordinan por WhatsApp al confirmar.{" "}
                <Link href="/cuenta/login/" className="font-semibold text-brand-blue hover:text-brand-red">
                  Iniciá sesión
                </Link>{" "}
                para sumar puntos con este pedido.
              </p>
            )}

            {checkoutError && (
              <p role="alert" className="mt-2 text-sm text-brand-red">
                {checkoutError}
              </p>
            )}

            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={submitting}
              aria-busy={submitting}
              className="btn-shine mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:bg-brand-red-deep active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
            >
              <WhatsAppIcon className="h-4 w-4" />
              {submitting ? "Creando pedido…" : "Confirmar pedido por WhatsApp"}
            </button>
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
