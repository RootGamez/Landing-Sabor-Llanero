import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { LoginResponse } from '@sabor/shared';
import { BRAND } from '@sabor/shared';
import { api, ApiError } from '../lib/api';
import { API_BASE_URL } from '../lib/env';
import { useSessionStore } from '../store/sessionStore';
import { TextField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';

export function LoginPage() {
  const token = useSessionStore((s) => s.token);
  const setSession = useSessionStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token: newToken } = await api.post<LoginResponse>('/auth/login', { email, password });

      // Fetch directo (no vía lib/api) porque todavía no guardamos el token en
      // el store — el cliente de lib/api toma el token del store, que recién
      // se setea después de tener los datos del usuario.
      const meRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      if (!meRes.ok) throw new ApiError(meRes.status, 'No se pudo obtener el usuario');
      const me = (await meRes.json()) as { id: number; email: string; name: string; role: 'owner' | 'admin' };

      setSession(newToken, me);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dark px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-lg"
        aria-labelledby="login-title"
      >
        <div className="mx-auto w-fit rounded-xl bg-surface-dark px-5 py-3">
          <img src="/logo.svg" alt="" width="240" height="110" className="h-12 w-auto" />
        </div>
        <h1 id="login-title" className="mt-3 text-center text-lg font-bold text-text">
          {BRAND.name} · Admin
        </h1>
        <p className="mt-1 text-center text-sm text-text-muted">Iniciá sesión para gestionar el menú.</p>

        <div className="mt-6 flex flex-col gap-4">
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Contraseña"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="mt-6 w-full">
          Ingresar
        </Button>
      </form>
    </div>
  );
}
