/**
 * Skeletons de carga del catálogo (mismo lenguaje que el skeleton de
 * GoogleReviews: animate-pulse sobre cards blancas con tintes de marca).
 * Replican la anatomía real de las cards — imagen 4/3 + texto + chips +
 * botón — para reservar el mismo espacio y no producir layout shift.
 */

export function ItemCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-card" aria-hidden="true">
      <div className="aspect-[4/3] w-full animate-pulse bg-brand-blue/8" />
      <div className="animate-pulse space-y-3 p-5">
        <div className="h-5 w-2/3 rounded bg-brand-blue/10" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-brand-blue/8" />
          <div className="h-3 w-4/5 rounded bg-brand-blue/8" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-20 rounded-xl bg-brand-blue/8" />
          <div className="h-11 w-20 rounded-xl bg-brand-blue/8" />
          <div className="h-11 w-20 rounded-xl bg-brand-blue/8" />
        </div>
        <div className="h-11 w-full rounded-full bg-brand-red/10" />
      </div>
    </div>
  );
}

/** Rail horizontal en carga: mismas medidas que las cards del carrusel real. */
export function RailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <div className="mb-5 h-7 w-56 animate-pulse rounded-full bg-brand-blue/10" aria-hidden="true" />
      <div className="flex gap-4 overflow-hidden md:gap-5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-[16rem] shrink-0 sm:w-[18rem] ${i > 1 ? "hidden lg:block" : ""}`}>
            <ItemCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grid del catálogo por categorías en carga. */
export function SectionsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-12">
      {[0, 1].map((section) => (
        <div key={section} aria-hidden="true">
          <div className="mb-6 h-8 w-48 animate-pulse rounded-full bg-brand-blue/10" />
          <div className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={i > 1 ? "hidden lg:block" : ""}>
                <ItemCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
