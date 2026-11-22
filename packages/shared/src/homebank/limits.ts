import type { HomebankParseResult } from './types';

/** Tope de entrada en caracteres (≈ 5 MB): protege al Worker y al navegador de archivos absurdos. */
export const MAX_HOMEBANK_INPUT_CHARS = 5 * 1024 * 1024;

/** Tope de filas normalizadas por archivo. */
export const MAX_HOMEBANK_ROWS = 20_000;

function globalError(message: string): HomebankParseResult {
  return { rows: [], errors: [{ line: 0, message }] };
}

/** Resultado de error global si el texto supera el tamaño máximo; `null` si es aceptable. */
export function checkInputSize(text: string): HomebankParseResult | null {
  if (text.length <= MAX_HOMEBANK_INPUT_CHARS) return null;
  return globalError(
    `El archivo supera el tamaño máximo permitido (${MAX_HOMEBANK_INPUT_CHARS} caracteres).`,
  );
}

/** Resultado de error global por exceso de filas. */
export function tooManyRowsResult(): HomebankParseResult {
  return globalError(`El archivo supera el máximo de ${MAX_HOMEBANK_ROWS} filas por importación.`);
}
