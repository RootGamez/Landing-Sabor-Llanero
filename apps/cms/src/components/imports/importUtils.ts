import {
  isCreatableHomebankCategory,
  parseHomebankCsv,
  parseXhb,
  type HomebankCategoryMapValue,
  type HomebankCategoryPreview,
  type HomebankCommitResult,
  type HomebankDateFormat,
  type HomebankParseResult,
  type HomebankPreviewResult,
} from '@sabor/shared';

/** Categoría existente tal como la ofrece el selector (ver `flattenCategories`). */
export interface ExistingCategory {
  id: number;
  name: string;
  label: string;
  isActive: boolean;
}

export type ImportFileKind = 'xhb' | 'csv';

/** Tope de tamaño del archivo (el parser corta a ~5 M de caracteres; esto evita siquiera leerlo). */
export const MAX_IMPORT_FILE_BYTES = 6 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = '.xhb,.csv';

/** Valor del selector de categoría para "crear con el nombre del archivo". */
export const CREATE_CHOICE = 'create';
/** Valor del selector cuando todavía no se eligió categoría. */
export const NO_CHOICE = '';

const AMBIGUOUS_DATE_PATTERN = /ambigua|MM\/DD/;
const OTHER_CATEGORY_NAME = 'otros';

export function detectFileKind(fileName: string): ImportFileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xhb')) return 'xhb';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
}

/** Mensaje de error si el archivo no se puede importar (extensión o tamaño); `null` si está bien. */
export function validateImportFile(file: Pick<File, 'name' | 'size'>): string | null {
  if (detectFileKind(file.name) === null) return 'Sube un archivo de HomeBank con extensión .xhb o .csv.';
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB.`;
  }
  return null;
}

/** Lee el archivo como texto UTF-8 sin ejecutarlo ni subirlo a ningún lado. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo. Vuelve a intentarlo.'));
    reader.readAsText(file, 'utf-8');
  });
}

export function parseImportText(
  text: string,
  kind: ImportFileKind,
  dateFormat: HomebankDateFormat | null,
): HomebankParseResult {
  return kind === 'xhb' ? parseXhb(text) : parseHomebankCsv(text, dateFormat ? { dateFormat } : {});
}

/** `true` si hay filas del CSV rechazadas por fechas que podrían ser DD/MM o MM/DD. */
export function hasAmbiguousDates(result: HomebankParseResult): boolean {
  return result.errors.some((error) => AMBIGUOUS_DATE_PATTERN.test(error.message));
}

export interface PreviewTotals {
  expensesExisting: number;
  incomesExisting: number;
  categories: HomebankCategoryPreview[];
}

/** Junta las respuestas de `preview` de todos los lotes (las categorías se suman por nombre). */
export function mergePreviews(previews: readonly HomebankPreviewResult[]): PreviewTotals {
  const byName = new Map<string, HomebankCategoryPreview>();
  for (const preview of previews) {
    for (const category of preview.categories) {
      const current = byName.get(category.name);
      byName.set(category.name, current ? { ...current, count: current.count + category.count } : category);
    }
  }
  return {
    expensesExisting: previews.reduce((n, p) => n + p.expenses.existing, 0),
    incomesExisting: previews.reduce((n, p) => n + p.incomes.existing, 0),
    categories: [...byName.values()],
  };
}

export interface ImportResultTotals {
  expenses: { inserted: number; duplicates: number };
  incomes: { inserted: number; duplicates: number };
}

export const EMPTY_RESULT: ImportResultTotals = {
  expenses: { inserted: 0, duplicates: 0 },
  incomes: { inserted: 0, duplicates: 0 },
};

export function addResults(total: ImportResultTotals, batch: HomebankCommitResult): ImportResultTotals {
  return {
    expenses: {
      inserted: total.expenses.inserted + batch.expenses.inserted,
      duplicates: total.expenses.duplicates + batch.expenses.duplicates,
    },
    incomes: {
      inserted: total.incomes.inserted + batch.incomes.inserted,
      duplicates: total.incomes.duplicates + batch.incomes.duplicates,
    },
  };
}

/** `true` si la categoría del archivo no puede crearse tal cual (vacía o con partes de más de 60 caracteres). */
export const cannotCreate = (name: string): boolean => !isCreatableHomebankCategory(name);

/** Elección inicial por categoría: crear la nueva; las vacías/no creables intentan "Otros" y si no, quedan sin elegir. */
export function defaultChoices(
  categories: readonly HomebankCategoryPreview[],
  existing: readonly ExistingCategory[],
): Record<string, string> {
  // Solo categorías raíz activas: son las que ofrece el selector.
  const otherId = existing.find(
    (c) => c.isActive && c.label === c.name && c.name.toLowerCase() === OTHER_CATEGORY_NAME,
  )?.id;
  return Object.fromEntries(
    categories
      .filter((c) => c.categoryId === null)
      .map((c) => [c.name, cannotCreate(c.name) ? (otherId === undefined ? NO_CHOICE : String(otherId)) : CREATE_CHOICE]),
  );
}

/** Mapa que espera el servidor: las que ya existen van a su id, el resto según lo elegido. */
export function buildCategoryMap(
  categories: readonly HomebankCategoryPreview[],
  choices: Readonly<Record<string, string>>,
): Record<string, HomebankCategoryMapValue> {
  const entries: Array<[string, HomebankCategoryMapValue]> = [];
  for (const category of categories) {
    if (category.categoryId !== null) {
      entries.push([category.name, category.categoryId]);
      continue;
    }
    const choice = choices[category.name] ?? NO_CHOICE;
    if (choice === CREATE_CHOICE) entries.push([category.name, CREATE_CHOICE]);
    else if (choice !== NO_CHOICE) entries.push([category.name, Number(choice)]);
  }
  return Object.fromEntries(entries);
}

/** Categorías nuevas que siguen sin destino (bloquean el botón de importar). */
export function unresolvedCategories(
  categories: readonly HomebankCategoryPreview[],
  choices: Readonly<Record<string, string>>,
): string[] {
  return categories
    .filter((c) => c.categoryId === null && (choices[c.name] ?? NO_CHOICE) === NO_CHOICE)
    .map((c) => c.name);
}
