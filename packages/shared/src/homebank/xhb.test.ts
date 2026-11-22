import { describe, expect, it } from 'vitest';
import { MAX_HOMEBANK_INPUT_CHARS, MAX_HOMEBANK_ROWS } from './limits';
import { decodeXmlEntities, ordinalToIsoDate, parseXhb } from './xhb';

// Fixture 100 % sintético: ningún dato real del negocio.
const XHB = `<?xml version="1.0"?>
<homebank v="1.4" d="050200">
<properties title="Demo" curr="1" auto_smode="1"/>
<account key="1" name="Caja &amp; Banco"/>
<pay key="1" name="Proveedor &quot;Uno&quot; &amp; Hijos"/>
<pay key="2" name="Cliente &#65;&#x42;"/>
<cat key="1" name="Compras"/>
<cat key="2" parent="1" name="Insumos"/>
<cat key="3" name="Ventas"/>
<ope date="739396" amount="-125.5" account="1" paymode="3" payee="1" category="2" wording="Pollo &amp; papas" info="F001" tags="semanal frio"/>
<ope date="739397" amount="480.1" account="1" payee="2" category="3" wording="Importación automática"/>
<ope date="739398" amount="-0.1" account="1" category="1"/>
</homebank>`;

describe('ordinalToIsoDate', () => {
  it.each([
    [1, '0001-01-01'],
    [719163, '1970-01-01'],
    [738945, '2024-02-29'],
    [739396, '2025-05-25'],
    [739934, '2026-11-14'],
  ])('ordinal %s -> %s', (ordinal, iso) => {
    expect(ordinalToIsoDate(ordinal)).toBe(iso);
  });

  it.each([0, -3, 1.5, 3652060, Number.NaN])('rechaza ordinal inválido %s', (ordinal) => {
    expect(ordinalToIsoDate(ordinal)).toBeNull();
  });
});

describe('decodeXmlEntities', () => {
  it('decodifica entidades nombradas y numéricas', () => {
    expect(decodeXmlEntities('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos; &#65;&#x42;')).toBe(
      `a & b <c> "d" 'e' AB`,
    );
  });

  it('deja intactas las entidades desconocidas o fuera de rango', () => {
    expect(decodeXmlEntities('&foo; &#99999999999; &#xD800;')).toBe('&foo; &#99999999999; &#xD800;');
  });

  it('no decodifica dos veces', () => {
    expect(decodeXmlEntities('&amp;lt;')).toBe('&lt;');
  });
});

describe('parseXhb', () => {
  it('normaliza ops con categoría padre:hija, payee y entidades', () => {
    const { rows, errors } = parseXhb(XHB);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      date: '2025-05-25',
      amountCents: -12550,
      category: 'Compras:Insumos',
      payee: 'Proveedor "Uno" & Hijos',
      memo: 'Pollo & papas',
      info: 'F001',
      tags: 'semanal frio',
      paymentMethod: 'efectivo',
    });
  });

  it('conserva el signo del ingreso y deja memo tal cual', () => {
    const income = parseXhb(XHB).rows[1];
    expect(income).toMatchObject({
      date: '2025-05-26',
      amountCents: 48010,
      category: 'Ventas',
      payee: 'Cliente AB',
      memo: 'Importación automática',
    });
  });

  it('redondea montos con ruido flotante vía toCents', () => {
    expect(parseXhb(XHB).rows[2]?.amountCents).toBe(-10);
  });

  it('acepta comillas simples y atributos fuera de orden', () => {
    const xml = `<homebank><ope amount='-5' date='739396'/></homebank>`;
    expect(parseXhb(xml).rows).toMatchObject([{ date: '2025-05-25', amountCents: -500 }]);
  });

  it('soporta > dentro de un atributo entrecomillado', () => {
    const xml = `<homebank><pay key="1" name="A > B"/><ope date="739396" amount="-1" payee="1"/></homebank>`;
    expect(parseXhb(xml).rows[0]?.payee).toBe('A > B');
  });

  it('una op rota no tumba el resto y reporta su línea', () => {
    const xml = [
      '<homebank>',
      '<ope date="739396" amount="-1"/>',
      '<ope date="abc" amount="-2"/>',
      '<ope date="739396" amount="x"/>',
      '<ope date="739396"/>',
      '<ope date="739396" amount="-99999999999"/>',
      '<ope date="739397" amount="3"/>',
      '</homebank>',
    ].join('\n');
    const { rows, errors } = parseXhb(xml);
    expect(rows.map((r) => r.amountCents)).toEqual([-100, 300]);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6]);
    expect(errors.every((e) => e.message.length > 0)).toBe(true);
  });

  it('categoría o payee inexistente quedan vacíos; ciclo de padres no cuelga', () => {
    const xml = `<homebank><cat key="1" parent="2" name="A"/><cat key="2" parent="1" name="B"/>
<ope date="739396" amount="-1" category="1" payee="77"/></homebank>`;
    const { rows, errors } = parseXhb(xml);
    expect(errors).toEqual([]);
    expect(rows[0]?.payee).toBe('');
    expect(rows[0]?.category).not.toBe('');
  });

  it('mapea paymode HomeBank a medio de pago del back-office', () => {
    const xml = `<homebank><ope date="739396" amount="-1" paymode="6"/><ope date="739396" amount="-1" paymode="4"/></homebank>`;
    expect(parseXhb(xml).rows.map((r) => r.paymentMethod)).toEqual(['tarjeta', 'transferencia']);
  });

  it('rechaza entrada demasiado grande con un error global', () => {
    const { rows, errors } = parseXhb('x'.repeat(MAX_HOMEBANK_INPUT_CHARS + 1));
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ line: 0, message: expect.stringContaining('tamaño') }]);
  });

  it('rechaza más filas que el límite con un error global', () => {
    const xml = '<ope date="739396" amount="-1"/>'.repeat(MAX_HOMEBANK_ROWS + 1);
    const { rows, errors } = parseXhb(xml);
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ line: 0, message: expect.stringContaining('filas') }]);
  });

  it('texto vacío o sin ops devuelve resultado vacío sin lanzar', () => {
    expect(parseXhb('')).toEqual({ rows: [], errors: [] });
    expect(parseXhb('no es xml')).toEqual({ rows: [], errors: [] });
  });
});
