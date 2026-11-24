import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Sale, SaleItem } from '@sabor/shared';
import { formatStay, originLabel, toReceiptData } from './receiptData';

const LABELS: ReadonlyMap<string, string> = new Map([
  ['cash', 'Efectivo'],
  ['yape', 'Yape'],
]);

/** Normaliza espacios especiales de Intl ("6:05 p. m.") para comparar. */
const plain = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ');

function item(overrides: Partial<SaleItem> & Pick<SaleItem, 'id' | 'name'>): SaleItem {
  return {
    saleId: 1,
    itemId: null,
    sizeId: null,
    sizeLabel: null,
    unitPriceCents: 1000,
    quantity: 1,
    lineTotalCents: 1000,
    flavors: null,
    note: null,
    ...overrides,
  };
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 7,
    sessionId: 1,
    number: 12,
    // 23:05 UTC = 6:05 p. m. en Lima (UTC-5), mismo día.
    createdAt: '2026-11-22 23:05:00',
    createdBy: 1,
    subtotalCents: 5000,
    discountCents: 0,
    totalCents: 5000,
    paymentMethod: 'yape',
    cashReceivedCents: null,
    changeCents: null,
    orderId: null,
    clientUuid: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    source: 'pos',
    items: [item({ id: 1, name: 'Pizza Pepperoni', sizeLabel: 'Grande', quantity: 2, lineTotalCents: 4000 }), item({ id: 2, name: 'Gaseosa' })],
    ...overrides,
  };
}

describe('comprobante: líneas', () => {
  it('conserva el orden y arma "nombre (talla)" con su importe', () => {
    const data = toReceiptData(sale(), LABELS);
    assert.deepEqual(
      data.lines.map((line) => [line.quantity, line.title, line.lineTotalCents]),
      [
        [2, 'Pizza Pepperoni (Grande)', 4000],
        [1, 'Gaseosa', 1000],
      ],
    );
  });

  it('muestra la presentación vendida como "nombre (presentación)"', () => {
    const data = toReceiptData(
      sale({ items: [item({ id: 1, name: 'Tequeños', sizeId: 5, sizeLabel: 'Media docena', lineTotalCents: 2000 })] }),
      LABELS,
    );
    assert.equal(data.lines[0]?.title, 'Tequeños (Media docena)');
  });

  it('agrega el detalle de nota y sabores como en el ticket', () => {
    const data = toReceiptData(
      sale({ items: [item({ id: 1, name: 'Pizza', note: 'sin cebolla' })] }),
      LABELS,
    );
    assert.deepEqual(data.lines[0]?.details, ['Nota: sin cebolla']);
  });

  it('una línea sin sabores ni nota no trae detalle', () => {
    assert.deepEqual(toReceiptData(sale(), LABELS).lines[1]?.details, []);
  });
});

describe('comprobante: origen', () => {
  it('mesa: etiqueta, hora de apertura y de cobro en Lima y permanencia', () => {
    const data = toReceiptData(
      sale({ table: { tabId: 3, tableLabel: '5', openedAt: '2026-11-22 22:00:00' } }),
      LABELS,
    );
    assert.equal(data.origin.kind, 'table');
    if (data.origin.kind !== 'table') return;
    assert.equal(originLabel(data.origin), 'Mesa 5');
    assert.equal(plain(data.origin.openedAtLabel), '5:00 p. m.');
    assert.equal(plain(data.origin.paidAtLabel), '6:05 p. m.');
    assert.equal(data.origin.stayLabel, '1 h 5 min');
  });

  it('no repite "Mesa" si el rótulo ya lo trae', () => {
    const data = toReceiptData(
      sale({ table: { tabId: 3, tableLabel: 'Mesa 2', openedAt: '2026-11-22 22:00:00' } }),
      LABELS,
    );
    assert.equal(originLabel(data.origin), 'Mesa 2');
  });

  it('una mesa con nombre ("Terraza", "Barra") no se rotula "Mesa Terraza"', () => {
    for (const tableLabel of ['Terraza', 'Barra']) {
      const data = toReceiptData(sale({ table: { tabId: 3, tableLabel, openedAt: '2026-11-22 22:00:00' } }), LABELS);
      assert.equal(originLabel(data.origin), tableLabel);
    }
  });

  it('pedido web cuando hay orderId y no hay mesa', () => {
    const data = toReceiptData(sale({ orderId: 44 }), LABELS);
    assert.equal(originLabel(data.origin), 'Pedido web');
  });

  it('mostrador sin mesa ni pedido; table ausente o null se trata igual', () => {
    assert.equal(originLabel(toReceiptData(sale(), LABELS).origin), 'Mostrador');
    assert.equal(originLabel(toReceiptData(sale({ table: null }), LABELS).origin), 'Mostrador');
  });
});

