/** Tipos compartidos del importador de Aronium. Sin lógica. */

export const SIZE_KEYS = ['mediana', 'grande', 'familiar'] as const;
export type SizeKey = (typeof SIZE_KEYS)[number];

export interface RawProduct {
  id: number;
  name: string;
  groupName: string;
}

export interface RawDocument {
  id: number;
  /** Hora local de Lima, tal cual la guarda Aronium ('2025-04-22 22:32:10.2184'). */
  dateCreated: string;
  total: number;
  discount: number;
}

export interface RawItem {
  documentId: number;
  productId: number;
  quantity: number;
  price: number;
  total: number;
}

export interface RawPayment {
  documentId: number;
  typeName: string;
  amount: number;
}

export interface RawZReport {
  id: number;
  number: number;
  fromDocumentId: number;
  toDocumentId: number;
}

export interface RawData {
  products: RawProduct[];
  documents: RawDocument[];
  items: RawItem[];
  payments: RawPayment[];
  zReports: RawZReport[];
}

export interface MenuEntry {
  id: number;
  nameEs: string;
  categorySlug: string;
  /** Clave estable entre bases (los ids pueden diferir entre local y producción). */
  slug?: string;
}

export type MapStatus = 'auto' | 'unmatched';

/** Una fila de product-map.csv. */
export interface MapRow {
  legacyId: number;
  legacyName: string;
  legacyGroup: string;
  itemId: number | null;
  /** Si está, manda sobre itemId: el SQL resuelve `menu_items.slug`. */
  itemSlug: string | null;
  sizeKey: SizeKey | null;
  status: MapStatus;
}

export interface SaleItemRecord {
  legacyProductId: number;
  itemId: number | null;
  itemSlug: string | null;
  sizeKey: SizeKey | null;
  /** Nombre legacy limpio + sufijo; es el respaldo cuando el ítem no está en el menú destino. */
  name: string;
  baseName: string;
  /** ' (×0,5)' en líneas fraccionarias, '' en el resto. */
  nameSuffix: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface SaleRecord {
  legacyRef: string;
  number: number;
  createdAtUtc: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: string;
  items: SaleItemRecord[];
}

export interface SessionRecord {
  legacyRef: string;
  notes: string;
  openedAtUtc: string;
  closedAtUtc: string;
  cashCents: number;
  sales: SaleRecord[];
}

export interface ImportPlan {
  sessions: SessionRecord[];
  mapRows: MapRow[];
  warnings: string[];
  salesCount: number;
  itemsCount: number;
  totalCents: number;
}
