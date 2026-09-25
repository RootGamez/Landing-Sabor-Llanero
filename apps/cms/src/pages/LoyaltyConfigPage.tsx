import { useEffect, useState } from 'react';
import { useLoyaltyConfig } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { api } from '../lib/api';
import { toastSuccess } from '../store/toastStore';
import { NumberField } from '../components/ui/NumberField';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';

export function LoyaltyConfigPage() {
  const { data: config, loading, error, refetch } = useLoyaltyConfig();
  const [pointsPerCurrencyUnit, setPointsPerCurrencyUnit] = useState<number | null>(null);
  const [minOrderAmountForPoints, setMinOrderAmountForPoints] = useState<number | null>(null);

  useEffect(() => {
    if (config) {
      setPointsPerCurrencyUnit(config.pointsPerCurrencyUnit);
      setMinOrderAmountForPoints(config.minOrderAmountForPoints);
    }
  }, [config]);

  const { mutate, loading: saving } = useMutation(() =>
    api.patch('/loyalty-config', { pointsPerCurrencyUnit, minOrderAmountForPoints }),
  );

  if (loading) return <Skeleton className="h-64 w-full max-w-xl" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold text-text">Configuración de puntos</h1>
      <p className="mt-1 text-sm text-text-muted">
        Cuántos puntos gana un cliente por cada sol gastado en un pedido confirmado, y el monto
        mínimo de compra para empezar a sumar.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <NumberField
          label="Puntos por sol"
          min={0.01}
          step={0.01}
          value={pointsPerCurrencyUnit}
          onValueChange={setPointsPerCurrencyUnit}
          hint="Ej: 1 = un punto por cada sol gastado."
        />
        <NumberField
          label="Compra mínima para sumar puntos"
          min={0}
          step={0.01}
          value={minOrderAmountForPoints}
          onValueChange={setMinOrderAmountForPoints}
          prefix="S/"
          hint="0 = todas las compras confirmadas suman puntos, sin mínimo."
        />
        <Button
          type="button"
          loading={saving}
          className="self-start"
          onClick={async () => {
            const result = await mutate();
            if (result !== undefined) {
              toastSuccess('Configuración guardada');
              refetch();
            }
          }}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
