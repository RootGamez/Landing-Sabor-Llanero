"use client";

import { useEffect } from "react";

/**
 * Registra /sw.js para que el sitio sea instalable como app (PWA). Solo en
 * producción: en `next dev` un service worker activo cachea builds viejos y
 * confunde el desarrollo. No renderiza nada.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      // Sin SW la web sigue funcionando igual; solo se pierde la instalación.
      console.warn("No se pudo registrar el service worker", error);
    });
  }, []);

  return null;
}
