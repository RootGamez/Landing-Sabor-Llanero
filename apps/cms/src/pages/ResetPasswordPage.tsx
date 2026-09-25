import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { MessageResponse } from '@sabor/shared';
import { BRAND } from '@sabor/shared';
import { api, ApiError } from '../lib/api';
import { TextField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';

/**
 * Pública (sin sesión), fuera de `Protected` en App.tsx. El token viaja en el
 * fragment del link del email (`#token=...`), no en query string, para que
 * nunca llegue al servidor ni quede expuesto en un header Referer.
 */
function readTokenFromHash(): string | null {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
}

export function ResetPasswordPage() {
  const [token] = useState(readTokenFromHash);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  // Saca el token de la barra de direcciones apenas se captura en state: ya
  // cumplió su propósito (nunca llegó al servidor) y no tiene motivo para
  // seguir visible en el URL/historial del navegador.
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);

  // Mueve el foco al mensaje de "sin token" o "listo": en ambos casos el form
  // (o directamente todo el contenido inicial) no está en el DOM, así que sin
  // esto el foco cae a <body> y, en el caso "sin token", un alert presente ya
  // en el primer render no siempre se anuncia solo por su role.
  useEffect(() => {
    if (!token || done) messageRef.current?.focus();
  }, [token, done]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      await api.post<MessageResponse>('/auth/reset-password', { token, newPassword });
      setDone(true);
    } catch (err) {
      // La API devuelve el mismo mensaje genérico para token inválido, vencido
      // o ya usado — se muestra tal cual, sin intentar distinguir el motivo.
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dark px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-lg">
        <div className="mx-auto w-fit rounded-xl bg-surface-dark px-5 py-3">
          <img src="/logo.svg" alt="" width="240" height="110" className="h-12 w-auto" />
        </div>
        <h1 id="reset-title" className="mt-3 text-center text-lg font-bold text-text">
          {BRAND.name} · Admin
        </h1>

        {!token ? (
          <div
            ref={messageRef}
            tabIndex={-1}
            role="alert"
            className="mt-6 flex flex-col gap-4 text-center outline-none"
          >
            <p className="text-sm text-destructive">
              Este link de recuperación es inválido. Pedí uno nuevo para continuar.
            </p>
            <Link
              to="/forgot-password"
              className="inline-block py-2 text-sm font-semibold text-primary hover:underline"
            >
              Pedir un nuevo link
            </Link>
          </div>
        ) : done ? (
          <div
            ref={messageRef}
            tabIndex={-1}
            role="status"
            className="mt-6 flex flex-col gap-4 text-center outline-none"
          >
            <p className="text-sm text-text">Tu contraseña se actualizó correctamente.</p>
            <Link
              to="/login"
              className="inline-block py-2 text-sm font-semibold text-primary hover:underline"
            >
              Iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} aria-labelledby="reset-title" className="mt-6">
            <p className="mb-4 text-center text-sm text-text-muted">Elegí tu nueva contraseña.</p>
            <TextField
              label="Contraseña nueva"
              type="password"
              name="new-password"
              autoComplete="new-password"
              required
              minLength={8}
              hint="Mínimo 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            {error && (
              <div role="alert" className="mt-4 flex flex-col gap-2">
                <p className="text-sm text-destructive">{error}</p>
                <Link
                  to="/forgot-password"
                  className="inline-block py-2 text-sm font-semibold text-primary hover:underline"
                >
                  Pedir un nuevo link
                </Link>
              </div>
            )}

            <Button type="submit" loading={loading} className="mt-6 w-full">
              Actualizar contraseña
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
