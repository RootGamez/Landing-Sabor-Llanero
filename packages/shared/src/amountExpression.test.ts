import { describe, expect, it } from 'vitest';
import { evaluateAmountExpression, hasOperator, MAX_EXPRESSION_LENGTH } from './amountExpression';
import { MAX_CENTS } from './money';

function cents(text: string): number {
  const result = evaluateAmountExpression(text);
  if (!result.ok) throw new Error(`se esperaba ok para "${text}": ${result.error}`);
  return result.cents;
}

function errorOf(text: string): string {
  const result = evaluateAmountExpression(text);
  if (result.ok) throw new Error(`se esperaba error para "${text}", dio ${result.cents}`);
  return result.error;
}

describe('evaluateAmountExpression: valores', () => {
  it.each([
    ['12+10+5+8', 3500],
    ['2*3.5', 700],
    ['10,5+0,5', 1100],
    ['(3+2)*4', 2000],
    ['12.50', 1250],
    ['12', 1200],
    ['100/4', 2500],
    ['10-3.5', 650],
    ['  12 + 10  +  5 ', 2700],
    ['.5', 50],
    ['5.', 500],
    ['((2+3))*(1+1)', 1000],
    ['0.1+0.2', 30],
    ['1.005', 101],
  ])('"%s" → %s céntimos', (text, expected) => {
    expect(cents(text)).toBe(expected);
  });

  it('respeta la precedencia: * y / antes que + y -', () => {
    expect(cents('2+3*4')).toBe(1400);
    expect(cents('10-6/2')).toBe(700);
    expect(cents('2*3+4*5')).toBe(2600);
  });

  it('es asociativa a la izquierda en - y /', () => {
    expect(cents('20-5-5')).toBe(1000);
    expect(cents('100/5/2')).toBe(1000);
  });

  it('redondea a céntimos: 10/3 → 3.33', () => {
    expect(cents('10/3')).toBe(333);
  });

  it('acepta justo el máximo permitido', () => {
    expect(cents('999999.99')).toBe(MAX_CENTS);
  });
});

describe('evaluateAmountExpression: errores', () => {
  it('texto vacío o solo espacios', () => {
    expect(errorOf('')).toMatch(/Escribe un monto/);
    expect(errorOf('   ')).toMatch(/Escribe un monto/);
  });

  it('"-5" es un monto negativo', () => {
    expect(errorOf('-5')).toMatch(/negativo/);
  });

  it('resultado negativo o cero', () => {
    expect(errorOf('5-10')).toMatch(/mayor a 0/);
    expect(errorOf('0')).toMatch(/mayor a 0/);
    expect(errorOf('5-5')).toMatch(/mayor a 0/);
    expect(errorOf('0.004')).toMatch(/mayor a 0/);
  });

  it('división entre cero', () => {
    expect(errorOf('1/0')).toMatch(/dividir entre 0/);
    expect(errorOf('5/(2-2)')).toMatch(/dividir entre 0/);
  });

  it('letras: apunta al carácter inválido', () => {
    expect(errorOf('abc')).toBe("Expresión inválida cerca de 'a'");
    expect(errorOf('12+x')).toBe("Expresión inválida cerca de 'x'");
  });

  it('operadores seguidos: "5++5"', () => {
    expect(errorOf('5++5')).toBe("Expresión inválida cerca de '+'");
    expect(errorOf('5*/5')).toBe("Expresión inválida cerca de '/'");
    expect(errorOf('5+-3')).toBe("Expresión inválida cerca de '-'");
  });

  it('expresión incompleta', () => {
    expect(errorOf('5+')).toMatch(/incompleta/);
    expect(errorOf('(')).toMatch(/incompleta/);
  });

  it('paréntesis sin cerrar o de más', () => {
    expect(errorOf('(3+2')).toMatch(/paréntesis/);
    expect(errorOf('3+2)')).toBe("Expresión inválida cerca de ')'");
    expect(errorOf('()')).toBe("Expresión inválida cerca de ')'");
  });

  it('dos números juntos o con dos puntos decimales', () => {
    expect(errorOf('5 5')).toBe("Expresión inválida cerca de '5'");
    expect(errorOf('1.2.3')).toBe("Expresión inválida cerca de '.3'");
  });

  it('rechaza el máximo + 1 céntimo', () => {
    expect(errorOf('1000000')).toMatch(/máximo/);
    expect(errorOf('999999.99+0.01')).toMatch(/máximo/);
  });

  it('rechaza más de 100 caracteres', () => {
    const long = Array(60).fill('1').join('+');
    expect(long.length).toBeGreaterThan(MAX_EXPRESSION_LENGTH);
    expect(errorOf(long)).toMatch(/demasiado larga/);
    expect(cents('1+'.repeat(49) + '1')).toBe(5000);
  });

  it('nunca ejecuta código: no usa eval/Function', () => {
    expect(errorOf('constructor')).toMatch(/Expresión inválida/);
    expect(errorOf('process.exit()')).toMatch(/Expresión inválida/);
    expect(errorOf('alert(1)')).toMatch(/Expresión inválida/);
    expect(errorOf('1e3')).toMatch(/Expresión inválida/);
  });
});

describe('hasOperator', () => {
  it('detecta operadores y paréntesis, pero no un monto simple', () => {
    expect(hasOperator('12+10')).toBe(true);
    expect(hasOperator('2*3')).toBe(true);
    expect(hasOperator('(5)')).toBe(true);
    expect(hasOperator('12.50')).toBe(false);
    expect(hasOperator('12,5')).toBe(false);
    expect(hasOperator('')).toBe(false);
  });
});
