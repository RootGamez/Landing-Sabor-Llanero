import { useMemo, useState } from 'react';
import { ClipboardCopy, Download, Loader2, Share2 } from 'lucide-react';
import { BRAND } from '@sabor/shared';
import type { ClosureImage } from '../../hooks/useClosureImage';
import { canShareFile, copyText, downloadBlob, shareFile, toPngFile } from '../../lib/closureShare';
import { toastError, toastSuccess } from '../../store/toastStore';
import { Button } from '../ui/Button';

interface ExpenseShareActionsProps {
  image: ClosureImage;
  fileName: string;
  text: string;
}

/** Compartir (hoja del sistema, p. ej. WhatsApp en el celular), descargar el PNG o copiar el resumen en texto. */
export function ExpenseShareActions({ image, fileName, text }: ExpenseShareActionsProps) {
  const [busy, setBusy] = useState(false);
  const file = useMemo(() => (image.blob ? toPngFile(image.blob, fileName) : null), [image.blob, fileName]);
  const canShare = file !== null && canShareFile(file);
  const ready = image.status === 'ready' && file !== null;

  async function handleShare() {
    if (!file) return;
    setBusy(true);
    try {
      await shareFile(file, `Egresos — ${BRAND.name}`, text);
    } catch {
      toastError('No se pudo abrir el menú de compartir. Descarga la imagen e inténtalo desde WhatsApp.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    try {
      await copyText(text);
      toastSuccess('Resumen copiado. Pégalo en WhatsApp.');
    } catch {
      toastError('No se pudo copiar. Selecciona el texto del resumen y cópialo manualmente.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {canShare && (
          <Button size="lg" onClick={handleShare} loading={busy} className="max-sm:w-full">
            <Share2 aria-hidden="true" />
            Compartir
          </Button>
        )}
        <Button
          size="lg"
          variant={canShare ? 'outline' : 'primary'}
          onClick={() => image.blob && downloadBlob(image.blob, fileName)}
          disabled={!ready}
          className="max-sm:w-full"
        >
          {image.status === 'loading' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          Descargar PNG
        </Button>
        <Button size="lg" variant="outline" onClick={handleCopy} className="max-sm:w-full">
          <ClipboardCopy aria-hidden="true" />
          Copiar resumen en texto
        </Button>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-text-muted">
        {image.status === 'loading' && 'Preparando la imagen…'}
        {image.status === 'ready' && !canShare && 'Este navegador no comparte imágenes directamente: descarga el PNG o copia el resumen.'}
        {image.status === 'error' && 'No se pudo generar la imagen.'}
      </p>
      {image.status === 'error' && (
        <Button variant="outline" size="sm" className="self-start" onClick={image.regenerate}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
