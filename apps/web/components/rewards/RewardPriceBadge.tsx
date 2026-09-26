import { formatPrice, rewardDiscountPercent } from "@sabor/shared";
import { TagIcon } from "@/components/ui/icons";

interface RewardPriceBadgeProps {
  price: number | null;
  discountPrice: number | null;
}

/**
 * Precio de referencia de un premio (P2.9). Sin `price` no se renderiza nada
 * (premio aún sin precio cargado por el dueño — no debería llegar así al
 * catálogo visible, pero no debe romper el render si ocurre). Sin descuento
 * válido es solo texto informativo, sin reclamar una oferta que no existe.
 *
 * Con `discountPrice` válido (< price, vía `rewardDiscountPercent`,
 * pricing.ts) se resalta como "producto con descuento": precio original
 * tachado + precio final en grande + chip "-N%". Guía de diseño aplicada
 * (skill ui-ux-pro-max):
 *  - Jerarquía por TAMAÑO/PESO, no solo color (el original es chico y
 *    apagado; el final es grande, en el mismo font-display/rojo que ya usan
 *    los precios del catálogo).
 *  - El chip es una píldora (rounded-full), no comparte el radio de la card
 *    — se lee como una etiqueta superpuesta, no como parte del marco.
 *  - Mismo rojo de marca que `PromosBlock` ya usa para "promo" (TagIcon +
 *    brand-red): reutiliza el significado semántico existente en vez de
 *    inventar un color nuevo para "descuento".
 *  - El descuento nunca depende solo del color: el tachado, el texto "-N%"
 *    y las etiquetas de screen-reader ("Antes"/"Ahora") lo confirman por
 *    texto y estructura también.
 */
export default function RewardPriceBadge({ price, discountPrice }: RewardPriceBadgeProps) {
  if (price == null) return null;

  const percent = rewardDiscountPercent(price, discountPrice);
  if (percent == null || discountPrice == null) {
    return <p className="text-sm text-ink/60">{formatPrice(price)}</p>;
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span
        aria-label={`${percent}% de descuento`}
        className="inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-bold text-white"
      >
        <TagIcon className="h-3 w-3" />-{percent}%
      </span>
      <span className="text-xs text-ink/60">
        <span className="sr-only">Antes: </span>
        <span className="line-through tabular-nums">{formatPrice(price)}</span>
      </span>
      <span className="font-display text-xl leading-none text-brand-red tabular-nums">
        <span className="sr-only">Ahora: </span>
        {formatPrice(discountPrice)}
      </span>
    </div>
  );
}
