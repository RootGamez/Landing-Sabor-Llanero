import { describe, expect, it } from 'vitest';
import { cleanLegacyName, findUnrepairable, repairMojibake } from './name-clean';

describe('repairMojibake', () => {
  it('repara ñ y vocales acentuadas rotas de palabras conocidas', () => {
    expect(repairMojibake('Champi�on')).toBe('Champiñon');
    expect(repairMojibake('Teque�os')).toBe('Tequeños');
    expect(repairMojibake('Lasa�a')).toBe('Lasaña');
    expect(repairMojibake('Jam�n y queso')).toBe('Jamón y queso');
  });

  it('repara doble codificación UTF-8 leída como latin1', () => {
    expect(repairMojibake('LasaÃ±a')).toBe('Lasaña');
    expect(repairMojibake('TequeÃ±os')).toBe('Tequeños');
  });

  it('no toca texto sano', () => {
    expect(repairMojibake('Champiñón')).toBe('Champiñón');
  });

  it('deja intactas las palabras que no puede reparar con certeza', () => {
    expect(repairMojibake('Xyz�abc')).toBe('Xyz�abc');
  });
});

describe('cleanLegacyName', () => {
  it('capitaliza la primera letra y colapsa espacios', () => {
    expect(cleanLegacyName('  pepperoni ')).toBe('Pepperoni');
    expect(cleanLegacyName('Rompedieta   mix')).toBe('Rompedieta mix');
  });

  it('repara y capitaliza a la vez', () => {
    expect(cleanLegacyName('teque�os')).toBe('Tequeños');
  });
});

describe('findUnrepairable', () => {
  it('lista los nombres que todavía traen caracteres rotos', () => {
    expect(findUnrepairable(['Pepperoni', 'Xyz�abc', 'Lasa�a'])).toEqual(['Xyz�abc']);
  });
});
