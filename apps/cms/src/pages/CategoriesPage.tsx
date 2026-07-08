import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { CreateCategoryInput, Size } from '@sabor/shared';
import type { CategoryWithPrices } from '../lib/adminTypes';
import { useCategories, useSizes } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { api } from '../lib/api';
import { slugify } from '../lib/slug';
import { formatPrice } from '../lib/format';
import { toastError, toastSuccess } from '../store/toastStore';
import { CategoryBannerControl } from '../components/categories/CategoryBannerControl';
import { SizePricesEditor, toSizePriceInputs } from '../components/categories/SizePricesEditor';
import { TextField } from '../components/ui/FormField';
import { NumberField } from '../components/ui/NumberField';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

interface FormState {
  nameEs: string;
  nameEn: string;
  slug: string;
  hasSizes: boolean;
  displayOrder: number | null;
  isActive: boolean;
  prices: Map<number, number | null>;
}

const EMPTY_FORM: FormState = {
  nameEs: '',
  nameEn: '',
  slug: '',
  hasSizes: false,
  displayOrder: null,
  isActive: true,
  prices: new Map(),
};

function formFromCategory(category: CategoryWithPrices): FormState {
  return {
    nameEs: category.nameEs,
    nameEn: category.nameEn,
    slug: category.slug,
    hasSizes: category.hasSizes,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
    prices: new Map(category.prices.map((p) => [p.sizeId, p.price])),
  };
}

export function CategoriesPage() {
  const { data: categories, loading, error, refetch } = useCategories();
  const { data: sizes } = useSizes();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CategoryWithPrices | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { mutate: save, loading: saving } = useMutation(
    async (input: CreateCategoryInput, id?: number) => {
      if (id) return api.patch(`/categories/${id}`, input);
      return api.post('/categories', input);
    },
  );
  const { mutate: remove } = useMutation((id: number) => api.delete(`/categories/${id}`));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(category: CategoryWithPrices) {
    setEditing(category);
    setForm(formFromCategory(category));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nameEs = form.nameEs.trim();
    if (!nameEs) return;

    const priceInputs = toSizePriceInputs(form.prices);
    if (form.hasSizes && sizes && priceInputs.length < sizes.length) {
      toastError('Una categoría con tamaños necesita precio para los 3 tamaños');
      return;
    }

    const input: CreateCategoryInput = {
      nameEs,
      nameEn: form.nameEn.trim(),
      slug: form.slug.trim() || slugify(nameEs),
      hasSizes: form.hasSizes,
      displayOrder: form.displayOrder ?? 0,
      isActive: form.isActive,
      ...(form.hasSizes ? { prices: priceInputs } : {}),
    };
    const result = await save(input, editing?.id);
    if (result !== undefined) {
      toastSuccess(editing ? 'Categoría actualizada' : 'Categoría creada');
      closeForm();
      refetch();
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar esta categoría? Esta acción no se puede deshacer.')) return;
    const result = await remove(id);
    if (result !== undefined) {
      toastSuccess('Categoría eliminada');
      refetch();
    }
  }

  const sizeLabel = (sizeId: number, allSizes: Size[] | undefined) =>
    allSizes?.find((s) => s.id === sizeId)?.labelEs ?? `#${sizeId}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Categorías</h1>
          <p className="text-sm text-text-muted">
            Secciones del menú. Las que venden por tamaño definen el precio base de sus pizzas.
          </p>
        </div>
        {!showForm && (
          <Button variant="accent" onClick={openCreate}>
            <Plus className="size-4" />
            Nueva categoría
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>{editing ? `Editar «${editing.nameEs}»` : 'Nueva categoría'}</CardTitle>
            <Button variant="ghost" size="sm" onClick={closeForm} aria-label="Cancelar">
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Nombre (español)"
                  required
                  value={form.nameEs}
                  onChange={(e) => update('nameEs', e.target.value)}
                />
                <TextField
                  label="Nombre (inglés)"
                  hint="Vacío = se muestra el nombre en español."
                  value={form.nameEn}
                  onChange={(e) => update('nameEn', e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Slug"
                  hint="URL amigable; vacío = se genera del nombre."
                  placeholder={form.nameEs ? slugify(form.nameEs) : 'ej: clasicas'}
                  value={form.slug}
                  onChange={(e) => update('slug', e.target.value)}
                />
                <NumberField
                  label="Orden de exhibición"
                  min={0}
                  value={form.displayOrder}
                  onValueChange={(v) => update('displayOrder', v)}
                  placeholder="0"
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl2 border-2 border-border bg-surface p-4">
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-text">Vende por tamaño</span>
                  <span className="text-xs text-text-muted">
                    Los ítems heredan un precio por cada tamaño (Mediana / Grande / Familiar).
                    {editing && ' No se puede cambiar si la categoría ya tiene ítems.'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.hasSizes}
                  onChange={(e) => update('hasSizes', e.target.checked)}
                  className="size-5 accent-primary"
                />
              </label>

              {form.hasSizes &&
                (sizes ? (
                  <SizePricesEditor
                    sizes={sizes}
                    values={form.prices}
                    onChange={(sizeId, price) =>
                      setForm((prev) => {
                        const prices = new Map(prev.prices);
                        prices.set(sizeId, price);
                        return { ...prev, prices };
                      })
                    }
                  />
                ) : (
                  <p className="text-sm text-text-muted">Cargando tamaños…</p>
                ))}

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl2 border-2 border-border bg-surface p-4">
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-text">Categoría activa</span>
                  <span className="text-xs text-text-muted">Visible en el catálogo público.</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => update('isActive', e.target.checked)}
                  className="size-5 accent-primary"
                />
              </label>

              <Button type="submit" loading={saving} className="self-start">
                {editing ? 'Guardar cambios' : 'Crear categoría'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div>
        {loading && <TableSkeleton />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && categories && categories.length === 0 && (
          <EmptyState title="Todavía no hay categorías" description="Creá la primera con el botón de arriba." />
        )}
        {!loading && !error && categories && categories.length > 0 && (
          <ul className="flex flex-col gap-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Card className="flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                      {category.nameEs}
                      {category.nameEn ? (
                        <span className="font-normal text-text-muted">· {category.nameEn}</span>
                      ) : (
                        <Badge variant="outline">Sin traducir (EN)</Badge>
                      )}
                      {!category.isActive && <Badge variant="muted">Inactiva</Badge>}
                    </p>
                    <p className="text-xs text-text-muted">/{category.slug}</p>
                    {category.hasSizes ? (
                      <p className="mt-1 text-xs text-text-muted">
                        {category.prices
                          .map((p) => `${sizeLabel(p.sizeId, sizes)}: ${formatPrice(p.price)}`)
                          .join(' · ') || 'Sin precios cargados'}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-text-muted">Precio propio por ítem</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <CategoryBannerControl category={category} onChange={refetch} />
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(category)}
                        aria-label={`Editar ${category.nameEs}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category.id)}
                        aria-label={`Eliminar ${category.nameEs}`}
                        className="rounded-lg p-2 text-text-muted transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
