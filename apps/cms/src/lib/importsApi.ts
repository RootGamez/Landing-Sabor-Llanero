import type {
  HomebankCategoryMapValue,
  HomebankCommitResult,
  HomebankPreviewResult,
  HomebankBatch,
} from '@sabor/shared';
import { api } from './api';

/** Mide cuántas filas del lote ya existen y qué categorías del archivo faltan (no escribe nada). */
export const previewHomebankBatch = (batch: HomebankBatch) =>
  api.post<HomebankPreviewResult>('/imports/homebank/preview', batch);

/** Importa un lote; es idempotente, así que reintentar el mismo lote no duplica. */
export const commitHomebankBatch = (batch: HomebankBatch, categoryMap: Record<string, HomebankCategoryMapValue>) =>
  api.post<HomebankCommitResult>('/imports/homebank/commit', { ...batch, categoryMap });
