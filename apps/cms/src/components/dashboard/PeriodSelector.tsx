import { isValidLocalDate, type ReportRange } from '@sabor/shared';
import { TextField } from '../ui/FormField';
import { cn } from '../../lib/utils';
import { PERIOD_OPTIONS, formatRangeLabel, type PeriodKey } from '../../lib/dashboardFormat';

interface PeriodSelectorProps {
  period: PeriodKey;
  range: ReportRange;
  onChange: (key: PeriodKey, range: ReportRange) => void;
}

/** Evita rangos absurdos mientras se teclea el año (0002, 0020…). */
const MIN_DATE = '2020-01-01';

/** Fecha editada: solo se aplica si es un día real y el rango sigue ordenado. */
function applyDate(range: ReportRange, field: keyof ReportRange, value: string): ReportRange | null {
  if (!isValidLocalDate(value) || value < MIN_DATE) return null;
  const next = { ...range, [field]: value };
  return next.from <= next.to ? next : null;
}

export function PeriodSelector({ period, range, onChange }: PeriodSelectorProps) {
  const handleDate = (field: keyof ReportRange) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = applyDate(range, field, event.target.value);
    if (next) onChange('personalizado', next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((option) => {
          const isActive = option.key === period;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.key, range)}
              className={cn(
                'min-h-11 cursor-pointer rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-text hover:border-primary',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {period === 'personalizado' && (
        <div className="flex flex-wrap gap-3">
          <TextField label="Desde" type="date" value={range.from} min={MIN_DATE} max={range.to} onChange={handleDate('from')} />
          <TextField label="Hasta" type="date" value={range.to} min={range.from > MIN_DATE ? range.from : MIN_DATE} onChange={handleDate('to')} />
        </div>
      )}
      <p className="text-sm text-text-muted" aria-live="polite">
        Mostrando {formatRangeLabel(range)} (hora de Lima)
      </p>
    </div>
  );
}
