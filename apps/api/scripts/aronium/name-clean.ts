const BROKEN = String.fromCodePoint(0xfffd);

// Palabras del menú cuya ñ/vocal acentuada suele romperse. Se reparan solo si
// el token roto calza exactamente con una de ellas (cada letra acentuada puede
// haber quedado como 1-3 caracteres basura).
const KNOWN_WORDS: readonly string[] = [
  'champiñon', 'champiñones', 'champiñón', 'tequeños', 'lasaña', 'montañera', 'piña', 'jamón', 'rústica',
  'clásica', 'clásicas', 'carnívora', 'carnívoras', 'maracuyá', 'ñoquis', 'pequeña', 'mamá', 'sándwich',
  'acompañante', 'bebés',
];

const ACCENTED = /[ñáéíóúÑÁÉÍÓÚ]/g;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternFor(word: string): RegExp {
  const source = word
    .split(ACCENTED)
    .map(escapeRegex)
    .join(`${BROKEN}{1,3}`);
  return new RegExp(`^${source}$`, 'i');
}

const KNOWN_PATTERNS = KNOWN_WORDS.map((word) => ({ word, pattern: patternFor(word) }));

function matchCase(original: string, fixed: string): string {
  const first = original.charAt(0);
  return first === first.toUpperCase() && first !== first.toLowerCase() ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
}

function repairToken(token: string): string {
  if (!token.includes(BROKEN)) return token;
  const hit = KNOWN_PATTERNS.find(({ pattern }) => pattern.test(token));
  return hit ? matchCase(token, hit.word) : token;
}

// UTF-8 leído como latin1 ("Ã±" en vez de "ñ"): se revierte solo si queda texto válido.
function repairDoubleEncoding(text: string): string {
  if (!/[ÃÂ]/.test(text)) return text;
  const decoded = Buffer.from(text, 'latin1').toString('utf8');
  return decoded.includes(BROKEN) ? text : decoded;
}

/** Repara mojibake con un mapa conocido; lo que no calza se deja tal cual (nunca se adivina). */
export function repairMojibake(name: string): string {
  return repairDoubleEncoding(name).split(' ').map(repairToken).join(' ');
}

/** Nombre legacy listo para mostrar: reparado, espacios colapsados y primera letra en mayúscula. */
export function cleanLegacyName(name: string): string {
  const repaired = repairMojibake(name).replace(/\s+/g, ' ').trim();
  return repaired.charAt(0).toUpperCase() + repaired.slice(1);
}

/** Nombres que, tras el intento de reparación, siguen con caracteres rotos. */
export function findUnrepairable(names: readonly string[]): string[] {
  return names.filter((name) => cleanLegacyName(name).includes(BROKEN));
}
