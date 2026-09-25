"use client";

import { useEffect, useRef, useState } from "react";
import { CartIcon, CheckIcon } from "@/components/ui/icons";

interface AddToCartButtonProps {
  onAdd: () => void;
  disabled?: boolean;
  /** Botón más chico, a juego con OrderButton `compact`. */
  compact?: boolean;
  /** aria-label del botón: "Agregar Pizza Alborada al carrito". */
  label: string;
  /** Anunciado a lectores de pantalla tras agregar (no hay sistema de toasts en apps/web). */
  addedAnnouncement: string;
  /** id del hint visible que explica por qué está deshabilitado (compartido con el OrderButton de al lado). */
  ariaDescribedBy?: string;
}

const FEEDBACK_MS = 1200;

/**
 * Control cuadrado que vive AL LADO de `OrderButton` en la card y en el modal
 * (P2.7): agrega la línea actual (ítem + tamaño elegido) al carrito. Sin
 * librería de toasts en este app, el feedback es local — ícono check
 * temporal + `aria-live` — en vez de sumar una dependencia nueva por un solo
 * micro-feedback (YAGNI).
 */
export default function AddToCartButton({
  onAdd,
  disabled = false,
  compact = false,
  label,
  addedAnnouncement,
  ariaDescribedBy,
}: AddToCartButtonProps) {
  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const handleClick = (): void => {
    onAdd();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    // Se apaga primero (aunque ya estuviera prendido) para forzar un cambio
    // real de texto en el `role="status"` de abajo: si el usuario agrega el
    // mismo ítem dos veces seguido dentro de la ventana de feedback, el texto
    // del aria-live no mutaría (sigue en "true") y el lector de pantalla no
    // volvería a anunciar la segunda confirmación.
    setJustAdded(false);
    frameRef.current = requestAnimationFrame(() => {
      setJustAdded(true);
      timeoutRef.current = setTimeout(() => setJustAdded(false), FEEDBACK_MS);
    });
  };

  const size = compact ? "h-11 w-11" : "h-12 w-12";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={label}
        aria-describedby={disabled ? ariaDescribedBy : undefined}
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-200 ${size} ${
          disabled
            ? "cursor-not-allowed border-ink/10 bg-ink/5 text-ink/30"
            : justAdded
              ? "border-brand-blue bg-brand-blue text-white"
              : "border-brand-blue/30 bg-white text-brand-blue hover:border-brand-blue hover:bg-brand-blue/5 active:scale-95"
        }`}
      >
        {justAdded ? (
          <CheckIcon className="h-5 w-5" />
        ) : (
          <CartIcon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        )}
      </button>
      <p className="sr-only" role="status">
        {justAdded ? addedAnnouncement : ""}
      </p>
    </>
  );
}
