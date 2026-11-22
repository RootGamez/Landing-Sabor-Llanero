import { describe, expect, it } from 'vitest';
import { buildMapRows, matchMenuItem, normalizeName, sizeFromGroup } from './product-map';
import { parseMapCsv, serializeMapCsv } from './map-csv';
import type { MenuEntry, RawProduct } from './types';

const MENU: MenuEntry[] = [
  { id: 11, nameEs: 'Champiñón', categorySlug: 'clasicas' },
  { id: 12, nameEs: 'Lasaña', categorySlug: 'pastas' },
  { id: 13, nameEs: 'Americana', categorySlug: 'clasicas' },
  { id: 14, nameEs: 'Pepperoni', categorySlug: 'clasicas' },
  { id: 15, nameEs: 'Duplicada', categorySlug: 'clasicas' },
  { id: 16, nameEs: 'duplicada', categorySlug: 'especiales' },
];

describe('normalizeName', () => {
  it('quita acentos, pasa a minúsculas y colapsa espacios', () => {
    expect(normalizeName('  Champiñón   Especial ')).toBe('champinon especial');
  });
});

describe('sizeFromGroup', () => {
  it.each([
    ['Pizzas medianas', 'mediana'],
    ['Pizzas Grandes', 'grande'],
    ['Pizzas Familiares', 'familiar'],
    ['Bebidas', null],
    ['', null],
  ])('%s -> %s', (group, expected) => {
    expect(sizeFromGroup(group)).toBe(expected);
  });
});

describe('matchMenuItem', () => {
  it('empareja por nombre normalizado', () => {
    expect(matchMenuItem('PEPPERONI', MENU)).toEqual({ status: 'auto', itemId: 14 });
  });

  it('tolera bytes rotos (�) donde faltan letras acentuadas', () => {
    expect(matchMenuItem('Champi�on', MENU)).toEqual({ status: 'auto', itemId: 11 });
    expect(matchMenuItem('Lasa��a', MENU)).toEqual({ status: 'auto', itemId: 12 });
  });

  it('deja sin emparejar lo que no existe o es ambiguo', () => {
    expect(matchMenuItem('Inexistente', MENU).status).toBe('unmatched');
    expect(matchMenuItem('Duplicada', MENU).status).toBe('unmatched');
  });
});

describe('buildMapRows', () => {
  it('une nombre y tamaño del grupo', () => {
    const products: RawProduct[] = [
      { id: 29, name: 'Americana', groupName: 'Pizzas Grandes' },
      { id: 90, name: 'Chicha', groupName: 'Bebidas' },
    ];
    expect(buildMapRows(products, MENU)).toEqual([
      { legacyId: 29, legacyName: 'Americana', legacyGroup: 'Pizzas Grandes', itemId: 13, sizeKey: 'grande', status: 'auto' },
      { legacyId: 90, legacyName: 'Chicha', legacyGroup: 'Bebidas', itemId: null, sizeKey: null, status: 'unmatched' },
    ]);
  });
});

describe('CSV del mapa', () => {
  const rows = [
    { legacyId: 1, legacyName: 'Pan, "al ajo"', legacyGroup: 'Entradas', itemId: null, sizeKey: null, status: 'unmatched' as const },
    { legacyId: 2, legacyName: 'Americana', legacyGroup: 'Pizzas Grandes', itemId: 13, sizeKey: 'grande' as const, status: 'auto' as const },
  ];

  it('ida y vuelta conserva las filas (comas y comillas incluidas)', () => {
    expect(parseMapCsv(serializeMapCsv(rows))).toEqual(rows);
  });

  it('acepta punto y coma, CRLF y BOM (Excel en español)', () => {
    const csv = '﻿legacy_id;legacy_name;legacy_group;item_id;size_key;status\r\n7;Pepperoni;Pizzas medianas;14;mediana;auto\r\n';
    expect(parseMapCsv(csv)).toEqual([
      { legacyId: 7, legacyName: 'Pepperoni', legacyGroup: 'Pizzas medianas', itemId: 14, sizeKey: 'mediana', status: 'auto' },
    ]);
  });

  it('rechaza tamaños inválidos con el número de línea', () => {
    const csv = 'legacy_id,legacy_name,legacy_group,item_id,size_key,status\n7,X,G,14,enorme,auto\n';
    expect(() => parseMapCsv(csv)).toThrow(/línea 2.*size_key/);
  });

  it('rechaza item_id no numérico', () => {
    const csv = 'legacy_id,legacy_name,legacy_group,item_id,size_key,status\n7,X,G,abc,,auto\n';
    expect(() => parseMapCsv(csv)).toThrow(/línea 2.*item_id/);
  });
});
