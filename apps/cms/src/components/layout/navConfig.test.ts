import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NAV_AREAS, ROOT_ITEMS, areaForPath, filterNavAreas, filterRootItems } from './navConfig';

const allItems = NAV_AREAS.flatMap((a) => a.groups.flatMap((g) => g.items));

describe('areaForPath', () => {
  it('clasifica las rutas en su área', () => {
    assert.equal(areaForPath(NAV_AREAS, '/ventas/pos'), 'pos');
    assert.equal(areaForPath(NAV_AREAS, '/gastos'), 'pos');
    assert.equal(areaForPath(NAV_AREAS, '/reportes'), 'pos');
    assert.equal(areaForPath(NAV_AREAS, '/tienda/menu'), 'carta');
    assert.equal(areaForPath(NAV_AREAS, '/ajustes/usuarios'), 'carta');
    assert.equal(areaForPath(NAV_AREAS, '/tienda/pedidos'), 'web');
    assert.equal(areaForPath(NAV_AREAS, '/tienda/sorteo'), 'web');
  });

  it('resuelve subrutas dinámicas al área del padre', () => {
    assert.equal(areaForPath(NAV_AREAS, '/tienda/menu/abc-123'), 'carta');
  });

  it('prefiere la coincidencia más específica', () => {
    assert.equal(areaForPath(NAV_AREAS, '/gastos/importar'), 'pos');
  });

  it('devuelve null para la raíz, el perfil y rutas desconocidas', () => {
    assert.equal(areaForPath(NAV_AREAS, '/'), null);
    assert.equal(areaForPath(NAV_AREAS, '/ajustes/perfil'), null);
    assert.equal(areaForPath(NAV_AREAS, '/no-existe'), null);
    assert.equal(areaForPath(NAV_AREAS, '/tienda/menuxyz'), null);
  });
});

describe('filtrado por rol', () => {
  it('el cajero solo ve POS (punto de venta y cierres)', () => {
    const areas = filterNavAreas(NAV_AREAS, 'cashier');
    assert.deepEqual(areas.map((a) => a.id), ['pos']);
    const links = areas[0]!.groups.flatMap((g) => g.items.map((i) => i.to));
    assert.deepEqual(links, ['/ventas/pos', '/ventas/cierres']);
    assert.deepEqual(filterRootItems(ROOT_ITEMS, 'cashier').map((i) => i.to), ['/ajustes/perfil']);
  });

  it('admin ve las 3 áreas pero no Usuarios; owner sí', () => {
    const admin = filterNavAreas(NAV_AREAS, 'admin');
    assert.equal(admin.length, 3);
    assert.ok(!admin.flatMap((a) => a.groups.flatMap((g) => g.items)).some((i) => i.to === '/ajustes/usuarios'));
    const owner = filterNavAreas(NAV_AREAS, 'owner');
    assert.ok(owner.flatMap((a) => a.groups.flatMap((g) => g.items)).some((i) => i.to === '/ajustes/usuarios'));
  });

  it('sin rol no muestra ítems restringidos y no muta la config', () => {
    const before = allItems.length;
    const areas = filterNavAreas(NAV_AREAS, undefined);
    assert.deepEqual(areas.map((a) => a.id), ['pos']);
    assert.equal(allItems.length, before);
  });
});

describe('integridad de la config', () => {
  it('no repite rutas entre áreas', () => {
    const tos = allItems.map((i) => i.to);
    assert.equal(new Set(tos).size, tos.length);
  });
});
