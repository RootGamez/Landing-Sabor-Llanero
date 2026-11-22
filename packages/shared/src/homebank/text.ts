/** Recorta y normaliza a NFC: la misma cadena visible siempre produce los mismos bytes. */
export function cleanText(value: string | undefined): string {
  return (value ?? '').normalize('NFC').trim();
}

/** Sin tildes, minúsculas y recortado: solo para comparar, nunca para guardar. */
export function foldForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
