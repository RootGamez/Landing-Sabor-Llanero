/**
 * Monto con expresiones (como HomeBank): "12+10+5+8" → S/ 35.00.
 *
 * Parser descendente recursivo propio, sin `eval` ni `Function`: el texto lo
 * escribe una persona y llega al servidor de gastos, así que solo se aceptan
 * números, `+ - * /`, paréntesis y espacios.
 *
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := número | '(' expr ')'
 */
import { MAX_CENTS, formatPEN, toCents } from './money';

export const MAX_EXPRESSION_LENGTH = 100;

export type AmountExpressionResult = { ok: true; cents: number } | { ok: false; error: string };

type Token = { kind: 'num'; text: string; value: number } | { kind: 'op'; text: string };

const NUMBER_AT_START = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)/;
const OPERATOR_CHARS = '+-*/()';
const OPERATOR_TEST = /[+\-*/()]/;

class ExpressionError extends Error {}

const invalidNear = (text: string) => new ExpressionError(`Expresión inválida cerca de '${text}'`);

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let rest = text;
  while (rest.length > 0) {
    const char = rest[0]!;
    if (char === ' ' || char === '\t') {
      rest = rest.slice(1);
    } else if (OPERATOR_CHARS.includes(char)) {
      tokens.push({ kind: 'op', text: char });
      rest = rest.slice(1);
    } else {
      const match = NUMBER_AT_START.exec(rest);
      if (!match) throw invalidNear(char);
      tokens.push({ kind: 'num', text: match[0], value: Number(match[0].replace(',', '.')) });
      rest = rest.slice(match[0].length);
    }
  }
  return tokens;
}

class Parser {
  private position = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): number {
    const value = this.expression();
    const extra = this.peek();
    if (extra) throw invalidNear(extra.text);
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private isOp(...operators: string[]): boolean {
    const token = this.peek();
    return token?.kind === 'op' && operators.includes(token.text);
  }

  private expression(): number {
    let value = this.term();
    while (this.isOp('+', '-')) {
      const operator = this.tokens[this.position++]!.text;
      const right = this.term();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.factor();
    while (this.isOp('*', '/')) {
      const operator = this.tokens[this.position++]!.text;
      const right = this.factor();
      if (operator === '/' && right === 0) throw new ExpressionError('No se puede dividir entre 0');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }

  private factor(): number {
    const token = this.peek();
    if (!token) throw new ExpressionError('La expresión está incompleta');
    if (token.kind === 'num') {
      this.position++;
      return token.value;
    }
    if (token.text !== '(') throw invalidNear(token.text);
    this.position++;
    const value = this.expression();
    if (!this.isOp(')')) {
      const extra = this.peek();
      throw extra ? invalidNear(extra.text) : new ExpressionError('Falta cerrar un paréntesis');
    }
    this.position++;
    return value;
  }
}

function toValidCents(value: number): number {
  const tooBig = new ExpressionError(`El monto máximo es ${formatPEN(MAX_CENTS)}`);
  if (!Number.isFinite(value)) throw tooBig;
  if (value <= 0) throw new ExpressionError('El monto debe ser mayor a 0');
  let cents: number;
  try {
    cents = toCents(value);
  } catch {
    throw tooBig;
  }
  if (cents <= 0) throw new ExpressionError('El monto debe ser mayor a 0');
  return cents;
}

/** Evalúa el texto de un monto (con o sin operadores) y devuelve céntimos o un error en español. */
export function evaluateAmountExpression(text: string): AmountExpressionResult {
  const clean = text.trim();
  if (clean.length === 0) return { ok: false, error: 'Escribe un monto (ej. 12.50 o 12+10+5)' };
  if (clean.length > MAX_EXPRESSION_LENGTH) {
    return { ok: false, error: `La expresión es demasiado larga (máximo ${MAX_EXPRESSION_LENGTH} caracteres)` };
  }
  if (clean.startsWith('-')) return { ok: false, error: 'El monto no puede ser negativo' };
  try {
    const value = new Parser(tokenize(clean)).parse();
    return { ok: true, cents: toValidCents(value) };
  } catch (error) {
    if (error instanceof ExpressionError) return { ok: false, error: error.message };
    throw error;
  }
}

/** `true` si el texto contiene operadores o paréntesis (es decir, conviene mostrar el resultado en vivo). */
export function hasOperator(text: string): boolean {
  return OPERATOR_TEST.test(text);
}
