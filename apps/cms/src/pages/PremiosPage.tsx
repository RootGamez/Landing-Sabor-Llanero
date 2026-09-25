import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Gift, ImageUp, Pencil, Trash2 } from 'lucide-react';
import type { Reward } from '@sabor/shared';
import { ALLOWED_MEDIA_MIME, MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB } from '@sabor/shared';
import { useRewards } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { api } from '../lib/api';
import { mediaUrl } from '../lib/format';
import { toastError, toastSuccess } from '../store/toastStore';
import { TextField, TextAreaField } from '../components/ui/FormField';
import { NumberField } from '../components/ui/NumberField';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';

interface RewardFormValues {
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  pointsCost: number | null;
  isActive: boolean;
}

const EMPTY_FORM: RewardFormValues = {
  nameEs: '',
  nameEn: '',
  descriptionEs: '',
  descriptionEn: '',
  pointsCost: null,
  isActive: true,
};

export function PremiosPage() {
  const { data: rewards, loading, error, refetch } = useRewards();
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Premios</h1>
          <p className="text-sm text-text-muted">Catálogo de premios canjeables por puntos.</p>
        </div>
        <Button variant="accent" onClick={() => setCreating(true)}>
          <Gift className="size-4" />
          Nuevo premio
        </Button>
      </div>

      <div>
        {loading && <TableSkeleton />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && rewards && rewards.length === 0 && (
          <EmptyState title="No hay premios" description="Creá el primero con el botón de arriba." />
        )}
        {!loading && !error && rewards && rewards.length > 0 && (
          <ul className="flex flex-col gap-3">
            {rewards.map((reward) => (
              <li key={reward.id}>
                <RewardCard reward={reward} onEdit={() => setEditingReward(reward)} onChanged={refetch} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <RewardFormDialog
        mode="create"
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={refetch}
      />
      <RewardFormDialog
        mode="edit"
        reward={editingReward}
        open={editingReward !== null}
        onClose={() => setEditingReward(null)}
        onSaved={refetch}
      />
    </div>
  );
}

interface RewardCardProps {
  reward: Reward;
  onEdit: () => void;
  onChanged: () => void;
}

function RewardCard({ reward, onEdit, onChanged }: RewardCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { mutate: remove } = useMutation(() => api.delete(`/rewards/${reward.id}`));

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MEDIA_MIME[file.type] || ALLOWED_MEDIA_MIME[file.type]?.type !== 'image') {
      toastError('Tipo de archivo no permitido (usar JPG, PNG, WebP o GIF)');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
      toastError(`El archivo supera el máximo de ${MEDIA_MAX_UPLOAD_MB} MB`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/rewards/${reward.id}/image`, formData);
      toastSuccess('Imagen actualizada');
      onChanged();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar "${reward.nameEs}"? Esta acción no se puede deshacer.`)) return;
    const result = await remove();
    if (result !== undefined) {
      toastSuccess('Premio eliminado');
      onChanged();
    }
  }

  return (
    <Card className="flex-row items-center gap-4 p-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-busy={uploading || undefined}
        aria-label={`Cambiar imagen de ${reward.nameEs}`}
        className="relative size-16 shrink-0 overflow-hidden rounded-xl2 border-2 border-border bg-surface-dark disabled:opacity-50"
      >
        {reward.imageR2Key ? (
          <img src={mediaUrl(reward.imageR2Key)} alt="" className="size-full object-cover" />
        ) : (
          <ImageUp className="m-auto size-6 text-text-muted" />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleUpload}
        className="hidden"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-semibold text-text">{reward.nameEs}</p>
        <div className="flex items-center gap-2">
          <Badge variant="sky" className="w-fit">
            {reward.pointsCost} pts
          </Badge>
          {!reward.isActive && (
            <Badge variant="muted" className="w-fit">
              Inactivo
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${reward.nameEs}`}
          className="rounded-lg p-2 text-text-muted transition-colors hover:text-text"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Eliminar ${reward.nameEs}`}
          className="rounded-lg p-2 text-text-muted transition-colors hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </Card>
  );
}

type RewardFormDialogProps =
  | { mode: 'create'; open: boolean; onClose: () => void; onSaved: () => void }
  | { mode: 'edit'; reward: Reward | null; open: boolean; onClose: () => void; onSaved: () => void };

function RewardFormDialog(props: RewardFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogTitle>{props.mode === 'create' ? 'Nuevo premio' : 'Editar premio'}</DialogTitle>
        <DialogDescription>Nombre, descripción y costo en puntos.</DialogDescription>
        {props.mode === 'create' && props.open && (
          <RewardForm key="create" onClose={props.onClose} onSaved={props.onSaved} />
        )}
        {props.mode === 'edit' && props.reward && (
          <RewardForm key={props.reward.id} reward={props.reward} onClose={props.onClose} onSaved={props.onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RewardForm({
  reward,
  onClose,
  onSaved,
}: {
  reward?: Reward;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<RewardFormValues>(
    reward
      ? {
          nameEs: reward.nameEs,
          nameEn: reward.nameEn,
          descriptionEs: reward.descriptionEs,
          descriptionEn: reward.descriptionEn,
          pointsCost: reward.pointsCost,
          isActive: reward.isActive,
        }
      : EMPTY_FORM,
  );

  const { mutate: save, loading: saving } = useMutation(() =>
    reward
      ? api.patch(`/rewards/${reward.id}`, values)
      : api.post('/rewards', values),
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = await save();
    if (result !== undefined) {
      toastSuccess(reward ? 'Premio actualizado' : 'Premio creado');
      onSaved();
      onClose();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Nombre (español)"
          required
          value={values.nameEs}
          onChange={(e) => setValues((v) => ({ ...v, nameEs: e.target.value }))}
        />
        <TextField
          label="Nombre (inglés)"
          hint="Vacío = se muestra el nombre en español."
          value={values.nameEn}
          onChange={(e) => setValues((v) => ({ ...v, nameEn: e.target.value }))}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextAreaField
          label="Descripción (español)"
          value={values.descriptionEs}
          onChange={(e) => setValues((v) => ({ ...v, descriptionEs: e.target.value }))}
        />
        <TextAreaField
          label="Descripción (inglés)"
          value={values.descriptionEn}
          onChange={(e) => setValues((v) => ({ ...v, descriptionEn: e.target.value }))}
        />
      </div>
      <NumberField
        label="Costo en puntos"
        required
        min={1}
        value={values.pointsCost}
        onValueChange={(pointsCost) => setValues((v) => ({ ...v, pointsCost }))}
        suffix="pts"
      />
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- texto anidado bajo
          <label> (label > span.flex-col > span), mismo patrón ya usado en MenuItemFormPage.tsx. */}
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl2 border-2 border-border bg-surface p-4">
        <span className="flex flex-col">
          <span className="text-sm font-bold text-text">Premio activo</span>
          <span className="text-xs text-text-muted">Visible y canjeable para los clientes.</span>
        </span>
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
          className="size-5 accent-primary"
        />
      </label>

      <Button type="submit" loading={saving} className="self-start">
        {reward ? 'Guardar cambios' : 'Crear premio'}
      </Button>
    </form>
  );
}
