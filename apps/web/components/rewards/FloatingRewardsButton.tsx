"use client";

import Link from "next/link";
import { GiftIcon } from "@/components/ui/icons";
import { useCustomerAuth } from "@/lib/customerAuth";

/**
 * Píldora flotante con el saldo de puntos, mismo slot (bottom-4 left-4) que
 * `RewardsReminderBubble` — nunca se solapan porque son mutuamente
 * excluyentes por estado de sesión: invitados ven la burbuja invitando a
 * crear cuenta; clientes logueados ven acá su saldo real y un atajo directo
 * a /premios, sin tener que abrir /cuenta para chequearlo mientras navegan
 * la carta o el carrito.
 *
 * A diferencia del badge circular de FloatingCartButton (conteo chico,
 * 1-2 dígitos), el saldo de puntos puede ser un número grande — por eso va
 * como texto completo en una píldora en vez de truncarlo tipo "99+", que
 * daría una cifra incorrecta justo para decidir si un premio es canjeable.
 */
export default function FloatingRewardsButton() {
  const { customer, loading } = useCustomerAuth();

  if (loading || !customer) return null;

  return (
    <Link
      href="/premios/"
      aria-label={`Ver mis premios, tenés ${customer.pointsBalance} puntos`}
      className="fixed bottom-4 left-4 z-40 flex h-14 items-center gap-2 rounded-full border-2 border-brand-blue bg-brand-yellow py-1 pr-4 pl-1 text-brand-blue shadow-[0_8px_30px_rgba(0,36,125,0.25)] transition-transform duration-300 hover:scale-105 active:scale-95 md:bottom-6 md:left-6"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white"
      >
        <GiftIcon className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-semibold tracking-wide text-brand-blue/70 uppercase">Mis puntos</span>
        <span className="font-display text-lg tabular-nums">{customer.pointsBalance}</span>
      </span>
    </Link>
  );
}
