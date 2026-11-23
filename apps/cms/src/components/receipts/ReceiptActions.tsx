import { useMemo, useState } from 'react';
import { Download, Loader2, Printer, Share2 } from 'lucide-react';
import { BRAND } from '@sabor/shared';
import type { ClosureImage } from '../../hooks/useClosureImage';
import { canShareFile, downloadBlob, shareFile, toPngFile } from '../../lib/closureShare';
import type { ReceiptData } from '../../lib/receiptData';
import { toastError } from '../../store/toastStore';
import { Button } from '../ui/Button';

interface ReceiptActionsProps {
  image: ClosureImage;
  data: ReceiptData;
  onPrint: () => void;
}

/**
 * Compartir (hoja del sistema, p. ej. WhatsApp en el celular), descargar el PNG
 * o imprimir. Misma mecánica que `ClosureActions`: la imagen ya viene generada.
 */
export function ReceiptActions({ image, data, onPrint }: ReceiptActionsProps) {
  const [busy, setBusy] = useState(false);
  const { fileName, shareText, number } = data;
  const file = useMemo(() => (image.blob ? toPngFile(image.blob, fileName) : null), [image.blob, fileName]);
  const canShare = file !== null && canShareFile(file);
  const ready = image.status === 'ready' && file !== null;

  async function handleShare() {
    if (!file) return;
    setBusy(true);
    try {
      await shareFile(file, `Comprobante de venta #${number} — ${BRAND.name}`, shareText);
    } catch {
      toastError('No se pudo abrir el menú de compartir. Descarga la imagen e inténtalo desde WhatsApp.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {canShare && (
          <Button onClick={handleShare} loading={busy} className="col-span-2 h-12 sm:col-span-1">
            <Share2 aria-hidden="true" />
            Compartir
          </Button>
        )}
        <Button
          variant={canShare ? 'outline' : 'primary'}
          onClick={() => image.blob && downloadBlob(image.blob, fileName)}
          disabled={!ready}
          className="h-12 px-3"
        >
          {image.status === 'loading' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          Descargar
        </Button>
        <Button variant="outline" onClick={onPrint} className="h-12 px-3">
          <Printer aria-hidden="true" />
          Imprimir
        </Button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-text-muted">
        {image.status === 'loading' && 'Preparando la imagen…'}
        {image.status === 'ready' && !canShare && 'Este navegador no comparte imágenes directamente: descarga el PNG o imprime.'}
        {image.status === 'error' && 'No se pudo generar la imagen. Puedes imprimir el comprobante.'}
      </p>
      {image.status === 'error' && (
        <Button variant="outline" size="sm" className="self-start" onClick={image.regenerate}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
