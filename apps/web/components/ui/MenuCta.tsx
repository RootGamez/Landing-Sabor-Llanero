import Link from "next/link";
import { PizzaSliceIcon } from "@/components/ui/icons";

type MenuCtaVariant = "solid" | "ghost" | "outline";

interface MenuCtaProps {
  /**
   * solid: rojo de marca (primario), ghost: translúcido para fondos
   * oscuros, outline: para fondos claros (crema).
   */
  variant?: MenuCtaVariant;
  label?: string;
  className?: string;
}

const VARIANT_CLASSES: Record<MenuCtaVariant, string> = {
  solid:
    "btn-shine bg-brand-red text-white shadow-glow-red hover:bg-brand-red-deep",
  ghost:
    "bg-white/10 text-white ring-2 ring-white/50 backdrop-blur-md hover:bg-white hover:text-brand-blue",
  outline:
    "bg-white text-brand-blue shadow-md ring-2 ring-brand-blue/25 hover:bg-brand-blue hover:text-white",
};

/**
 * CTA "Ver menú": navega a la ruta dedicada /menu/. Espeja el
 * tratamiento de los CTAs de WhatsApp existentes en la landing.
 */
export default function MenuCta({
  variant = "solid",
  label = "Ver menú",
  className = "",
}: MenuCtaProps) {
  return (
    <Link
      href="/menu/"
      className={`inline-flex items-center justify-center gap-2.5 rounded-full px-9 py-4 text-base font-semibold transition-all duration-300 hover:scale-[1.04] active:scale-95 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      <PizzaSliceIcon className="h-5 w-5" />
      {label}
    </Link>
  );
}
