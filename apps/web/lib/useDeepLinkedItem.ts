"use client";

import { useEffect, useRef } from "react";
import type { MenuItemWithPrices } from "@sabor/shared";

const ITEM_HASH = /^#item-(.+)$/;

/**
 * Enlaces `/menu/#item-<slug>` (carrito, vista previa de WhatsApp vía
 * worker.ts): las cards se montan recién cuando llega el catálogo, así que el
 * scroll nativo al ancla ocurre antes de que existan. Al cargar las secciones
 * se resuelve el hash UNA vez: se lleva la card a la vista y se abre su modal,
 * donde el cliente elige la presentación/tamaño.
 */
export function useDeepLinkedItem(
  items: readonly MenuItemWithPrices[],
  onFound: (item: MenuItemWithPrices) => void,
): void {
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || items.length === 0) return;
    handledRef.current = true;

    const slug = ITEM_HASH.exec(window.location.hash)?.[1];
    const item = slug ? items.find((candidate) => candidate.slug === slug) : undefined;
    if (!item) return;

    document.getElementById(`item-${item.slug}`)?.scrollIntoView({ block: "center" });
    onFound(item);
  }, [items, onFound]);
}
