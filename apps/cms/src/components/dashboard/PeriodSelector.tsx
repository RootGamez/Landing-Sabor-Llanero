import { isValidLocalDate, type ReportRange } from '@sabor/shared';
import { DateRangePicker } from '../ui/DateRangePicker';
import { cn } from '../../lib/utils';
import { PERIOD_OPTIONS, formatRangeLabel, type PeriodKey } from '../../lib/dashboardFormat';

interface PeriodSelectorProps {
  period: PeriodKey;
  range: ReportRange;
  onChange: (key: PeriodKey, range: ReportRange) => void;
}

/** Evita rangos absurdos mientras se teclea el año (0002, 0020…). */
const MIN_DATE = '2020-01-01';

/** Rango elegido: solo se aplica si ambos días son reales y posteriores al mínimo. */
function isApplicable(range: ReportRange): boolean {
  return isValidLocalDate(range.from) && isValidLocalDate(range.to) && range.from >= MIN_DATE && range.from <= range.to;
}

export function PeriodSelector({ period, range, onChange }: PeriodSelectorProps) {
  const handleRange = (next: ReportRange) => {
    if (isApplicable(next)) onChange('personalizado', next);
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
        <DateRangePicker
          label="Rango personalizado"
          value={range}
          onValueChange={handleRange}
          presets={[]}
          min={MIN_DATE}
          className="max-w-xs"
        />
      )}
      <p className="text-sm text-text-muted" aria-live="polite">
        Mostrando {formatRangeLabel(range)} (hora de Lima)
      </p>
    </div>
  );
}
