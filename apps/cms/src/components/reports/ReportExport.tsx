import { createContext, useCallback, useContext, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { BRAND, type ReportRange } from '@sabor/shared';
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { EXPORT_IGNORE_ATTR, downloadNodePng, exportFileName } from '../../lib/reportExport';
import { formatRangeLabel } from '../../lib/dashboardFormat';
import { toastError, toastSuccess } from '../../store/toastStore';
import { BrandLogo } from '../closures/BrandLogo';
import { cn } from '../../lib/utils';

interface ReportExporter {
  range: ReportRange;
  /** Baja el nodo como PNG; el título va en el nombre del archivo. */
  exportNode: (node: HTMLElement, title: string) => Promise<void>;
}

const ExportContext = createContext<ReportExporter | null>(null);

/** Exportador del reporte; `null` fuera de la página de reportes (los gráficos no muestran el botón). */
export const useReportExporter = (): ReportExporter | null => useContext(ExportContext);

interface ProviderProps {
  range: ReportRange;
  children: ReactNode;
}

export function ReportExportProvider({ range, children }: ProviderProps) {
  const exportNode = useCallback(
    async (node: HTMLElement, title: string) => {
      try {
        await downloadNodePng(node, exportFileName(title, range));
        toastSuccess('Imagen descargada');
      } catch {
        toastError('No se pudo generar la imagen. Inténtalo de nuevo.');
      }
    },
    [range],
  );
  const value = useMemo(() => ({ range, exportNode }), [range, exportNode]);
  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

/** Marca y rango: encabezado del reporte completo y pie de cada gráfica exportada. */
export function ReportBrandLine({ range, className }: { range: ReportRange; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2 text-xs font-semibold text-text-muted', className)}>
      <BrandLogo className="h-5 w-auto shrink-0" />
      <span>
        {BRAND.fullName} · {formatRangeLabel(range)} (hora de Lima)
      </span>
    </p>
  );
}

/** Encabezado del reporte completo: solo se ve en la imagen y en pantalla grande como membrete. */
export function ReportHeader({ range }: { range: ReportRange }) {
  return (
    <header className="flex items-center gap-3 border-b-2 border-border pb-3">
      <BrandLogo className="h-12 w-auto shrink-0" />
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold leading-tight text-text">Reporte financiero</h2>
        <p className="text-sm text-text-muted">
          {BRAND.fullName} · {formatRangeLabel(range)}
        </p>
      </div>
    </header>
  );
}

interface ExportButtonProps {
  targetRef: RefObject<HTMLElement | null>;
  title: string;
  /** "full" = botón con texto (todo el reporte); "icon" = botón pequeño de una gráfica. */
  variant: 'full' | 'icon';
  /** Se llama antes y después de capturar (la gráfica muestra su pie de marca solo durante la captura). */
  onCapturing?: (isCapturing: boolean) => void;
}

const NEXT_FRAME_DELAYS = 2;

const nextFrames = (count: number): Promise<void> =>
  new Promise((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(count);
  });

export function ExportButton({ targetRef, title, variant, onCapturing }: ExportButtonProps) {
  const exporter = useReportExporter();
  const [busy, setBusy] = useState(false);
  if (!exporter) return null;

  const handleClick = async () => {
    const node = targetRef.current;
    if (!node || busy) return;
    setBusy(true);
    onCapturing?.(true);
    await nextFrames(NEXT_FRAME_DELAYS);
    await exporter.exportNode(node, title);
    onCapturing?.(false);
    setBusy(false);
  };

  const Icon = busy ? Loader2 : variant === 'full' ? ImageIcon : Camera;
  const iconClass = cn('size-4', busy && 'animate-spin');
  const label = variant === 'full' ? 'Exportar imagen' : `Exportar imagen: ${title}`;
  return (
    <button
      type="button"
      {...{ [EXPORT_IGNORE_ATTR]: '' }}
      onClick={handleClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-border bg-card text-sm font-semibold text-text transition-colors hover:border-primary disabled:cursor-wait disabled:opacity-60',
        variant === 'full' ? 'px-4' : 'min-w-11',
      )}
    >
      <Icon aria-hidden="true" className={iconClass} />
      {variant === 'full' && <span>{busy ? 'Generando…' : 'Exportar imagen'}</span>}
    </button>
  );
}
