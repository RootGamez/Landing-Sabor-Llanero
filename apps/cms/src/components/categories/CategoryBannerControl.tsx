import { useRef, useState, type ChangeEvent } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import type { Category } from '@sabor/shared';
import { useMutation } from '../../hooks/useMutation';
import { api } from '../../lib/api';
import { mediaUrl } from '../../lib/format';
import { toastSuccess } from '../../store/toastStore';
import { Button } from '../ui/Button';

interface CategoryBannerControlProps {
  category: Category;
  onChange: () => void;
}

/**
 * Subida/reemplazo/eliminación del banner de una categoría (espejo del flujo
 * de MediaManager). El banner se muestra en el catálogo público como cabecera
 * de la sección de la categoría.
 */
export function CategoryBannerControl({ category, onChange }: CategoryBannerControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { mutate: removeBanner } = useMutation(() => api.delete(`/categories/${category.id}/banner`));

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/categories/${category.id}/banner`, formData);
      toastSuccess('Banner actualizado');
      onChange();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (!window.confirm('¿Quitar el banner de esta categoría?')) return;
    const result = await removeBanner();
    if (result !== undefined) {
      toastSuccess('Banner eliminado');
      onChange();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {category.bannerImageKey ? (
        <img
          src={mediaUrl(category.bannerImageKey)}
          alt={`Banner de ${category.nameEs}`}
          className="h-10 w-20 rounded-md border border-border object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-10 w-20 items-center justify-center rounded-md border border-dashed border-border text-text-muted"
        >
          <ImageIcon className="size-4" />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={
          category.bannerImageKey
            ? `Reemplazar banner de ${category.nameEs}`
            : `Subir banner de ${category.nameEs}`
        }
      >
        <Upload className="size-4" />
      </Button>
      {category.bannerImageKey && (
        <button
          type="button"
          onClick={handleRemove}
          aria-label={`Eliminar banner de ${category.nameEs}`}
          className="rounded-lg p-2 text-text-muted transition-colors hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
