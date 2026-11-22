import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { formatPEN } from '@sabor/shared';
import type { ClosureData } from '../../lib/closureData';
import { CARD_HEIGHT, CARD_WIDTH } from '../../lib/closureShare';
import { ClosureCard } from './ClosureCard';

interface ClosurePreviewProps {
  data: ClosureData;
}

/**
 * Vista previa de la tarjeta reducida al ancho disponible. El `ref` apunta a la
 * tarjeta sin escalar (la captura sale a 1080 × 1350 aunque la vista sea chica).
 */
export const ClosurePreview = forwardRef<HTMLDivElement, ClosurePreviewProps>(function ClosurePreview({ data }, cardRef) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setScale(Math.min(frame.clientWidth / CARD_WIDTH, 1));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      role="img"
      aria-label={`Tarjeta del cierre de caja: ${formatPEN(data.totalSalesCents)} vendidos en ${data.salesCount} ventas. El detalle está en el resumen en texto.`}
      className="w-full overflow-hidden rounded-xl2 border-2 border-border shadow-sticker"
      style={{ height: CARD_HEIGHT * scale }}
    >
      <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }} aria-hidden="true">
        <ClosureCard ref={cardRef} data={data} />
      </div>
    </div>
  );
});
