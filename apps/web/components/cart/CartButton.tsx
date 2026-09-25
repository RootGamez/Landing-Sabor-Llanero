"use client";

import Link from "next/link";
import { CartIcon } from "@/components/ui/icons";
import { useCart } from "@/lib/cart";

interface CartButtonProps {
  /** Paleta: ink sobre navbar sólido, blanco sobre hero transparente (mismo criterio que el resto del Navbar). */
  solid?: boolean;
  onClick?: () => void;
}

/**
 * Ícono de carrito con badge de cantidad, montado en el Navbar (P2.7). El
 * conteo arranca en 0 en el HTML servido (export estático) y se actualiza
 * recién tras hidratar `CartProvider` — mismo criterio de `lib/lang.tsx`, así
 * que nunca hay mismatch de hidratación.
 */
export default function CartButton({ solid = false, onClick }: CartButtonProps) {
  const { count } = useCart();
  const hasItems = count > 0;

  return (
    <Link
      href="/carrito/"
      onClick={onClick}
      aria-label={hasItems ? `Ver carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Ver carrito"}
      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300 ${
        solid ? "text-ink hover:text-brand-red" : "text-white hover:text-brand-yellow"
      }`}
    >
      <CartIcon className="h-5 w-5" />
      {hasItems && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
