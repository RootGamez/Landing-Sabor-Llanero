import { useState, type FormEvent } from 'react';
import { KeyRound, CircleUser } from 'lucide-react';
import {
  FULL_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  fullNameError,
  normalizeFullName,
  passwordConfirmError,
  passwordError,
  type ChangePasswordResponse,
  type User,
} from '@sabor/shared';
import { useMutation } from '../hooks/useMutation';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../lib/api';
import { toastSuccess } from '../store/toastStore';
import { TextField, PasswordField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

/** Perfil propio (cualquier rol): editar nombre y cambiar la contraseña. */
export function ProfilePage() {
  const user = useSessionStore((s) => s.user);
  const setSession = useSessionStore((s) => s.setSession);

  const [name, setName] = useState(user?.name ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Un nombre antiguo (ej. una sola palabra) no bloquea guardar: la regla solo aplica si se modificó.
  const nameChanged = normalizeFullName(name) !== normalizeFullName(user?.name ?? '');
  const nameFields = useFieldErrors({
    name: nameChanged ? fullNameError(name) : null,
  });
  const passwordFields = useFieldErrors({
    currentPassword: currentPassword ? null : 'Ingresa tu contraseña actual',
    newPassword:
      passwordError(newPassword) ??
      (newPassword === currentPassword ? 'La nueva contraseña debe ser distinta de la actual' : null),
    confirmPassword: passwordConfirmError(newPassword, confirmPassword),
  });

  const { mutate: saveName, loading: savingName } = useMutation(() =>
    api.patch<User>('/auth/me', { name: normalizeFullName(name) }),
  );
  const { mutate: changePassword, loading: changingPassword } = useMutation(() =>
    api.post<ChangePasswordResponse>('/auth/change-password', { currentPassword, newPassword }),
  );

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    if (!nameFields.validate()) return;
    if (!nameChanged) return; // nada que guardar
    const result = await saveName();
    // Se lee el store DESPUÉS del await: si mientras tanto se cambió la contraseña (token nuevo),
    // escribir el `token`/`user` capturados al renderizar pisaría la sesión nueva con la vieja.
    const { token: currentToken, user: currentUser } = useSessionStore.getState();
    if (result !== undefined && currentToken && currentUser) {
      // El store guarda el nombre para el sidebar; el token no cambia.
      setSession(currentToken, { ...currentUser, name: result.name });
      setName(result.name);
      nameFields.reset();
      toastSuccess('Perfil actualizado');
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!passwordFields.validate()) return;
    const result = await changePassword();
    if (result !== undefined && user) {
      // El backend invalidó todos los tokens anteriores; adoptamos el nuevo
      // para que esta sesión siga viva.
      setSession(result.token, user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      passwordFields.reset();
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
          <form onSubmit={handleSaveName} noValidate className="flex flex-col gap-3">
            <TextField
              id="name"
              label="Nombre y apellido"
              autoComplete="name"
              required
              maxLength={FULL_NAME_MAX}
              error={nameFields.error('name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => nameFields.touch('name')}
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
          <form onSubmit={handleChangePassword} noValidate className="flex flex-col gap-3">
            <PasswordField
              id="currentPassword"
              label="Contraseña actual"
              autoComplete="current-password"
              required
              maxLength={PASSWORD_MAX}
              error={passwordFields.error('currentPassword')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              onBlur={() => passwordFields.touch('currentPassword')}
            />
            <PasswordField
              id="newPassword"
              label="Nueva contraseña"
              autoComplete="new-password"
              required
              maxLength={PASSWORD_MAX}
              hint={`Mínimo ${PASSWORD_MIN} caracteres. Puedes usar una frase larga.`}
              error={passwordFields.error('newPassword')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onBlur={() => passwordFields.touch('newPassword')}
            />
            <PasswordField
              id="confirmPassword"
              label="Repite la nueva contraseña"
              autoComplete="new-password"
              required
              maxLength={PASSWORD_MAX}
              error={passwordFields.error('confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => passwordFields.touch('confirmPassword')}
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
