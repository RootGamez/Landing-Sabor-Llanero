import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ImageIcon, PackagePlus } from 'lucide-react';
import type { CreateMenuItemInput, MenuItem, UpdateMenuItemInput } from '@sabor/shared';
import type { CategoryWithPrices } from '../lib/adminTypes';
import { useCategories, useMenuItemDetail, useSizes } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { api } from '../lib/api';
import { slugify } from '../lib/slug';
import { toastError, toastSuccess } from '../store/toastStore';
import { TextField, TextAreaField, SelectField } from '../components/ui/FormField';
import { NumberField } from '../components/ui/NumberField';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ItemPriceFields } from '../components/menu-items/ItemPriceFields';
import { MediaManager } from '../components/menu-items/MediaManager';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';

export function MenuItemFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== undefined && id !== 'nuevo';
  const navigate = useNavigate();

  const { data: categories } = useCategories();
  const { data: sizes } = useSizes();
  const { data: existing, loading: loadingExisting, error, refetch } = useMenuItemDetail(
    isEditing ? id : undefined,
  );

  const [nameEs, setNameEs] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descriptionEs, setDescriptionEs] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [price, setPrice] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Map<number, number | null>>(new Map());
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!existing) return;
    setNameEs(existing.nameEs);
    setNameEn(existing.nameEn);
    setDescriptionEs(existing.descriptionEs);
    setDescriptionEn(existing.descriptionEn);
    setCategoryId(existing.categoryId);
    setPrice(existing.price);
    setIsFeatured(existing.isFeatured);
    setIsActive(existing.isActive);
    // Solo los precios con isOverride=true son overrides propios del ítem;
    // el resto son heredados de la categoría y no se envían.
    setOverrides(
      new Map(existing.prices.filter((p) => p.isOverride).map((p) => [p.sizeId, p.price])),
    );
  }, [existing]);

  const category: CategoryWithPrices | undefined = categories?.find((c) => c.id === categoryId);
  const hasSizes = category?.hasSizes ?? false;

  const { mutate: save, loading: saving } = useMutation(
    async (input: CreateMenuItemInput | UpdateMenuItemInput): Promise<MenuItem> => {
      if (isEditing) return api.patch(`/menu-items/${id}`, input);
      return api.post('/menu-items', input);
    },
  );

  function setOverride(sizeId: number, value: number | null) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(sizeId, value);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId || !nameEs.trim() || !category) return;

    if (!hasSizes && (price == null || price <= 0)) {
      toastError('Los ítems de esta categoría necesitan un precio propio');
      return;
    }

    const priceOverrides = hasSizes
      ? [...overrides.entries()]
          .filter((entry): entry is [number, number] => entry[1] != null && entry[1] > 0)
          .map(([sizeId, p]) => ({ sizeId, price: p }))
      : undefined;

    const input: CreateMenuItemInput = {
      categoryId,
      nameEs: nameEs.trim(),
      nameEn: nameEn.trim(),
      descriptionEs: descriptionEs.trim(),
      descriptionEn: descriptionEn.trim(),
      slug: existing?.slug ?? slugify(nameEs),
      // Invariante BLUEPRINT §4.2: con tamaños el ítem no lleva price propio.
      price: hasSizes ? null : price,
      ...(hasSizes ? { priceOverrides: priceOverrides ?? [] } : {}),
      isFeatured,
      isActive,
    };

    const result = await save(input);
    if (result !== undefined) {
      toastSuccess(isEditing ? 'Ítem actualizado' : 'Ítem creado');
      if (!isEditing) {
        navigate(`/menu/${result.id}`, { replace: true });
      } else {
        refetch();
      }
    }
  }

  if (isEditing && loadingExisting) {
    return <Skeleton className="h-96 w-full max-w-3xl rounded-xl2" />;
  }
  if (isEditing && error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Volver al menú
        </Link>
        <h1 className="font-display text-2xl font-bold text-text">
          {isEditing ? `Editar: ${existing?.nameEs ?? ''}` : 'Nuevo ítem'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <PackagePlus className="size-5 text-primary" />
            <CardTitle>Información básica (bilingüe)</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nombre (español)"
                required
                value={nameEs}
                onChange={(e) => setNameEs(e.target.value)}
              />
              <TextField
                label="Nombre (inglés)"
                hint="Vacío = se muestra el nombre en español."
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextAreaField
                label="Descripción (español)"
                value={descriptionEs}
                onChange={(e) => setDescriptionEs(e.target.value)}
              />
              <TextAreaField
                label="Descripción (inglés)"
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
              />
            </div>
            <SelectField
              label="Categoría"
              required
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(Number(e.target.value))}
            >
              <option value="" disabled>
                Seleccioná una categoría
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEs} {c.hasSizes ? '(precio por tamaño)' : '(precio propio)'}
                </option>
              ))}
            </SelectField>
          </CardContent>
        </Card>

        {/* Lógica de precios según la categoría elegida (BLUEPRINT §4.2). */}
        {category && !hasSizes && (
          <Card>
            <CardContent className="pt-5">
              <NumberField
                label="Precio"
                required
                min={0.01}
                value={price}
                onValueChange={setPrice}
                prefix="S/"
                placeholder="0.00"
                hint={`Los ítems de «${category.nameEs}» tienen precio propio único.`}
              />
            </CardContent>
          </Card>
        )}
        {category && hasSizes && sizes && (
          <ItemPriceFields
            category={category}
            sizes={sizes}
            overrides={overrides}
            onOverrideChange={setOverride}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl2 border-2 border-border bg-surface p-4">
            <span className="flex flex-col">
              <span className="text-sm font-bold text-text">Destacado</span>
              <span className="text-xs text-text-muted">Se resalta en el catálogo (ej. Pizza Alborada).</span>
            </span>
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="size-5 accent-primary"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl2 border-2 border-border bg-surface p-4">
            <span className="flex flex-col">
              <span className="text-sm font-bold text-text">Ítem activo</span>
              <span className="text-xs text-text-muted">Visible en el catálogo público.</span>
            </span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-5 accent-primary"
            />
          </label>
        </div>

        <Button type="submit" loading={saving} className="self-start">
          {isEditing ? 'Guardar cambios' : 'Crear ítem'}
        </Button>
      </form>

      {isEditing && existing && (
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <ImageIcon className="size-5 text-primary" />
            <CardTitle>Imágenes y video</CardTitle>
          </CardHeader>
          <CardContent>
            <MediaManager itemId={existing.id} media={existing.media} onChange={refetch} />
          </CardContent>
        </Card>
      )}
      {!isEditing && (
        <p className="text-sm text-text-muted">
          Guardá el ítem primero para poder agregar imágenes.
        </p>
      )}
    </div>
  );
}
