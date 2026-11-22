/** Medios de pago del back-office a los que se mapea el `paymode` de HomeBank. */
export type HomebankPaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'yape' | 'plin';

/** Operación de HomeBank normalizada, igual venga de `.xhb` o de `.csv`. */
export interface HomebankRow {
  /** 'YYYY-MM-DD' (fecha local del negocio, sin zona horaria). */
  date: string;
  /** Céntimos con signo: negativo = egreso, positivo = ingreso. */
  amountCents: number;
  /** "Padre:Hija" cuando hay subcategoría; '' si no tiene. */
  category: string;
  payee: string;
  memo: string;
  info: string;
  tags: string;
  paymentMethod: HomebankPaymentMethod;
}

export interface HomebankParseError {
  /** Línea 1-based del archivo; 0 para errores globales (tamaño, nº de filas). */
  line: number;
  message: string;
}

export interface HomebankParseResult {
  rows: HomebankRow[];
  errors: HomebankParseError[];
}
