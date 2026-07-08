/**
 * Convierte un texto libre en un slug URL-safe (minúsculas, sin acentos,
 * separado por guiones). Si el resultado queda vacío o son solo dígitos, se
 * prefija "item" (o "item-" + dígitos): un slug puramente numérico ("2024")
 * colisiona con la rama de acceso por id numérico del CMS en
 * GET /menu-items/:slug, que lo trataría como si fuera un id.
 */
export function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base === '') return 'item';
  if (/^\d+$/.test(base)) return `item-${base}`;
  return base;
}
