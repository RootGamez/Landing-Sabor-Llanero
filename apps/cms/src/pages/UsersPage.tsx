import { useState, type FormEvent } from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import {
  EMAIL_MAX,
  FULL_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  emailError,
  fullNameError,
  normalizeEmail,
  normalizeFullName,
  passwordConfirmError,
  passwordError,
  type Role,
  type User,
} from '@sabor/shared';
import { useUsers } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../lib/api';
import { toastSuccess } from '../store/toastStore';
import { formatDateTime } from '../lib/format';
import { TextField, PasswordField, SelectField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';

/** Solo owner (BLUEPRINT §1.6): gestión de cuentas del panel. */
export function UsersPage() {
  const { data: users, loading, error, refetch } = useUsers();
  const currentUser = useSessionStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('admin');

  const fields = useFieldErrors({
    newUserName: fullNameError(name),
    newUserEmail: emailError(normalizeEmail(email)),
    newUserPassword: passwordError(password),
    newUserConfirm: passwordConfirmError(password, confirmPassword),
  });

  const { mutate: create, loading: creating } = useMutation(() =>
    api.post('/users', {
      email: normalizeEmail(email),
      name: normalizeFullName(name),
      password,
      role,
    }),
  );
  const { mutate: remove } = useMutation((id: number) => api.delete(`/users/${id}`));

  const [editingUser, setEditingUser] = useState<User | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fields.validate()) return;
    const result = await create();
    if (result !== undefined) {
      toastSuccess('Usuario creado');
      setEmail('');
      setName('');
      setPassword('');
      setConfirmPassword('');
      fields.reset();
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
                  {/* Autoedición vía ProfilePage, no acá: cambiar la propia contraseña o
                      degradarse de owner bumpea token_version y invalida el JWT en uso;
                      ProfilePage rota el token después del cambio, este PATCH no. */}
                  {user.id !== currentUser?.id && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingUser(user)}
                        aria-label={`Editar ${user.name}`}
                        className="rounded-lg p-2 text-text-muted transition-colors hover:text-text"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user.id)}
                        aria-label={`Eliminar ${user.name}`}
                        className="rounded-lg p-2 text-text-muted transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
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
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
            <TextField
              id="newUserName"
              label="Nombre y apellido"
              autoComplete="off"
              required
              maxLength={FULL_NAME_MAX}
              error={fields.error('newUserName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => fields.touch('newUserName')}
            />
            <TextField
              id="newUserEmail"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              required
              maxLength={EMAIL_MAX}
              error={fields.error('newUserEmail')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => fields.touch('newUserEmail')}
            />
            <PasswordField
              id="newUserPassword"
              label="Contraseña"
              autoComplete="new-password"
              required
              maxLength={PASSWORD_MAX}
              hint={`Mínimo ${PASSWORD_MIN} caracteres`}
              error={fields.error('newUserPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => fields.touch('newUserPassword')}
            />
            <PasswordField
              id="newUserConfirm"
              label="Repite la contraseña"
              autoComplete="new-password"
              required
              maxLength={PASSWORD_MAX}
              error={fields.error('newUserConfirm')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => fields.touch('newUserConfirm')}
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

      <EditUserDialog user={editingUser} onClose={() => setEditingUser(null)} onSaved={refetch} />
    </div>
  );
}

interface EditUserDialogProps {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Modal de edición: nombre, rol y contraseña opcional. El backend ya rechaza degradar al último owner. */
function EditUserDialog({ user, onClose, onSaved }: EditUserDialogProps) {
  function handleOpenChange(open: boolean) {
    if (!open) onClose();
  }

  return (
    <Dialog open={user !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogTitle>Editar usuario</DialogTitle>
        <DialogDescription>{user?.email}</DialogDescription>
        {/* key={user.id}: cada usuario abre una instancia nueva del form, con su
            propio estado inicial — evita el flash de datos del usuario anterior
            que da un `useEffect` sincronizando state desde props. */}
        {user && <EditUserForm key={user.id} user={user} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

interface EditUserFormProps {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}

function EditUserForm({ user, onClose, onSaved }: EditUserFormProps) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // El nombre solo se valida si se modificó (un nombre antiguo de una palabra no bloquea cambiar el rol).
  // La contraseña es opcional: si se escribe, se exige válida y repetida.
  const nameChanged = normalizeFullName(name) !== normalizeFullName(user.name);
  const fields = useFieldErrors({
    'edit-user-name': nameChanged ? fullNameError(name) : null,
    'edit-user-password': password ? passwordError(password) : null,
    'edit-user-confirm': password || confirmPassword ? passwordConfirmError(password, confirmPassword) : null,
  });

  const { mutate: update, loading: saving } = useMutation(() =>
    api.patch(`/users/${user.id}`, {
      // Solo si cambió: un nombre antiguo que ya no cumple las reglas no bloquea cambiar el rol.
      ...(nameChanged ? { name: normalizeFullName(name) } : {}),
      role,
      ...(password ? { password } : {}),
    }),
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fields.validate()) return;
    const result = await update();
    if (result !== undefined) {
      toastSuccess('Usuario actualizado');
      onSaved();
      onClose();
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <TextField
        id="edit-user-name"
        label="Nombre y apellido"
        required
        maxLength={FULL_NAME_MAX}
        error={fields.error('edit-user-name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => fields.touch('edit-user-name')}
      />
      <SelectField
        id="edit-user-role"
        label="Rol"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
      >
        <option value="admin">Admin</option>
        <option value="owner">Owner</option>
      </SelectField>
      <PasswordField
        id="edit-user-password"
        label="Contraseña nueva"
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        hint="Dejar en blanco para no cambiarla"
        error={fields.error('edit-user-password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onBlur={() => fields.touch('edit-user-password')}
      />
      <PasswordField
        id="edit-user-confirm"
        label="Repite la contraseña nueva"
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        hint="Solo si cambias la contraseña"
        error={fields.error('edit-user-confirm')}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        onBlur={() => fields.touch('edit-user-confirm')}
      />
      <Button type="submit" loading={saving} className="self-start">
        Guardar cambios
      </Button>
    </form>
  );
}
