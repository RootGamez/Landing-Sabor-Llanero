import type { HomebankPaymentMethod } from './types';

/**
 * Código numérico `paymode` de HomeBank → medio de pago del back-office.
 * 1 tarjeta crédito, 6 tarjeta débito → tarjeta; 4 transferencia, 5 transf. interna,
 * 7 orden permanente, 8 pago electrónico, 9 depósito → transferencia; resto → efectivo.
 */
export function paymentCodeToMethod(code: number): HomebankPaymentMethod {
  switch (code) {
    case 1:
    case 6:
      return 'tarjeta';
    case 4:
    case 5:
    case 7:
    case 8:
    case 9:
      return 'transferencia';
    default:
      return 'efectivo';
  }
}

/** Texto → método; cualquier cosa no numérica cae en efectivo. */
export function parsePaymentCode(raw: string | undefined): HomebankPaymentMethod {
  const trimmed = (raw ?? '').trim();
  return paymentCodeToMethod(/^\d+$/.test(trimmed) ? Number(trimmed) : 0);
}
