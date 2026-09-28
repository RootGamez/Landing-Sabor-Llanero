import { memo } from "react";
import ParticlesCanvas from "@/components/ui/ParticlesCanvas";

/**
 * Fondo animado del hero del menú: "noche llanera junto al horno".
 *
 * Capas (de atrás hacia adelante):
 * 1. Base azul de marca (brand-blue-ink → brand-blue): el amarillo y el rojo
 *    del contenido resaltan más sobre azul que sobre gris carbón.
 * 2. Auroras tricolor que derivan lento — gradientes radiales ya difuminados
 *    (no `filter: blur`, caro en móvil); solo se anima `transform`.
 * 3. Rayos tipo afiche de pizzería girando detrás del producto, enmascarados
 *    en círculo para que se desvanezcan hacia los bordes.
 * 4. Brasas flotantes (mismo ParticlesCanvas del Hero de la home).
 * 5. Viñeta inferior para asentar el contenido y los controles.
 *
 * Todo el movimiento se apaga con prefers-reduced-motion (globals.css y
 * ParticlesCanvas). `memo` sin props: el hero re-renderiza en cada cambio de
 * slide/pausa y el fondo no necesita reconciliarse.
 */
const HeroBackdrop = memo(function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_65%_35%,var(--color-brand-blue)_0%,var(--color-brand-blue-deep)_35%,var(--color-brand-blue-ink)_75%)]" />

      <div className="animate-aurora-a absolute -top-[20%] -left-[15%] h-[70vmax] w-[70vmax] rounded-full bg-[radial-gradient(circle,rgb(255_206_0/0.28)_0%,transparent_60%)]" />
      <div className="animate-aurora-b absolute -right-[20%] -bottom-[30%] h-[80vmax] w-[80vmax] rounded-full bg-[radial-gradient(circle,rgb(207_20_43/0.35)_0%,transparent_60%)]" />
      <div className="animate-aurora-c absolute top-[25%] left-[30%] h-[55vmax] w-[55vmax] rounded-full bg-[radial-gradient(circle,rgb(96_130_255/0.22)_0%,transparent_60%)]" />

      <div className="absolute top-[58%] left-1/2 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(circle,black_0%,transparent_38%)] md:top-1/2 md:left-[72%]">
        <div className="animate-sunburst h-full w-full bg-[repeating-conic-gradient(rgb(255_206_0/0.09)_0deg_5deg,transparent_5deg_15deg)]" />
      </div>

      <div className="texture-dots-light absolute inset-0 opacity-60" />

      <ParticlesCanvas />

      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-brand-blue-ink/80 to-transparent" />
    </div>
  );
});

export default HeroBackdrop;
