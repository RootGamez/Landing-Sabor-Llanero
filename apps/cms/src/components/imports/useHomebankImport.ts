import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chunkHomebankImport,
  type HomebankPreviewResult,
  prepareHomebankImport,
  type HomebankDateFormat,
  type HomebankParseError,
  type PreparedHomebankImport,
} from '@sabor/shared';
import { ApiError } from '../../lib/api';
import { commitHomebankBatch, previewHomebankBatch } from '../../lib/importsApi';
import {
  EMPTY_RESULT,
  addResults,
  buildCategoryMap,
  defaultChoices,
  detectFileKind,
  hasAmbiguousDates,
  mergePreviews,
  parseImportText,
  readFileText,
  validateImportFile,
  type ImportFileKind,
  type ExistingCategory,
  type ImportResultTotals,
  type PreviewTotals,
} from './importUtils';

export type ImportStep = 'upload' | 'summary' | 'categories' | 'importing' | 'done';

interface LoadedFile {
  name: string;
  kind: ImportFileKind;
  text: string;
}

export interface ImportProgress {
  done: number;
  total: number;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}

/** Máquina de estados del asistente: archivo → resumen → categorías → importación en lotes. */
export function useHomebankImport(existingCategories: readonly ExistingCategory[]) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [dateFormat, setDateFormat] = useState<HomebankDateFormat | null>(null);
  const [needsDateFormat, setNeedsDateFormat] = useState(false);
  const [parseErrors, setParseErrors] = useState<HomebankParseError[]>([]);
  const [prepared, setPrepared] = useState<PreparedHomebankImport | null>(null);
  // Por defecto NO se importan ingresos: las ventas reales vienen de Aronium/POS y
  // traerlas también desde HomeBank las contaría dos veces.
  const [includeIncomes, setIncomesIncluded] = useState(false);
  const [preview, setPreview] = useState<PreviewTotals | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<ImportProgress>({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResultTotals>(EMPTY_RESULT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evita setState tras desmontar y permite detener el envío de lotes (cancelar / salir de la página).
  const stopRef = useRef(false);
  // Reanudar tras un fallo continúa desde el lote que falló, conservando lo ya contado.
  const nextBatchRef = useRef(0);
  const totalsRef = useRef<ImportResultTotals>(EMPTY_RESULT);
  useEffect(() => {
    stopRef.current = false;
    return () => {
      stopRef.current = true;
    };
  }, []);

  const reset = useCallback(() => {
    stopRef.current = false;
    nextBatchRef.current = 0;
    totalsRef.current = EMPTY_RESULT;
    setStep('upload');
    setFile(null);
    setDateFormat(null);
    setNeedsDateFormat(false);
    setParseErrors([]);
    setPrepared(null);
    setIncomesIncluded(false);
    setPreview(null);
    setChoices({});
    setProgress({ done: 0, total: 0 });
    setResult(EMPTY_RESULT);
    setError(null);
    setBusy(false);
  }, []);

  /** Parsea el texto ya cargado (con el formato de fecha elegido) y pasa al resumen o pide el formato. */
  const analyze = useCallback(async (loaded: LoadedFile, format: HomebankDateFormat | null) => {
    setBusy(true);
    setError(null);
    try {
      const parsed = parseImportText(loaded.text, loaded.kind, format);
      setParseErrors(parsed.errors);
      if (loaded.kind === 'csv' && format === null && hasAmbiguousDates(parsed)) {
        setNeedsDateFormat(true);
        setPrepared(null);
        return;
      }
      setNeedsDateFormat(false);
      if (parsed.rows.length === 0) {
        setPrepared(null);
        setError(
          parsed.errors[0]?.message ?? 'No encontramos movimientos en el archivo. Revisa que sea una exportación de HomeBank.',
        );
        return;
      }
      setPrepared(await prepareHomebankImport(parsed.rows));
      setStep('summary');
    } catch (err: unknown) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const loadFile = useCallback(
    async (candidate: File) => {
      const problem = validateImportFile(candidate);
      if (problem) {
        setError(problem);
        return;
      }
      setBusy(true);
      setError(null);
      // Un archivo nuevo descarta todo lo del anterior (si no, el selector de formato aplicaría al archivo viejo).
      setFile(null);
      setPrepared(null);
      setNeedsDateFormat(false);
      setParseErrors([]);
      try {
        const text = await readFileText(candidate);
        const loaded: LoadedFile = { name: candidate.name, kind: detectFileKind(candidate.name) ?? 'xhb', text };
        setFile(loaded);
        setDateFormat(null);
        await analyze(loaded, null);
      } catch (err: unknown) {
        setError(messageOf(err));
        setBusy(false);
      }
    },
    [analyze],
  );

  const chooseDateFormat = useCallback(
    async (format: HomebankDateFormat) => {
      setDateFormat(format);
      if (file) await analyze(file, format);
    },
    [analyze, file],
  );

  /** Consulta a la API qué ya existe y qué categorías faltan (en lotes; no escribe nada). */
  const runPreview = useCallback(async () => {
    if (!prepared) return;
    setBusy(true);
    setError(null);
    try {
      const batches = chunkHomebankImport(prepared.expenses, includeIncomes ? prepared.incomes : []);
      const responses: HomebankPreviewResult[] = [];
      for (const batch of batches) {
        if (stopRef.current) return;
        responses.push(await previewHomebankBatch(batch));
      }
      const merged = mergePreviews(responses);
      setPreview(merged);
      setChoices(defaultChoices(merged.categories, existingCategories));
      setStep('categories');
    } catch (err: unknown) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }, [prepared, includeIncomes, existingCategories]);

  /** Envía los lotes en orden. Si uno falla se puede reintentar: lo ya importado se cuenta como duplicado. */
  const runImport = useCallback(async (resume: boolean) => {
    if (!prepared || !preview) return;
    const batches = chunkHomebankImport(prepared.expenses, includeIncomes ? prepared.incomes : []);
    const categoryMap = buildCategoryMap(preview.categories, choices);
    stopRef.current = false;
    setStep('importing');
    setBusy(true);
    setError(null);
    if (!resume) {
      nextBatchRef.current = 0;
      totalsRef.current = EMPTY_RESULT;
    }
    setResult(totalsRef.current);
    setProgress({ done: nextBatchRef.current, total: batches.length });
    try {
      for (let index = nextBatchRef.current; index < batches.length; index += 1) {
        if (stopRef.current) return;
        totalsRef.current = addResults(totalsRef.current, await commitHomebankBatch(batches[index]!, categoryMap));
        nextBatchRef.current = index + 1;
        setResult(totalsRef.current);
        setProgress({ done: index + 1, total: batches.length });
      }
      if (stopRef.current) return;
      setStep('done');
    } catch (err: unknown) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }, [prepared, preview, includeIncomes, choices]);

  const cancelImport = useCallback(() => {
    stopRef.current = true;
    setError('Importación detenida. Lo que ya se importó se conserva; puedes continuar cuando quieras.');
  }, []);

  return {
    step,
    setStep,
    file,
    dateFormat,
    needsDateFormat,
    parseErrors,
    prepared,
    includeIncomes,
    setIncludeIncomes: setIncomesIncluded,
    preview,
    choices,
    setChoice: (name: string, value: string) => setChoices((prev) => ({ ...prev, [name]: value })),
    progress,
    result,
    busy,
    error,
    loadFile,
    chooseDateFormat,
    runPreview,
    startImport: () => runImport(false),
    resumeImport: () => runImport(true),
    cancelImport,
    reset,
  };
}
