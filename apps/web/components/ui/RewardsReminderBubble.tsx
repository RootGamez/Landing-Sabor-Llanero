"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { useCustomerAuth } from "@/lib/customerAuth";
import { CloseIcon, GiftIcon } from "@/components/ui/icons";

/** No molesta de nuevo en la misma sesión de pestaña una vez cerrada. */
const DISMISS_KEY = "sabor-llanero-rewards-bubble-dismissed";
/** "Mientras está en el menú": aparece sola si no pasó nada antes. */
const IDLE_DELAY_MS = 4500;
/** Cierre: más corto que la entrada (regla exit-faster-than-enter). */
const CLOSE_ANIMATION_MS = 160;

type Phase = "hidden" | "visible" | "closing";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false; // sessionStorage bloqueado: se comporta como "no cerrado todavía"
  }
}

function persistDismissed(): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // sin persistencia disponible: igual deja de mostrarse en esta carga de página
  }
}

/**
 * Burbuja flotante que invita a crear una cuenta para sumar puntos —
 * pensada para /menu y /carrito, nunca para clientes ya logueados.
 * Dos disparadores (ambos piden lo mismo que el usuario describió):
 *  1) "Mientras está en el menú": aparece sola tras un rato de inactividad.
 *  2) "Cuando agrega productos al carrito": un aumento real de `count`
 *     la muestra al instante, aunque ya se haya cerrado el timer de arriba.
 * El primer valor de `count` que llega (la hidratación del carrito desde
 * localStorage) se usa solo como línea base — no cuenta como "acabás de
 * agregar algo", si no se dispararía en cada carga de página con carrito
 * previo.
 */
export default function RewardsReminderBubble() {
  const { customer, loading } = useCustomerAuth();
  const { count } = useCart();
  const [phase, setPhase] = useState<Phase>("hidden");

  const dismissedRef = useRef(false);
  const hasBaselineRef = useRef(false);
  const prevCountRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    dismissedRef.current = readDismissed();
  }, []);

  useEffect(() => {
    if (loading || customer || dismissedRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      setPhase((prev) => (prev === "hidden" ? "visible" : prev));
    }, IDLE_DELAY_MS);
    return () => clearTimeout(idleTimerRef.current);
  }, [loading, customer]);

  useEffect(() => {
    if (!hasBaselineRef.current) {
      hasBaselineRef.current = true;
      prevCountRef.current = count;
      return;
    }
    const justAdded = count > prevCountRef.current;
    prevCountRef.current = count;
    if (justAdded && !loading && !customer && !dismissedRef.current) {
      clearTimeout(idleTimerRef.current);
      setPhase("visible");
    }
  }, [count, loading, customer]);

  function handleDismiss() {
    clearTimeout(idleTimerRef.current);
    dismissedRef.current = true;
    persistDismissed();
    if (prefersReducedMotion()) {
      setPhase("hidden");
      return;
    }
    setPhase("closing");
    setTimeout(() => setPhase("hidden"), CLOSE_ANIMATION_MS);
  }

  if (loading || customer) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-4 z-40 w-[calc(100vw-2rem)] max-w-[19rem] md:bottom-6 md:left-6"
    >
      {phase !== "hidden" && (
        <div
          role="region"
          aria-label="Aviso: sumá puntos con una cuenta"
          className={`pointer-events-auto relative rounded-brand border-2 border-brand-blue bg-cream shadow-card ${
            phase === "closing" ? "animate-bubble-out" : "animate-bubble-in"
          }`}
        >
          <div className="flex items-start gap-3 p-4">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-brand-blue bg-brand-yellow text-brand-blue"
            >
              <GiftIcon className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-bold text-brand-blue">¿Sabías que podés sumar puntos?</p>
              <p className="mt-1 text-sm leading-snug text-ink/80">
                Creá tu cuenta gratis y acumulá puntos con cada pedido para canjear recompensas.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Link
                  href="/cuenta/registro/"
                  onClick={handleDismiss}
                  className="btn-shine inline-flex h-9 items-center justify-center rounded-full bg-brand-blue px-4 text-xs font-bold text-white transition-transform duration-300 hover:scale-105 active:scale-95"
                >
                  Crear cuenta gratis
                </Link>
                <Link
                  href="/cuenta/login/"
                  onClick={handleDismiss}
                  className="text-xs font-semibold text-ink/60 underline-offset-2 hover:text-brand-blue hover:underline"
                >
                  ¿Ya tenés cuenta?
                </Link>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Cerrar aviso"
              className="relative -m-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {/* "Cola" de burbuja de chat, hacia la esquina de la que aparece */}
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 left-9 h-4 w-4 rotate-45 border-r-2 border-b-2 border-brand-blue bg-cream"
          />
        </div>
      )}
    </div>
  );
}
