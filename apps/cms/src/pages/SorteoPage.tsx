import { useState } from 'react';
import { Dices, Trophy } from 'lucide-react';
import { useRaffleDraws, useRaffleEntries } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { api } from '../lib/api';
import { toastSuccess } from '../store/toastStore';
import { formatDateTime } from '../lib/format';
import { fieldClassName } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export function SorteoPage() {
  const [period, setPeriod] = useState(currentPeriod);

  const { data: entries, loading: loadingEntries, error: entriesError, refetch: refetchEntries } =
    useRaffleEntries(period);
  const { data: draws, loading: loadingDraws, error: drawsError, refetch: refetchDraws } = useRaffleDraws();
  const { mutate: draw, loading: drawing } = useMutation(() => api.post('/raffle/draw', { period }));

  const alreadyDrawn = draws?.items.some((d) => d.period === period) ?? false;

  async function handleDraw() {
    if (!window.confirm(`¿Sortear el ganador del período ${period}? No se puede deshacer.`)) return;
    const result = await draw();
    if (result !== undefined) {
      toastSuccess('¡Sorteo realizado!');
      refetchDraws();
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Sorteo mensual</h1>
        <p className="text-sm text-text-muted">
          Cada pedido confirmado suma una entrada automática al sorteo del mes.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Dices className="size-5 text-primary" />
          <CardTitle>Sortear</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="raffle-period" className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
              Período
            </label>
            <input
              id="raffle-period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={fieldClassName}
            />
          </div>

          {loadingEntries && <Skeleton className="h-6 w-40" />}
          {entriesError && <ErrorState message={entriesError} onRetry={refetchEntries} />}
          {!loadingEntries && !entriesError && entries && (
            <p role="status" className="text-sm text-text-muted">
              {entries.total === 0
                ? 'Todavía no hay entradas para este período.'
                : `${entries.total} entrada${entries.total === 1 ? '' : 's'} en este período.`}
            </p>
          )}

          {alreadyDrawn && (
            <p role="status" className="text-sm font-semibold text-success">
              Este período ya tiene un ganador sorteado (ver historial abajo).
            </p>
          )}

          <Button
            type="button"
            variant="accent"
            loading={drawing}
            disabled={!entries || entries.total === 0 || alreadyDrawn}
            onClick={handleDraw}
            className="self-start"
          >
            <Trophy className="size-4" />
            Sortear ganador
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-display text-lg font-bold text-text">Historial de sorteos</h2>
        <div className="mt-3">
          {loadingDraws && <Skeleton className="h-32 w-full rounded-xl2" />}
          {drawsError && <ErrorState message={drawsError} onRetry={refetchDraws} />}
          {!loadingDraws && !drawsError && draws && draws.items.length === 0 && (
            <EmptyState title="Todavía no hay sorteos" description="El primer sorteo va a aparecer acá." />
          )}
          {!loadingDraws && !drawsError && draws && draws.items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {draws.items.map((d) => (
                <li key={d.id}>
                  <Card className="flex-row items-center justify-between p-3">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-semibold text-text">Período {d.period}</p>
                      <p className="text-xs text-text-muted">
                        Cliente #{d.winnerCustomerId} · sorteado el {formatDateTime(d.drawnAt)}
                      </p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
