"use client";

import Link from "next/link";
import { GiftIcon, UserIcon } from "@/components/ui/icons";
import { useCustomerAuth } from "@/lib/customerAuth";

/** Clases compartidas por ambos estados de la píldora (mismo tamaño/posición/slot). */
const PILL_CLASSES =
  "fixed bottom-4 left-4 z-40 flex h-14 items-center gap-2 rounded-full border-2 border-brand-blue py-1 pr-4 pl-1 shadow-[0_8px_30px_rgba(0,36,125,0.25)] transition-transform duration-300 hover:scale-105 active:scale-95 md:bottom-6 md:left-6";

/**
 * Píldora flotante en la esquina inferior izquierda de /menu y /carrito.
 * Mismo slot (bottom-4 left-4) siempre, pero dos estados según sesión:
 *  - Logueado: saldo de puntos real y atajo directo a /premios, sin tener
 *    que abrir /cuenta para chequearlo mientras navega la carta.
 *  - Invitado: en vez de no mostrar nada ahí, invita a iniciar sesión con
 *    la misma píldora (mismo tamaño/posición) para que sea fácil de ver y
 *    entender qué hacer. `RewardsReminderBubble` puede aparecer arriba de
 *    esta píldora (ver su propio comentario) para además invitar a crear
 *    cuenta — no se solapan porque esa burbuja quedó reubicada por encima.
 *
 * A diferencia del badge circular de FloatingCartButton (conteo chico,
 * 1-2 dígitos), el saldo de puntos puede ser un número grande — por eso va
 * como texto completo en una píldora en vez de truncarlo tipo "99+", que
 * daría una cifra incorrecta justo para decidir si un premio es canjeable.
 */
export default function FloatingRewardsButton() {
  const { customer, loading } = useCustomerAuth();

  if (loading) return null;

  if (!customer) {
    return (
      <Link
        href="/cuenta/login/"
        aria-label="Iniciar sesión para ver y sumar puntos"
        className={`${PILL_CLASSES} bg-white text-brand-blue`}
      >
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white"
        >
          <UserIcon className="h-5 w-5" />
        </span>
        <span className="font-display text-base leading-none whitespace-nowrap">Iniciar sesión</span>
      </Link>
    );
  }

  return (
    <Link
      href="/premios/"
      aria-label={`Ver mis premios, tenés ${customer.pointsBalance} puntos`}
      className={`${PILL_CLASSES} bg-brand-yellow text-brand-blue`}
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
