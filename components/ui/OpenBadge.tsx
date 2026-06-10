"use client";

import { useEffect, useState } from "react";
import { getOpenStatus } from "@/lib/businessHours";
import type { OpenStatus } from "@/types";

/**
 * Badge "Abierto ahora / Cerrado" según la hora actual en America/Lima.
 * Se calcula solo en el cliente (evita desfase de hidratación) y se
 * actualiza cada minuto.
 */
export default function OpenBadge() {
  const [status, setStatus] = useState<OpenStatus | null>(null);

  useEffect(() => {
    const update = (): void => setStatus(getOpenStatus());
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Mientras hidrata: placeholder neutro del mismo tamaño
  if (!status) {
    return (
      <span className="inline-flex h-9 w-44 animate-pulse items-center rounded-full bg-white/20" />
    );
  }

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm ring-1 ring-white/25"
      role="status"
    >
      <span className="relative flex h-2.5 w-2.5">
        {status.isOpen && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            status.isOpen ? "bg-green-400" : "bg-red-500"
          }`}
        />
      </span>
      {status.isOpen ? "Abierto ahora" : "Cerrado"}
      <span className="hidden text-white/70 sm:inline">· {status.detail}</span>
    </span>
  );
}
