/**
 * `GET /sizes` devuelve tamaños de pizza Y presentaciones (0012). Estos filtros
 * evitan que unas se usen como las otras (precio por categoría, promos, selector).
 */
import { kindOf, type Size } from '@sabor/shared';

/** Tamaños de pizza (Mediana/Grande/…): `kind` ausente cuenta como 'size'. */
export function pizzaSizesOf(sizes: readonly Size[]): Size[] {
  return sizes.filter((size) => kindOf(size) === 'size');
}

/** Presentaciones (Media docena, 1 docena…) en orden de exhibición. */
export function portionsOf(sizes: readonly Size[]): Size[] {
  return sizes
    .filter((size) => kindOf(size) === 'portion')
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
}
