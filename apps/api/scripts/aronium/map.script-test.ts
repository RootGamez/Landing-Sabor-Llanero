import { describe, expect, it } from 'vitest';
import { buildMapRows, fillSlugs, matchMenuItem, normalizeName, sizeFromGroup } from './product-map';
import { parseMapCsv, serializeMapCsv } from './map-csv';
import type { MenuEntry, RawProduct } from './types';

const MENU: MenuEntry[] = [
  { id: 11, nameEs: 'Champiñón', categorySlug: 'clasicas', slug: 'champinon' },
  { id: 12, nameEs: 'Lasaña', categorySlug: 'pastas', slug: 'lasana' },
  { id: 13, nameEs: 'Americana', categorySlug: 'clasicas', slug: 'americana' },
  { id: 14, nameEs: 'Pepperoni', categorySlug: 'clasicas', slug: 'pepperoni' },
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
    expect(matchMenuItem('PEPPERONI', MENU)).toEqual({ status: 'auto', itemId: 14, itemSlug: 'pepperoni' });
  });

  it('tolera bytes rotos (�) donde faltan letras acentuadas', () => {
    expect(matchMenuItem('Champi�on', MENU)).toEqual({ status: 'auto', itemId: 11, itemSlug: 'champinon' });
    expect(matchMenuItem('Lasa��a', MENU)).toEqual({ status: 'auto', itemId: 12, itemSlug: 'lasana' });
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
      { legacyId: 29, legacyName: 'Americana', legacyGroup: 'Pizzas Grandes', itemId: 13, itemSlug: 'americana', sizeKey: 'grande', status: 'auto' },
      { legacyId: 90, legacyName: 'Chicha', legacyGroup: 'Bebidas', itemId: null, itemSlug: null, sizeKey: null, status: 'unmatched' },
    ]);
  });
});

describe('CSV del mapa', () => {
  const rows = [
    { legacyId: 1, legacyName: 'Pan, "al ajo"', legacyGroup: 'Entradas', itemId: null, itemSlug: null, sizeKey: null, status: 'unmatched' as const },
    { legacyId: 2, legacyName: 'Americana', legacyGroup: 'Pizzas Grandes', itemId: 13, itemSlug: 'americana', sizeKey: 'grande' as const, status: 'auto' as const },
  ];

  it('ida y vuelta conserva las filas (comas y comillas incluidas)', () => {
    expect(parseMapCsv(serializeMapCsv(rows))).toEqual(rows);
  });

  it('acepta punto y coma, CRLF y BOM (Excel en español)', () => {
    const csv = '﻿legacy_id;legacy_name;legacy_group;item_id;size_key;status\r\n7;Pepperoni;Pizzas medianas;14;mediana;auto\r\n';
    expect(parseMapCsv(csv)).toEqual([
      { legacyId: 7, legacyName: 'Pepperoni', legacyGroup: 'Pizzas medianas', itemId: 14, itemSlug: null, sizeKey: 'mediana', status: 'auto' },
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

describe('item_slug en el CSV', () => {
  it('el formato viejo de 6 columnas sigue leyéndose (slug null)', () => {
    const csv = ['legacy_id,legacy_name,legacy_group,item_id,size_key,status', '7,Pepperoni,Pizzas medianas,14,mediana,auto', ''].join('\n');
    expect(parseMapCsv(csv)[0]).toMatchObject({ itemId: 14, itemSlug: null, sizeKey: 'mediana' });
  });

  it('lee el slug por nombre de columna, sin importar el orden', () => {
    const csv = ['legacy_id,legacy_name,legacy_group,size_key,item_slug,item_id,status', '7,Pepperoni,G,grande,pepperoni,,auto', ''].join('\n');
    expect(parseMapCsv(csv)[0]).toMatchObject({ itemId: null, itemSlug: 'pepperoni', sizeKey: 'grande' });
  });

  it('rechaza slugs con caracteres raros', () => {
    const csv = ['legacy_id,legacy_name,legacy_group,item_id,item_slug,size_key,status', "7,X,G,,pe'pperoni,,auto", ''].join('\n');
    expect(() => parseMapCsv(csv)).toThrow(/línea 2.*item_slug/);
  });
});

describe('fillSlugs', () => {
  it('completa el slug de filas con item_id usando el menú', () => {
    const rows = [{ legacyId: 1, legacyName: 'A', legacyGroup: '', itemId: 13, itemSlug: null, sizeKey: null, status: 'auto' as const }];
    expect(fillSlugs(rows, MENU)[0]?.itemSlug).toBe('americana');
  });

  it('falla si el item_id no está en el menú', () => {
    const rows = [{ legacyId: 1, legacyName: 'A', legacyGroup: '', itemId: 999, itemSlug: null, sizeKey: null, status: 'auto' as const }];
    expect(() => fillSlugs(rows, MENU)).toThrow(/999/);
  });

  it('no toca filas que ya traen slug o no tienen ítem', () => {
    const rows = [
      { legacyId: 1, legacyName: 'A', legacyGroup: '', itemId: 13, itemSlug: 'otro', sizeKey: null, status: 'auto' as const },
      { legacyId: 2, legacyName: 'B', legacyGroup: '', itemId: null, itemSlug: null, sizeKey: null, status: 'unmatched' as const },
    ];
    expect(fillSlugs(rows, MENU)).toEqual(rows);
  });
});
