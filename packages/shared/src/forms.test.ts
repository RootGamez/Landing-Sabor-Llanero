import { describe, expect, it } from 'vitest';
import {
  EMAIL_MAX,
  FULL_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  emailError,
  fullNameError,
  normalizeEmail,
  normalizeFullName,
  passwordConfirmError,
  passwordError,
  phoneError,
  termsAcceptedError,
} from './forms';

describe('normalizeFullName', () => {
  it('recorta y colapsa espacios', () => {
    expect(normalizeFullName('  Ana   María \t Pérez  ')).toBe('Ana María Pérez');
  });
});

describe('fullNameError', () => {
  it.each(['Ana Pérez', 'María José de la Cruz', "Juan D'Angelo", 'Ana-Lucía Rojas', 'José Ñañez', 'J. Pérez'])(
    'acepta "%s"',
    (name) => {
      expect(fullNameError(name)).toBeNull();
    },
  );

  it('pide nombre y apellido si hay una sola palabra', () => {
    expect(fullNameError('Ana')).toMatch(/nombre y apellido/i);
    expect(fullNameError('   ')).toMatch(/nombre y apellido/i);
  });

  it.each(['Ana 123', 'Ana <b>Pérez</b>', 'Ana_Pérez Gómez', 'Ana @Pérez'])('rechaza caracteres no válidos en "%s"', (name) => {
    expect(fullNameError(name)).toMatch(/solo letras/i);
  });

  it('rechaza nombres demasiado largos', () => {
    const tooLong = `${'a'.repeat(30)} ${'b'.repeat(FULL_NAME_MAX)}`;

    expect(fullNameError(tooLong)).toMatch(new RegExp(`${FULL_NAME_MAX}`));
  });

  it('acepta justo el máximo permitido', () => {
    const name = `${'a'.repeat(29)} ${'b'.repeat(FULL_NAME_MAX - 30)}`;

    expect(name).toHaveLength(FULL_NAME_MAX);
    expect(fullNameError(name)).toBeNull();
  });
});

describe('emailError / normalizeEmail', () => {
  it.each(['ana@example.com', 'ana.perez+pizza@mail.example.co', 'a_b-c@sub.dominio.pe'])('acepta "%s"', (email) => {
    expect(emailError(email)).toBeNull();
  });

  it.each([
    '',
    'sin-arroba.com',
    'ana@',
    '@example.com',
    'ana@example',
    'ana@example.c',
    'ana @example.com',
    'ana@exa mple.com',
    'ana..perez@example.com',
    '.ana@example.com',
    'ana.@example.com',
    'ana@-example.com',
    'ana@example..com',
    'ana@example.com,otro@example.com',
    'ana@example.com\n',
  ])('rechaza "%s"', (email) => {
    expect(emailError(email)).not.toBeNull();
  });

  const emailOfLength = (length: number): string => {
    // 64 (local) + 1 + 63 + 1 + 63 + 1 + resto: etiquetas válidas hasta llegar al largo pedido.
    const tail = length - (64 + 1 + 63 + 1 + 63 + 1 + 4);
    return `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(tail)}.com`;
  };

  it('acepta justo EMAIL_MAX y rechaza uno más (con una estructura válida en ambos casos)', () => {
    expect(emailOfLength(EMAIL_MAX)).toHaveLength(EMAIL_MAX);
    expect(emailError(emailOfLength(EMAIL_MAX))).toBeNull();
    expect(emailError(emailOfLength(EMAIL_MAX + 1))).toMatch(new RegExp(`${EMAIL_MAX}`));
  });

  it('la parte local admite como máximo 64 caracteres', () => {
    expect(emailError(`${'a'.repeat(64)}@example.com`)).toBeNull();
    expect(emailError(`${'a'.repeat(65)}@example.com`)).not.toBeNull();
  });

  it('no se congela con dominios largos o hostiles (sin backtracking exponencial)', () => {
    const hostile = [
      `a@${'a'.repeat(60)}`,
      `a@${'a-'.repeat(2000)}!`,
      `a@${'a'.repeat(100_000)}`,
      `a@${'a.'.repeat(5000)}`,
    ];
    const start = performance.now();

    for (const email of hostile) expect(emailError(email)).not.toBeNull();

    expect(performance.now() - start).toBeLessThan(200);
  });

  it.each(['a#b@example.com', 'a/b@example.com', 'a=b@example.com', 'a?b@example.com', "'@example.com", "a'@example.com"])(
    'rechaza "%s" (el servidor también lo rechaza)',
    (email) => {
      expect(emailError(email)).not.toBeNull();
    },
  );

  it("acepta apóstrofe en la parte local (o'brien@example.com)", () => {
    expect(emailError("o'brien@example.com")).toBeNull();
  });

  it('normaliza a minúsculas y sin espacios en los bordes', () => {
    expect(normalizeEmail('  Ana.Perez@Example.COM ')).toBe('ana.perez@example.com');
  });
});

describe('phoneError', () => {
  it('acepta justo 7 y 15 dígitos', () => {
    expect(phoneError('1234567')).toBeNull();
    expect(phoneError('123456789012345')).toBeNull();
    expect(phoneError('123456')).not.toBeNull();
  });

  it('no acepta que empiece con puntuación suelta', () => {
    expect(phoneError('.......9876543')).not.toBeNull();
  });

  it.each(['987654321', '+51 987 654 321', '(01) 234-5678', '987-654-321'])('acepta "%s"', (phone) => {
    expect(phoneError(phone)).toBeNull();
  });

  it.each(['', '12345', 'abcdefghi', '987654321x', '+51 987 654 321 987 654 321 000', '1234567890123456'])(
    'rechaza "%s"',
    (phone) => {
      expect(phoneError(phone)).not.toBeNull();
    },
  );
});

describe('passwordError / passwordConfirmError', () => {
  it('exige el largo mínimo', () => {
    expect(passwordError('a'.repeat(PASSWORD_MIN - 1))).toMatch(new RegExp(`${PASSWORD_MIN}`));
    expect(passwordError('a'.repeat(PASSWORD_MIN))).toBeNull();
  });

  it('rechaza contraseñas más largas que el máximo', () => {
    expect(passwordError('a'.repeat(PASSWORD_MAX + 1))).not.toBeNull();
    expect(passwordError('a'.repeat(PASSWORD_MAX))).toBeNull();
  });

  it('no impone reglas de composición (se permiten frases largas)', () => {
    expect(passwordError('frase larga para recordar facil')).toBeNull();
  });

  it('la confirmación debe coincidir exactamente', () => {
    expect(passwordConfirmError('abcdefgh1', 'abcdefgh1')).toBeNull();
    expect(passwordConfirmError('abcdefgh1', 'abcdefgh2')).toMatch(/no coinciden/i);
    expect(passwordConfirmError('abcdefgh1', '')).toMatch(/repite/i);
  });
});

describe('termsAcceptedError', () => {
  it('pide aceptar los términos si el checkbox está sin marcar', () => {
    expect(termsAcceptedError(false)).toBe('Debes aceptar los Términos y la Política de Privacidad');
  });

  it('no devuelve error si el checkbox está marcado', () => {
    expect(termsAcceptedError(true)).toBeNull();
  });
});
