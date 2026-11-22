/**
 * Copia en línea de `/logo.svg`. La tarjeta se captura con `html-to-image`, que
 * tendría que re-descargar una `<img>` externa (y en Safari a veces la deja en
 * blanco); un SVG en el DOM se captura siempre.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 110" className={className} aria-hidden="true" focusable="false">
      <rect width="240" height="110" rx="18" fill="#00247d" />
      <text x="120" y="50" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="30" fontWeight="800" fill="#ffce00">
        SABOR
      </text>
      <text x="120" y="84" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="26" fontWeight="800" fill="#fdf8ef">
        LLANERO
      </text>
    </svg>
  );
}
