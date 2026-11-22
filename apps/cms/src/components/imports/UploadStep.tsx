import { useId, useState, type DragEvent } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import type { HomebankDateFormat } from '@sabor/shared';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { ACCEPTED_EXTENSIONS, MAX_IMPORT_FILE_BYTES } from './importUtils';

interface UploadStepProps {
  busy: boolean;
  error: string | null;
  fileName: string | null;
  needsDateFormat: boolean;
  dateFormat: HomebankDateFormat | null;
  onFile: (file: File) => void;
  onDateFormat: (format: HomebankDateFormat) => void;
}

const DATE_FORMATS: ReadonlyArray<{ value: HomebankDateFormat; label: string; example: string }> = [
  { value: 'DD/MM', label: 'Día/Mes', example: '25/05/2025 es 25 de mayo' },
  { value: 'MM/DD', label: 'Mes/Día', example: '05/25/2025 es 25 de mayo' },
];

/** Paso 1: arrastrar o elegir el archivo. El input real queda accesible por teclado dentro del label. */
export function UploadStep({ busy, error, fileName, needsDateFormat, dateFormat, onFile, onDateFormat }: UploadStepProps) {
  const inputId = useId();
  const errorId = useId();
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped && !busy) onFile(dropped);
  }

  return (
    <div className="flex flex-col gap-5">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl2 border-2 border-dashed bg-surface p-6 text-center transition-colors',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:border-primary',
          isDragging ? 'border-primary bg-muted' : 'border-border',
          busy && 'pointer-events-none opacity-70',
        )}
      >
        {busy ? (
          <Loader2 className="size-9 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <FileUp className="size-9 text-primary" aria-hidden="true" />
        )}
        <span className="font-display text-base font-bold text-text">
          {busy ? 'Leyendo el archivo…' : 'Arrastra tu archivo aquí o toca para elegirlo'}
        </span>
        <span className="text-sm text-text-muted">
          HomeBank, formato .xhb o .csv · máximo {MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB
        </span>
        {fileName && !busy ? <span className="text-sm font-medium text-text">Archivo: {fileName}</span> : null}
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          disabled={busy}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) onFile(chosen);
            event.target.value = '';
          }}
        />
      </label>

      {error ? (
        <p id={errorId} role="alert" className="rounded-xl border-2 border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {needsDateFormat ? (
        <fieldset className="flex flex-col gap-3 rounded-xl2 border-2 border-border bg-card p-4">
          <legend className="px-1 font-display text-sm font-bold text-text">¿En qué orden vienen las fechas del CSV?</legend>
          <p className="text-sm text-text-muted">
            Algunas fechas podrían leerse de dos maneras. Elige el formato de tu archivo y lo volvemos a leer.
          </p>
          <div className="flex flex-wrap gap-3">
            {DATE_FORMATS.map((format) => (
              <Button
                key={format.value}
                variant={dateFormat === format.value ? 'primary' : 'outline'}
                aria-pressed={dateFormat === format.value}
                loading={busy && dateFormat === format.value}
                disabled={busy}
                onClick={() => onDateFormat(format.value)}
                aria-describedby={`${inputId}-${format.value.replace('/', '')}`}
              >
                {format.label}
              </Button>
            ))}
          </div>
          <ul className="text-xs text-text-muted">
            {DATE_FORMATS.map((format) => (
              <li key={format.value} id={`${inputId}-${format.value.replace('/', '')}`}>
                {format.label}: {format.example}
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
    </div>
  );
}
