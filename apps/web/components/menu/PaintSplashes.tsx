import { memo } from "react";

/**
 * Manchas de pintura del tricolor venezolano detrás del catálogo: rompen el
 * fondo plano crema sin competir con las cards.
 *
 * Reglas que se respetan:
 * - Opacidad baja + `mix-blend-mode: multiply` para no bajar el contraste del
 *   texto (que igual vive sobre cards blancas opacas).
 * - `pointer-events-none` + `aria-hidden`: es decoración pura.
 * - El contenedor recorta con su propio `overflow-hidden`; la sección NO puede
 *   recortar, porque su hijo sticky (el buscador) dejaría de pegarse.
 * - La deriva se apaga con `prefers-reduced-motion` (ver globals.css).
 */

/** Blobs orgánicos, centrados en un viewBox 200×200 (transform translate(100,100)). */
const BLOB_A =
  "M45.6,-59.1C58.4,-51.4,67.3,-36.8,71.3,-21.2C75.3,-5.6,74.4,11,68,24.7C61.6,38.4,49.7,49.2,36.3,57.7C22.9,66.2,8,72.4,-6.9,71.6C-21.8,70.8,-36.7,63,-49.3,52.1C-61.9,41.2,-72.2,27.2,-75.6,11.5C-79,-4.2,-75.5,-21.6,-66.3,-34.9C-57.1,-48.2,-42.2,-57.4,-27.5,-64.1C-12.8,-70.8,1.7,-75,15.9,-72.6C30.1,-70.2,32.8,-66.8,45.6,-59.1Z";
const BLOB_B =
  "M39.3,-52.6C50.4,-44.4,58.4,-32.1,63.8,-18.2C69.2,-4.3,72,11.2,67.4,24.1C62.8,37,50.8,47.3,37.7,55.6C24.6,63.9,10.4,70.2,-4.6,71.4C-19.6,72.6,-35.4,68.7,-47.9,59.5C-60.4,50.3,-69.6,35.8,-73.3,20.1C-77,4.4,-75.2,-12.5,-68.1,-26.4C-61,-40.3,-48.6,-51.2,-35.3,-58.9C-22,-66.6,-7.8,-71.1,3.9,-69.4C15.6,-67.7,28.2,-60.8,39.3,-52.6Z";
const BLOB_C =
  "M52.1,-63.4C66.2,-54.2,75.3,-36.4,76.9,-18.6C78.5,-0.8,72.6,17,63.1,32.3C53.6,47.6,40.5,60.4,24.8,67.4C9.1,74.4,-9.2,75.6,-25.9,70.1C-42.6,64.6,-57.7,52.4,-66.6,36.6C-75.5,20.8,-78.2,1.4,-73.5,-15.6C-68.8,-32.6,-56.7,-47.2,-42.3,-56.3C-27.9,-65.4,-11.2,-69,4.8,-74.7C20.8,-80.4,38,-72.6,52.1,-63.4Z";

interface SplashProps {
  path: string;
  color: string;
  opacity: number;
  /** Posición y tamaño (clases de Tailwind). */
  className: string;
  /** Desfase de la deriva para que las manchas no se muevan en bloque. */
  delayMs: number;
  /** Gotas satélite: [cx, cy, r] en el mismo viewBox. */
  droplets?: ReadonlyArray<readonly [number, number, number]>;
}

function Splash({ path, color, opacity, className, delayMs, droplets = [] }: SplashProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`splash animate-splash-drift ${className}`}
      style={{ opacity, animationDelay: `${delayMs}ms` }}
      aria-hidden="true"
    >
      <g fill={color}>
        <path d={path} transform="translate(100 100)" />
        {droplets.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </svg>
  );
}

/**
 * `memo` sin props: el estado del buscador vive en Menu.tsx, así que sin esto
 * los 4 SVG animados se re-renderizarían en cada tecla escrita.
 */
const PaintSplashes = memo(function PaintSplashes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <Splash
        path={BLOB_A}
        color="var(--color-brand-yellow)"
        opacity={0.22}
        className="-top-32 -left-28 h-[30rem] w-[30rem]"
        delayMs={0}
        droplets={[
          [178, 52, 7],
          [190, 78, 4],
          [166, 24, 3],
        ]}
      />
      <Splash
        path={BLOB_B}
        color="var(--color-brand-blue)"
        opacity={0.13}
        className="top-1/4 -right-40 h-[34rem] w-[34rem]"
        delayMs={-9000}
        droplets={[
          [22, 118, 6],
          [8, 92, 3.5],
        ]}
      />
      <Splash
        path={BLOB_C}
        color="var(--color-brand-red)"
        opacity={0.12}
        className="-bottom-40 -left-32 h-[32rem] w-[32rem]"
        delayMs={-17000}
        droplets={[
          [170, 60, 6.5],
          [186, 92, 3],
        ]}
      />
      <Splash
        path={BLOB_A}
        color="var(--color-brand-yellow)"
        opacity={0.16}
        className="-right-24 -bottom-28 h-[22rem] w-[22rem]"
        delayMs={-4000}
      />
    </div>
  );
});

export default PaintSplashes;
