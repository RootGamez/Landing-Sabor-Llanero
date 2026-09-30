"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { trackOrderClick } from "@/lib/events";

interface QuickOrderPayload {
  itemId: number;
  sizeId?: number;
  /** Link wa.me ya armado (buildItemOrderLink) — se abre recién si el pedido se crea bien. */
  whatsappHref: string;
}

/**
 * Crea un pedido real (POST /orders) para UN solo ítem, sin pasar por el
 * carrito, antes de abrir WhatsApp — para el botón "Pedir" individual cuando
 * hay sesión. Mismo patrón anti-bloqueador de pop-ups que `confirmLoggedIn`
 * en CartPageContent.tsx (pestaña pre-abierta dentro del gesto síncrono del
 * click; recién tras el `await` se le asigna la URL final). Compartido por
 * ItemCard e ItemModal para no duplicar esta lógica en los dos.
 */
export function useQuickOrder() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const confirmLoggedIn = async (tab: Window | null, payload: QuickOrderPayload): Promise<void> => {
    setSubmitting(true);
    setError(null);
    setManualLink(null);

    try {
      await api.post("/orders", {
        items: [{ itemId: payload.itemId, sizeId: payload.sizeId, quantity: 1 }],
      });
    } catch (err) {
      // El pedido nunca se creó: cerrar la pestaña en blanco y avisar, en vez
      // de dejarla abierta en blanco o navegarla igual a WhatsApp sin pedido
      // real detrás.
      tab?.close();
      if (mountedRef.current) {
        setError(err instanceof ApiError ? err.message : "No se pudo crear el pedido. Intenta de nuevo.");
        setSubmitting(false);
      }
      return;
    }

    trackOrderClick(payload.itemId);

    let opened = false;
    if (tab) {
      try {
        tab.opener = null;
        tab.location.href = payload.whatsappHref;
        opened = true;
      } catch {
        // El usuario pudo haber cerrado la pestaña en blanco mientras se
        // esperaba la respuesta — se sigue al fallback de abajo.
      }
    }
    if (!opened) {
      opened = Boolean(window.open(payload.whatsappHref, "_blank", "noopener,noreferrer"));
    }

    if (mountedRef.current) {
      if (!opened) setManualLink(payload.whatsappHref);
      setSubmitting(false);
    }
  };

  const confirm = (payload: QuickOrderPayload): void => {
    const tab = window.open("", "_blank");
    void confirmLoggedIn(tab, payload);
  };

  return { confirm, submitting, error, manualLink };
}
