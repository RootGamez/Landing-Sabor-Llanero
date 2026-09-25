import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { MessageResponse } from '@sabor/shared';
import { BRAND } from '@sabor/shared';
import { api, ApiError } from '../lib/api';
import { TextField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';

/** Pública (sin sesión), fuera de `Protected` en App.tsx. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  // Mueve el foco al mensaje de confirmación: el form (con el botón que
  // tenía el foco) desaparece del DOM y sin esto el foco cae a <body>,
  // perdiendo el lugar tanto para teclado como para lectores de pantalla.
  useEffect(() => {
    if (sent) statusRef.current?.focus();
  }, [sent]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // La API responde siempre el mismo mensaje exista o no la cuenta
      // (anti-enumeración) — acá solo se muestra tal cual, sin interpretarlo.
      await api.post<MessageResponse>('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud');
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
        <h1 id="forgot-title" className="mt-3 text-center text-lg font-bold text-text">
          {BRAND.name} · Admin
        </h1>

        {sent ? (
          <div ref={statusRef} tabIndex={-1} role="status" className="mt-6 flex flex-col gap-4 text-center outline-none">
            <p className="text-sm text-text">
              Si el email existe, vas a recibir un link para recuperar tu contraseña. Revisá tu
              bandeja de entrada (y spam).
            </p>
            <Link
              to="/login"
              className="inline-block py-2 text-sm font-semibold text-primary hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} aria-labelledby="forgot-title" className="mt-6">
            <p className="mb-4 text-center text-sm text-text-muted">
              Ingresá tu email y te mandamos un link para restablecer tu contraseña.
            </p>
            <TextField
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="mt-6 w-full">
              Enviar link de recuperación
            </Button>

            <Link
              to="/login"
              className="mt-4 block py-2 text-center text-sm font-semibold text-primary hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
