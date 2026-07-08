import { useRef, useState, type ChangeEvent } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Upload } from 'lucide-react';
import type { MenuItemMedia } from '@sabor/shared';
import { ALLOWED_MEDIA_MIME, MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB } from '@sabor/shared';
import { useMutation } from '../../hooks/useMutation';
import { api } from '../../lib/api';
import { mediaUrl } from '../../lib/format';
import { toastError, toastSuccess } from '../../store/toastStore';
import { Button } from '../ui/Button';

interface MediaManagerProps {
  itemId: number;
  media: MenuItemMedia[];
  onChange: () => void;
}

/**
 * Subida, reordenamiento y borrado de imágenes/video de un ítem del menú.
 * Valida MIME y tamaño con las mismas reglas de @sabor/shared que aplica la
 * API, para evitar viajes de ida y vuelta con archivos inválidos.
 */
export function MediaManager({ itemId, media, onChange }: MediaManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { mutate: remove } = useMutation((id: number) => api.delete(`/media/${id}`));
  const { mutate: reorder } = useMutation((id: number, displayOrder: number) =>
    api.patch(`/media/${id}/order`, { displayOrder }),
  );

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MEDIA_MIME[file.type]) {
      toastError('Tipo de archivo no permitido (usar JPG, PNG, WebP, GIF, MP4 o WebM)');
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
      await api.post(`/menu-items/${itemId}/media`, formData);
      toastSuccess('Media subida');
      onChange();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove(id: number) {
    if (!window.confirm('¿Eliminar esta imagen/video?')) return;
    const result = await remove(id);
    if (result !== undefined) {
      toastSuccess('Media eliminada');
      onChange();
    }
  }

  async function handleMove(item: MenuItemMedia, direction: -1 | 1) {
    const sorted = [...media].sort((a, b) => a.displayOrder - b.displayOrder);
    const index = sorted.findIndex((m) => m.id === item.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;
    await Promise.all([
      reorder(item.id, swapWith.displayOrder),
      reorder(swapWith.id, item.displayOrder),
    ]);
    onChange();
  }

  const sorted = [...media].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {sorted.map((item, i) => (
          <div
            key={item.id}
            className="group relative aspect-square overflow-hidden rounded-xl border-2 border-border bg-border"
          >
            {item.type === 'video' ? (
              <video src={mediaUrl(item.r2Key)} className="h-full w-full object-cover" muted />
            ) : (
              <img src={mediaUrl(item.r2Key)} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-surface-dark/0 opacity-0 transition-opacity group-hover:bg-surface-dark/60 group-hover:opacity-100">
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => handleMove(item, -1)}
                  aria-label="Mover antes"
                  className="rounded-lg bg-white/90 p-1.5 text-forest disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={i === sorted.length - 1}
                  onClick={() => handleMove(item, 1)}
                  aria-label="Mover después"
                  className="rounded-lg bg-white/90 p-1.5 text-forest disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                aria-label="Eliminar media"
                className="flex items-center gap-1 rounded-lg bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground"
              >
                <Trash2 className="size-3.5" />
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
          id="media-upload"
        />
        <Button
          type="button"
          variant="secondary"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          Subir imagen/video
        </Button>
      </div>
    </div>
  );
}
