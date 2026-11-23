import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useClosureImage } from '../../hooks/useClosureImage';
import type { ReceiptData } from '../../lib/receiptData';
import { PosModal } from '../pos/PosModal';
import { ReceiptActions } from './ReceiptActions';
import { RECEIPT_BACKGROUND, ReceiptCard } from './ReceiptCard';
import { ReceiptPreview } from './ReceiptPreview';
import './receiptPrint.css';

const PRINT_ROOT_ID = 'receipt-print-root';
/** Clase en <html> que activa las reglas de impresión del comprobante (ver receiptPrint.css). */
const PRINTING_CLASS = 'printing-receipt';

/** Raíces de impresión montadas a la vez: la clase se quita solo al desmontar la última. */
let mountedPrintRoots = 0;

/** Marca <html> mientras exista la raíz de impresión, para que Ctrl+P en otras pantallas no salga en blanco. */
function usePrintingClass(): void {
  useEffect(() => {
    mountedPrintRoots += 1;
    document.documentElement.classList.add(PRINTING_CLASS);
    return () => {
      mountedPrintRoots -= 1;
      if (mountedPrintRoots === 0) document.documentElement.classList.remove(PRINTING_CLASS);
    };
  }, []);
}

/** Copia del comprobante fuera del diálogo (hijo de <body>) que es lo único que se imprime. */
function ReceiptPrintRoot({ data }: { data: ReceiptData }) {
  usePrintingClass();
  return createPortal(
    <div id={PRINT_ROOT_ID} aria-hidden="true">
      <ReceiptCard data={data} />
    </div>,
    document.body,
  );
}

function ReceiptBody({ data }: { data: ReceiptData }) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Clave estable: `data` es un objeto nuevo en cada render del padre y no debe regenerar el PNG.
  // El comprobante solo cambia de contenido al anularse la venta.
  const imageKey = `${data.saleId}:${data.voided}`;
  // La altura cambia según las líneas: el PNG se mide del propio nodo (576 px de ancho).
  const image = useClosureImage(cardRef, imageKey, { size: 'auto', backgroundColor: RECEIPT_BACKGROUND });
  return (
    <div className="flex flex-col gap-4">
      <ReceiptPreview ref={cardRef} data={data} />
      <div className="sticky -bottom-4 z-10 -mx-4 border-t-2 border-border bg-surface px-4 pb-4 pt-3 sm:-bottom-5 sm:-mx-5 sm:px-5 sm:pb-5">
        <ReceiptActions image={image} data={data} onPrint={() => window.print()} />
      </div>
      <ReceiptPrintRoot data={data} />
    </div>
  );
}

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData;
}

/** Comprobante de una venta: vista previa y acciones de compartir, descargar PNG e imprimir. */
export function ReceiptDialog({ open, onOpenChange, data }: ReceiptDialogProps) {
  return (
    <PosModal
      open={open}
      onOpenChange={onOpenChange}
      placement="sheet"
      title={`Comprobante · Venta #${data.number}`}
      description="Compártelo por WhatsApp, descárgalo como imagen o imprímelo."
    >
      <ReceiptBody data={data} />
    </PosModal>
  );
}
