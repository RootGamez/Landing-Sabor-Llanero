import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ImageIcon, PackagePlus } from 'lucide-react';
import { createMenuItemSchema, type CreateMenuItemInput, type MenuItem, type UpdateMenuItemInput } from '@sabor/shared';
import type { CategoryWithPrices } from '../lib/adminTypes';
import { useCategories, useMenuItemDetail, useSizes } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { api } from '../lib/api';
import { buildMenuItemInput, promoCountOf } from '../lib/menuItemInput';
import { basePortionOf, validatePortions, type PortionErrors } from '../lib/portionPrices';
import { pizzaSizesOf, portionsOf } from '../lib/sizeKinds';
import { toastError, toastSuccess } from '../store/toastStore';
import { TextField, TextAreaField } from '../components/ui/FormField';
import { Select } from '../components/ui/Select';
import { SwitchField } from '../components/ui/Switch';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ItemPriceFields } from '../components/menu-items/ItemPriceFields';
import { MediaManager } from '../components/menu-items/MediaManager';
import { SimplePriceSection } from '../components/menu-items/SimplePriceSection';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';

const NO_PORTION_ERRORS: PortionErrors = { fields: new Map(), general: null };

export function MenuItemFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== undefined && id !== 'nuevo';
  const navigate = useNavigate();

  const { data: categories } = useCategories();
  const { data: allSizes } = useSizes();
  // `/sizes` mezcla tamaños de pizza y presentaciones: cada uso toma solo el suyo.
  const sizes = useMemo(() => (allSizes ? pizzaSizesOf(allSizes) : undefined), [allSizes]);
  const portions = useMemo(() => (allSizes ? portionsOf(allSizes) : []), [allSizes]);
  const basePortionId = basePortionOf(portions)?.id;
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
  // Presentaciones (Media docena, 1 docena…) de un ítem de categoría sin tamaños.
  const [sellByPortions, setSellByPortions] = useState(false);
  const [portionValues, setPortionValues] = useState<Map<number, number | null>>(new Map());
  const [portionErrors, setPortionErrors] = useState<PortionErrors>(NO_PORTION_ERRORS);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);
  // Promo con pizzas a elegir en el POS (sabores + adicional por categoría). null = no aplica.
  const [promoCount, setPromoCount] = useState<number | null>(null);
  const [promoSizeId, setPromoSizeId] = useState<number | null>(null);

  const savedPortions = useMemo(() => existing?.prices.filter((p) => p.kind === 'portion') ?? [], [existing]);

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
    setPromoCount(existing.promoPizzaCount ?? null);
    setPromoSizeId(existing.promoPizzaSizeId ?? null);
    // Solo los precios con isOverride=true de tamaños son overrides propios del ítem;
    // el resto son heredados de la categoría y no se envían. Las presentaciones van aparte.
    setOverrides(
      new Map(
        existing.prices
          .filter((p) => p.isOverride && p.kind !== 'portion')
          .map((p) => [p.sizeId, p.price]),
      ),
    );
    setSellByPortions(savedPortions.length > 0);
    setPortionValues(new Map(savedPortions.map((p) => [p.sizeId, p.price])));
    setPortionErrors(NO_PORTION_ERRORS);
  }, [existing, savedPortions]);

  const category: CategoryWithPrices | undefined = categories?.find((c) => c.id === categoryId);
  const hasSizes = category?.hasSizes ?? false;

  const { mutate: save, loading: saving } = useMutation(
    async (input: CreateMenuItemInput | UpdateMenuItemInput): Promise<MenuItem> => {
      if (isEditing) return api.patch(`/menu-items/${id}`, input);
      return api.post('/menu-items', input);
    },
  );

  function setOverride(sizeId: number, value: number | null) {
    setOverrides((prev) => new Map(prev).set(sizeId, value));
  }

  /** "1 docena" es la fuente visible del precio del ítem: se mantiene `price` sincronizado. */
  function setPortionValue(sizeId: number, value: number | null) {
    setPortionValues((prev) => new Map(prev).set(sizeId, value));
    if (sizeId === basePortionId && value != null && value > 0) setPrice(value);
    setPortionErrors(NO_PORTION_ERRORS);
  }

  function toggleSellByPortions(enabled: boolean) {
    setSellByPortions(enabled);
    setPortionErrors(NO_PORTION_ERRORS);
    // Al activarlas, el precio actual pasa a ser el de "1 docena" (si no lo tenía).
    if (enabled && basePortionId !== undefined && price != null && price > 0 && portionValues.get(basePortionId) == null) {
      setPortionValue(basePortionId, price);
    }
  }

  /** Valida con el Zod compartido; los errores de presentaciones van a su campo. Devuelve true si todo está bien. */
  function validateInput(input: CreateMenuItemInput): boolean {
    const parsed = createMenuItemSchema.safeParse(input);
    if (parsed.success) return true;
    const fields = new Map<number, string>();
    for (const issue of parsed.error.issues) {
      const [root, index] = issue.path;
      const sizeId = root === 'priceOverrides' && typeof index === 'number' ? input.priceOverrides?.[index]?.sizeId : undefined;
      if (sizeId !== undefined) fields.set(sizeId, issue.message);
    }
    if (fields.size > 0) setPortionErrors({ fields, general: null });
    else toastError(parsed.error.issues[0]?.message ?? 'Revisa los datos del ítem');
    return false;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId || !nameEs.trim() || !category) return;

    if (!hasSizes && sellByPortions) {
      const errors = validatePortions(portionValues);
      if (errors.fields.size > 0 || errors.general) {
        setPortionErrors(errors);
        return;
      }
    }
    if (!hasSizes && !sellByPortions && (price == null || price <= 0)) {
      toastError('Los ítems de esta categoría necesitan un precio propio');
      return;
    }

    const promoPizzaCount = promoCountOf(promoCount);
    if (!hasSizes && !sellByPortions && (promoPizzaCount === null) !== (promoSizeId === null)) {
      toastError('Para la promo indica cuántas pizzas incluye y de qué tamaño (o deja ambos vacíos)');
      return;
    }

    const input = buildMenuItemInput({
      categoryId,
      nameEs,
      nameEn,
      descriptionEs,
      descriptionEn,
      slug: existing?.slug,
      hasSizes,
      price,
      overrides,
      sellByPortions,
      portionValues,
      basePortionId,
      hadPortions: savedPortions.length > 0,
      promoCount,
      promoSizeId,
      savedPromo: { count: existing?.promoPizzaCount ?? null, sizeId: existing?.promoPizzaSizeId ?? null },
      isFeatured,
      isActive,
    });
    if (!validateInput(input)) return;

    const result = await save(input);
    if (result !== undefined) {
      toastSuccess(isEditing ? 'Ítem actualizado' : 'Ítem creado');
      if (!isEditing) {
        navigate(`/tienda/menu/${result.id}`, { replace: true });
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
          to="/tienda/menu"
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
            <Select
              label="Categoría"
              required
              placeholder="Selecciona una categoría"
              value={categoryId === undefined ? '' : String(categoryId)}
              onValueChange={(next) => setCategoryId(next === '' ? undefined : Number(next))}
              options={(categories ?? []).map((c) => ({
                value: String(c.id),
                label: `${c.nameEs} ${c.hasSizes ? '(precio por tamaño)' : '(precio propio)'}`,
              }))}
            />
          </CardContent>
        </Card>

        {/* Lógica de precios según la categoría elegida (BLUEPRINT §4.2). */}
        {category && !hasSizes && (
          <SimplePriceSection
            categoryName={category.nameEs}
            price={price}
            onPriceChange={setPrice}
            portion={{
              portions,
              enabled: sellByPortions,
              onEnabledChange: toggleSellByPortions,
              values: portionValues,
              onValueChange: setPortionValue,
              errors: portionErrors,
            }}
            promo={{
              count: promoCount,
              onCountChange: setPromoCount,
              sizeId: promoSizeId,
              onSizeIdChange: setPromoSizeId,
              sizes: sizes ?? [],
            }}
          />
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
          <SwitchField
            label="Destacado"
            description="Se resalta en el catálogo (ej. Pizza Alborada)."
            checked={isFeatured}
            onCheckedChange={setIsFeatured}
          />
          <SwitchField
            label="Ítem activo"
            description="Visible en el catálogo público."
            checked={isActive}
            onCheckedChange={setIsActive}
          />

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
          Guarda el ítem primero para poder agregar imágenes.
        </p>
      )}
    </div>
  );
}
