import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeText, type PosCatalog, type PosProduct } from './posCatalog';
import { buildCategoryTiles, productsInCategory, resolveGridView, searchProducts, unitsByCategory } from './posNavigation';

function product(id: number, name: string, categoryId: number, categoryName: string): PosProduct {
  return {
    id,
    name,
    categoryId,
    categoryName,
    colorIndex: 0,
    options: [{ sizeId: null, label: null, priceCents: 1000 }],
    searchText: normalizeText(`${name} ${categoryName}`),
  };
}

const catalog: PosCatalog = {
  categories: [
    { id: 1, name: 'Pizzas', colorIndex: 0 },
    { id: 2, name: 'Bebidas', colorIndex: 1 },
    { id: 3, name: 'Vacía', colorIndex: 2 },
  ],
  products: [product(10, 'Hawaiana', 1, 'Pizzas'), product(11, 'Piña colada', 2, 'Bebidas'), product(12, 'Napolitana', 1, 'Pizzas')],
  truncatedCategories: [],
};

describe('buildCategoryTiles', () => {
  it('cuenta productos y omite categorías vacías', () => {
    const tiles = buildCategoryTiles(catalog);
    assert.deepEqual(tiles.map((t) => [t.category.id, t.productCount]), [[1, 2], [2, 1]]);
  });
});

describe('productsInCategory', () => {
  it('devuelve solo los de la categoría', () => {
    assert.deepEqual(productsInCategory(catalog, 1).map((p) => p.id), [10, 12]);
  });
  it('categoría desconocida da lista vacía', () => {
    assert.deepEqual(productsInCategory(catalog, 99), []);
  });
});

describe('searchProducts', () => {
  it('busca global sin tildes ni mayúsculas', () => {
    assert.deepEqual(searchProducts(catalog, 'PINA').map((p) => p.id), [11]);
  });
  it('texto en blanco no devuelve resultados', () => {
    assert.deepEqual(searchProducts(catalog, '   '), []);
  });
});

describe('unitsByCategory', () => {
  it('suma unidades por categoría', () => {
    const totals = unitsByCategory(catalog, new Map([[10, 2], [12, 1], [11, 0]]));
    assert.equal(totals.get(1), 3);
    assert.equal(totals.has(2), false);
  });
});

describe('resolveGridView', () => {
  it('sin categoría activa muestra las categorías', () => {
    assert.equal(resolveGridView(catalog, null, '').kind, 'categories');
  });
  it('con categoría activa muestra sus productos', () => {
    const view = resolveGridView(catalog, 1, '');
    assert.equal(view.kind, 'products');
    if (view.kind === 'products') assert.equal(view.products.length, 2);
  });
  it('una búsqueda ignora la categoría activa', () => {
    const view = resolveGridView(catalog, 1, 'piña');
    assert.equal(view.kind, 'search');
    if (view.kind === 'search') assert.deepEqual(view.products.map((p) => p.id), [11]);
  });
  it('categoría activa inexistente vuelve al inicio', () => {
    assert.equal(resolveGridView(catalog, 99, '').kind, 'categories');
  });
});