describe('comprobante: totales y pago', () => {
  it('descuento: se conserva el importe para mostrarlo solo si es mayor que 0', () => {
    const data = toReceiptData(sale({ discountCents: 500, totalCents: 4500 }), LABELS);
    assert.equal(data.discountCents, 500);
    assert.equal(data.subtotalCents - data.discountCents, data.totalCents);
    assert.equal(toReceiptData(sale(), LABELS).discountCents, 0);
  });

  it('efectivo: trae recibido y vuelto con la etiqueta del método', () => {
    const data = toReceiptData(
      sale({ paymentMethod: 'cash', cashReceivedCents: 10000, changeCents: 5000 }),
      LABELS,
    );
    assert.equal(data.methodLabel, 'Efectivo');
    assert.equal(data.cashReceivedCents, 10000);
    assert.equal(data.changeCents, 5000);
  });

  it('sin efectivo recibido no hay vuelto aunque el dato venga sucio', () => {
    const data = toReceiptData(sale({ cashReceivedCents: null, changeCents: 300 }), LABELS);
    assert.equal(data.changeCents, null);
  });

  it('método desconocido usa la clave como etiqueta', () => {
    assert.equal(toReceiptData(sale({ paymentMethod: 'plin' }), LABELS).methodLabel, 'plin');
  });
});

describe('comprobante: anulada y metadatos', () => {
  it('anulada: se marca, pero el motivo interno no sale en el comprobante ni en el texto', () => {
    const data = toReceiptData(sale({ voidedAt: '2026-11-22 23:30:00', voidReason: 'Pedido repetido' }), LABELS);
    assert.equal(data.voided, true);
    assert.match(data.shareText, /\(ANULADA\)/);
    assert.doesNotMatch(data.shareText, /Pedido repetido|[Mm]otivo/);
    assert.doesNotMatch(JSON.stringify(data), /Pedido repetido/);
  });

  it('vigente: no figura como anulada aunque el dato traiga un motivo residual', () => {
    const data = toReceiptData(sale({ voidReason: 'residuo' }), LABELS);
    assert.equal(data.voided, false);
    assert.doesNotMatch(data.shareText, /ANULADA|residuo/);
  });

  it('fecha y hora en Lima, no en UTC (02:05 UTC del 23 sigue siendo 22 en Lima)', () => {
    const data = toReceiptData(sale({ createdAt: '2026-11-23 02:05:00' }), LABELS);
    assert.equal(plain(data.timeLabel), '9:05 p. m.');
    assert.equal(data.dateLabel, 'Domingo 22 de noviembre de 2026');
    assert.equal(data.fileName, 'comprobante-venta-12-2026-11-22.png');
  });

  it('el texto para compartir resume ventas, total y origen', () => {
    const text = toReceiptData(sale({ orderId: 1 }), LABELS).shareText;
    assert.match(text, /Comprobante de venta #12/);
    assert.match(text, /Pedido web/);
    assert.match(text, /2× Pizza Pepperoni \(Grande\)/);
    assert.match(text, /Total: S\/\s?50\.00 \(Yape\)/);
  });

  it('el texto para compartir cierra con la leyenda de documento no tributario', () => {
    const lines = toReceiptData(sale(), LABELS).shareText.split('\n');
    assert.equal(lines.at(-1), 'Documento no válido como boleta ni factura.');
    assert.equal(lines.at(-2), 'Gracias por tu compra.');
  });
});

describe('formatStay', () => {
  it('minutos, horas exactas y horas con minutos', () => {
    assert.equal(formatStay('2026-11-22 22:00:00', '2026-11-22 22:45:00'), '45 min');
    assert.equal(formatStay('2026-11-22 22:00:00', '2026-11-23 00:00:00'), '2 h');
    assert.equal(formatStay('2026-11-22 22:00:00', '2026-11-22 23:05:00'), '1 h 5 min');
  });

  it('null si el cobro es anterior a la apertura o la fecha es ilegible', () => {
    assert.equal(formatStay('2026-11-22 23:00:00', '2026-11-22 22:00:00'), null);
    assert.equal(formatStay('basura', '2026-11-22 22:00:00'), null);
  });
});
