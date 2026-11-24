"use client";

import {
  displayName,
  type Lang,
  type MenuItemWithPrices,
  type ResolvedPrice,
  type Size,
  type WhatsappConfig,
} from "@sabor/shared";
import { cartLineFromItem, useCartActions } from "@/lib/cart";
import { CATALOG_UI } from "@/lib/catalogUi";
import { useCustomerAuth } from "@/lib/customerAuth";
import { optionKindOf, optionLabelFor, type OptionKind } from "@/lib/priceOptions";
import { siteConfig } from "@/lib/siteConfig";
import { useQuickOrder } from "@/lib/useQuickOrder";
import { buildItemOrderLink } from "@/lib/whatsapp";

interface UseItemOrderParams {
  item: MenuItemWithPrices;
  sizes: Size[];
  lang: Lang;
  whatsapp: WhatsappConfig;
  selectedSizeId: number | null;
}

interface ItemOrder {
  name: string;
  /** El ítem se vende por tamaño o por presentación (`prices.length > 0`). */
  hasOptions: boolean;
  optionKind: OptionKind;
  selectedPrice: ResolvedPrice | null;
  /** Hay opciones y todavía no se eligió ninguna: pedir/agregar queda bloqueado. */
  needsChoice: boolean;
  /** Texto del hint "Elige un tamaño / una presentación". */
  chooseHint: string;
  canAddToCart: boolean;
  addToCart: () => void;
  orderHref: string | null;
  /** Presente solo con sesión: crea el pedido real antes de abrir WhatsApp. */
  onQuickOrder: (() => void) | undefined;
  submitting: boolean;
  error: string | null;
  manualLink: string | null;
}

/**
 * Estado derivado de pedir un ítem (carrito, deep link de WhatsApp y pedido
 * rápido), compartido por ItemCard e ItemModal para que ambos traten igual a
 * los ítems sin opciones, con tamaños y con presentaciones.
 */
export function useItemOrder({
  item,
  sizes,
  lang,
  whatsapp,
  selectedSizeId,
}: UseItemOrderParams): ItemOrder {
  const { addLine } = useCartActions();
  const { customer } = useCustomerAuth();
  const { confirm, submitting, error, manualLink } = useQuickOrder();

  const name = displayName(item, lang);
  const hasOptions = item.prices.length > 0;
  const optionKind = optionKindOf(item.prices);
  const selectedPrice = hasOptions
    ? (item.prices.find((price) => price.sizeId === selectedSizeId) ?? null)
    : null;
  const sizeLabel = selectedPrice ? optionLabelFor(selectedPrice, sizes, lang) : null;
  const canAddToCart = hasOptions ? selectedPrice != null : item.price != null;

  const addToCart = (): void => {
    const line = cartLineFromItem({ item, hasSizes: hasOptions, selectedPrice, name, sizeLabel });
    if (line) addLine(line);
  };

  // Ruta de share con Open Graph reales (apps/web/worker.ts): WhatsApp nunca ve
  // el fragmento `#item-slug`, así que se comparte esta ruta intermedia que
  // redirige a `/menu/#item-slug` para quien la abre.
  const unitPrice = hasOptions ? (selectedPrice?.price ?? null) : item.price;
  const orderHref =
    unitPrice == null
      ? null
      : buildItemOrderLink({
          config: whatsapp,
          lang,
          itemName: name,
          price: unitPrice,
          sizeLabel,
          itemUrl: `${siteConfig.url}/menu/item/${item.slug}`,
        });

  const onQuickOrder = (): void => {
    if (!orderHref) return;
    confirm({ itemId: item.id, sizeId: selectedPrice?.sizeId, whatsappHref: orderHref });
  };

  const ui = CATALOG_UI[lang];
  return {
    name,
    hasOptions,
    optionKind,
    selectedPrice,
    needsChoice: hasOptions && !selectedPrice,
    chooseHint: optionKind === "portion" ? ui.choosePortion : ui.chooseSize,
    canAddToCart,
    addToCart,
    orderHref,
    onQuickOrder: customer ? onQuickOrder : undefined,
    submitting,
    error,
    manualLink,
  };
}
