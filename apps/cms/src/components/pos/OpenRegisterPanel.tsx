import { useState, type FormEvent } from 'react';
import { Landmark } from 'lucide-react';
import { useMutation } from '../../hooks/useMutation';
import { openCashSession } from '../../lib/posApi';
import { parseSolesToCents } from '../../lib/posCart';
import { toastSuccess } from '../../store/toastStore';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface OpenRegisterPanelProps {
  /** Se llama tras abrir (o al detectar que ya hay una caja abierta) para recargar el estado. */
  onChanged: () => void;
}

/** Sin caja abierta no se vende (D3): pide el efectivo inicial y abre el turno. */
export function OpenRegisterPanel({ onChanged }: OpenRegisterPanelProps) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const { mutate, loading } = useMutation(openCashSession);
  const cents = parseSolesToCents(text);
  const error = touched && cents === null ? 'Escribe el efectivo inicial; si no hay, escribe 0.' : undefined;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (cents === null) return;
    const session = await mutate(cents);
    if (session) toastSuccess('Caja abierta');
    // También se recarga ante un error: puede que otra persona ya haya abierto la caja.
    onChanged();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col pt-4 sm:pt-12">
      <Card>
        <CardHeader>
          <Landmark className="size-8 text-primary" aria-hidden="true" />
          <CardTitle className="text-2xl">Abrir caja</CardTitle>
          <p className="text-sm text-text-muted">
            Cuenta el efectivo con el que empiezas el turno. Sin caja abierta no se pueden registrar ventas.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pos-opening-cash"
                className="text-xs font-bold font-display uppercase tracking-wide text-text-muted"
              >
                Efectivo inicial (S/)
              </label>
              <input
                id="pos-opening-cash"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- única acción de la pantalla; el cajero escribe de inmediato.
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="0.00"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'pos-opening-cash-error' : undefined}
                className="h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-2xl font-bold tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
              {error && (
                <p id="pos-opening-cash-error" role="alert" className="text-xs font-medium text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" size="lg" className="h-14 w-full text-base" loading={loading}>
              Abrir caja
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
