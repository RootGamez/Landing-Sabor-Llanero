import { useState, type FormEvent } from 'react';
import { KeyRound, CircleUser } from 'lucide-react';
import type { ChangePasswordResponse, User } from '@sabor/shared';
import { useMutation } from '../hooks/useMutation';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../lib/api';
import { toastSuccess, toastError } from '../store/toastStore';
import { TextField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

/** Perfil propio (cualquier rol): editar nombre y cambiar la contraseña. */
export function ProfilePage() {
  const token = useSessionStore((s) => s.token);
  const user = useSessionStore((s) => s.user);
  const setSession = useSessionStore((s) => s.setSession);

  const [name, setName] = useState(user?.name ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { mutate: saveName, loading: savingName } = useMutation(() =>
    api.patch<User>('/auth/me', { name }),
  );
  const { mutate: changePassword, loading: changingPassword } = useMutation(() =>
    api.post<ChangePasswordResponse>('/auth/change-password', { currentPassword, newPassword }),
  );

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    const result = await saveName();
    if (result !== undefined && token && user) {
      // El store guarda el nombre para el sidebar; el token no cambia.
      setSession(token, { ...user, name: result.name });
      toastSuccess('Perfil actualizado');
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toastError('La confirmación no coincide con la nueva contraseña');
      return;
    }
    const result = await changePassword();
    if (result !== undefined && user) {
      // El backend invalidó todos los tokens anteriores; adoptamos el nuevo
      // para que esta sesión siga viva.
      setSession(result.token, user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toastSuccess('Contraseña actualizada. Tus otras sesiones fueron cerradas.');
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Mi perfil</h1>
        <p className="text-sm text-text-muted">
          {user?.email}{' '}
          <Badge variant={user?.role === 'owner' ? 'primary' : 'outline'} className="ml-1 align-middle">
            {user?.role}
          </Badge>
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <CircleUser className="size-5 text-primary" />
          <CardTitle>Datos personales</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="flex flex-col gap-3">
            <TextField
              label="Nombre"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" loading={savingName} className="self-start">
              Guardar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          <CardTitle>Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <TextField
              label="Contraseña actual"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <TextField
              label="Nueva contraseña (mínimo 8 caracteres)"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <TextField
              label="Confirmar nueva contraseña"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <p className="text-xs text-text-muted">
              Al cambiar la contraseña se cierran todas tus demás sesiones abiertas.
            </p>
            <Button type="submit" loading={changingPassword} className="self-start">
              Cambiar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
