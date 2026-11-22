import { cleanText } from './text';
import type { HomebankRow } from './types';

export type HashableHomebankRow = Pick<HomebankRow, 'date' | 'amountCents' | 'payee' | 'memo' | 'category'>;

const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Clave canónica; JSON evita colisiones por separadores dentro de los campos. */
function canonicalKey(row: HashableHomebankRow): string {
  return JSON.stringify([
    row.date,
    row.amountCents,
    cleanText(row.payee),
    cleanText(row.memo),
    cleanText(row.category),
  ]);
}

/** SHA-256 hex determinista de fecha, monto, payee, memo y categoría normalizados (trim + NFC). */
export function importHash(row: HashableHomebankRow): Promise<string> {
  return sha256Hex(canonicalKey(row));
}

/**
 * Hashes de un archivo completo. Filas idénticas dentro del mismo archivo
 * (p. ej. dos compras iguales el mismo día) son operaciones distintas: la
 * n-ésima repetición lleva su número, así el índice único no las colapsa y la
 * reimportación sigue siendo idempotente. La primera conserva `importHash`.
 */
export function importHashes(rows: readonly HashableHomebankRow[]): Promise<string[]> {
  const seen = new Map<string, number>();
  return Promise.all(
    rows.map((row) => {
      const key = canonicalKey(row);
      const occurrence = seen.get(key) ?? 0;
      seen.set(key, occurrence + 1);
      return sha256Hex(occurrence === 0 ? key : `${key}#${occurrence}`);
    }),
  );
}
