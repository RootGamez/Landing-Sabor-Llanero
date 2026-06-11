import { BikeIcon, ClockIcon, TagIcon } from "@/components/ui/icons";
import { siteConfig } from "@/lib/siteConfig";

/**
 * Franja amarilla de delivery: zona de reparto, promociones y horario.
 * Datos desde lib/siteConfig.ts y visible justo bajo el hero.
 */
export default function DeliveryBar() {
  return (
    <aside
      aria-label="Delivery, promociones y horario"
      className="relative z-30 bg-brand-yellow"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 py-3.5 text-center text-sm font-semibold text-ink sm:flex-row sm:gap-8 md:px-6 md:text-base">
        <span className="inline-flex items-center gap-2">
          <BikeIcon className="h-5 w-5 text-brand-red" />
          Delivery a {siteConfig.delivery.areas}
        </span>
        <span className="hidden h-1.5 w-1.5 rounded-full bg-brand-blue sm:block" aria-hidden="true" />
        <span className="inline-flex items-center gap-2">
          <TagIcon className="h-5 w-5 text-brand-red" />
          {siteConfig.delivery.note}
        </span>
        <span className="hidden h-1.5 w-1.5 rounded-full bg-brand-blue sm:block" aria-hidden="true" />
        <span className="inline-flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-brand-red" />
          Todos los días, 5:00 pm – 10:30 pm
        </span>
      </div>
    </aside>
  );
}
