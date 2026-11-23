import { forwardRef, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { ReceiptData } from '../../lib/receiptData';
import { RECEIPT_WIDTH, ReceiptCard } from './ReceiptCard';

/** Altura actual de un elemento (la del comprobante cambia con el número de líneas). */
function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setHeight(element.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

/**
 * Vista previa del comprobante reducida al ancho disponible. El `ref` apunta al
 * comprobante SIN escalar: la imagen sale a 576 px de ancho aunque la vista sea chica.
 */
export const ReceiptPreview = forwardRef<HTMLDivElement, { data: ReceiptData }>(function ReceiptPreview(
  { data },
  cardRef,
) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scale = Math.min(useElementWidth(frameRef) / RECEIPT_WIDTH, 1);
  const height = useElementHeight(contentRef);
  return (
    <div
      ref={frameRef}
      className="mx-auto w-full overflow-hidden rounded-lg ring-2 ring-border bg-white shadow-sm"
      style={{ maxWidth: RECEIPT_WIDTH, height: height * scale || undefined }}
    >
      <div
        ref={contentRef}
        style={{ width: RECEIPT_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <ReceiptCard ref={cardRef} data={data} />
      </div>
    </div>
  );
});
