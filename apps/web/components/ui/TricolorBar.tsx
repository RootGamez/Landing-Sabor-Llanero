/**
 * Franja tricolor venezolana (amarillo / azul / rojo).
 * Se usa como divisor de marca en navbar, secciones y footer.
 */
export default function TricolorBar({ className = "" }: { className?: string }) {
  return (
    <div className={`flex w-full ${className}`} aria-hidden="true">
      <span className="h-full flex-1 bg-brand-yellow" />
      <span className="h-full flex-1 bg-brand-blue" />
      <span className="h-full flex-1 bg-brand-red" />
    </div>
  );
}
