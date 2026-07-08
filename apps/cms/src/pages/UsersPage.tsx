import { useState, type FormEvent } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import type { Role } from '@sabor/shared';
import { useUsers } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../lib/api';
import { toastSuccess } from '../store/toastStore';
import { formatDateTime } from '../lib/format';
import { TextField, SelectField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';

/** Solo owner (BLUEPRINT §1.6): gestión de cuentas del panel. */
export function UsersPage() {
  const { data: users, loading, error, refetch } = useUsers();
  const currentUser = useSessionStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('admin');

  const { mutate: create, loading: creating } = useMutation(() =>
    api.post('/users', { email, name, password, role }),
  );
  const { mutate: remove } = useMutation((id: number) => api.delete(`/users/${id}`));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = await create();
    if (result !== undefined) {
      toastSuccess('Usuario creado');
      setEmail('');
      setName('');
      setPassword('');
      setRole('admin');
      refetch();
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este usuario?')) return;
    const result = await remove(id);
    if (result !== undefined) {
      toastSuccess('Usuario eliminado');
      refetch();
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Usuarios</h1>
        <p className="text-sm text-text-muted">Administradores con acceso al panel.</p>
      </div>

      <div>
        {loading && <TableSkeleton />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && users && (
          <ul className="flex flex-col gap-2">
            {users.map((user) => (
              <li key={user.id}>
                <Card className="flex-row items-center justify-between p-3">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-text">
                      {user.name} <span className="font-normal text-text-muted">· {user.email}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.role === 'owner' ? 'primary' : 'outline'} className="w-fit">
                        {user.role}
                      </Badge>
                      <span className="text-xs text-text-muted">
                        {user.lastLoginAt
                          ? `Último acceso: ${formatDateTime(user.lastLoginAt)}`
                          : 'Nunca inició sesión'}
                      </span>
                    </div>
                  </div>
                  {user.id !== currentUser?.id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(user.id)}
                      aria-label={`Eliminar ${user.name}`}
                      className="rounded-lg p-2 text-text-muted transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <UserPlus className="size-5 text-primary" />
          <CardTitle>Nuevo admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <TextField label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
            <TextField
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Contraseña"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <SelectField label="Rol" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </SelectField>
            <Button type="submit" loading={creating} className="self-start">
              Crear usuario
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
