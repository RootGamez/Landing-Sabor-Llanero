"use client";

import Link from "next/link";
import { CartIcon } from "@/components/ui/icons";
import { useCart } from "@/lib/cart";

/**
 * Burbuja flotante del carrito, mismo lugar/tamaño que `FloatingWhatsApp`
 * (P.ej. `/menu`, donde reemplaza a esa burbuja — ver `app/menu/page.tsx`).
 * Azul de marca para no confundirse con el rojo de "Confirmar pedido" ni el
 * verde de WhatsApp. El pulso continuo solo corre con productos en el
 * carrito — sin nada que atender, no hay nada que "llame la atención".
 */
export default function FloatingCartButton() {
  const { count } = useCart();
  const hasItems = count > 0;

  return (
    <Link
      href="/carrito/"
      aria-label={hasItems ? `Ver carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Ver carrito"}
      className={`fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue text-white shadow-[0_8px_30px_rgba(0,36,125,0.45)] transition-transform duration-300 hover:scale-110 active:scale-95 md:right-6 md:bottom-6 ${
        hasItems ? "animate-cart-pulse" : ""
      }`}
    >
      <CartIcon className="h-7 w-7" />
      {hasItems && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-brand-red px-1 text-[11px] font-bold text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
