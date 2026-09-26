"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { useCart } from "@/lib/cart";

const VISIBLE_MS = 2800;
const EXIT_MS = 180;

type Phase = "hidden" | "visible" | "closing";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Toast de "se agregó al carrito", arriba-centro (debajo del navbar) para no
 * competir con las burbujas de esquina (`FloatingCartButton`,
 * `RewardsReminderBubble`). Se dispara desde `lib/cart.tsx` (`addLine` graba
 * `lastAdded`, con `id` incremental) — no hace falta tocar `ItemCard`/
 * `ItemModal`, cualquier `addLine` futuro dispara el toast automáticamente.
 * Solo reacciona a un `id` nuevo, así que nunca se dispara por la hidratación
 * del carrito guardado (esa ruta nunca llama `addLine`).
 */
export default function CartAddedToast() {
  const { lastAdded } = useCart();
  const [phase, setPhase] = useState<Phase>("hidden");
  const [label, setLabel] = useState("");

  const lastShownIdRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!lastAdded || lastAdded.id === lastShownIdRef.current) return;
    lastShownIdRef.current = lastAdded.id;

    clearTimeout(hideTimerRef.current);
    clearTimeout(closeTimerRef.current);
    setLabel(lastAdded.label);
    setPhase("visible");

    hideTimerRef.current = setTimeout(() => {
      if (prefersReducedMotion()) {
        setPhase("hidden");
        return;
      }
      setPhase("closing");
      closeTimerRef.current = setTimeout(() => setPhase("hidden"), EXIT_MS);
    }, VISIBLE_MS);
  }, [lastAdded]);

  useEffect(() => {
    return () => {
      clearTimeout(hideTimerRef.current);
      clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-40 flex justify-center px-4 md:top-[5rem]"
    >
      {phase !== "hidden" && (
        <div
          className={`pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-full border-2 border-brand-blue bg-cream px-4 py-2.5 shadow-card ${
            phase === "closing" ? "animate-toast-out" : "animate-toast-in"
          }`}
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white"
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          <p className="truncate text-sm font-semibold text-ink">
            <span className="text-brand-blue">{label}</span> se agregó al carrito
          </p>
        </div>
      )}
    </div>
  );
}
