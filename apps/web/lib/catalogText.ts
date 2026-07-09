/**
 * La descripción de un ítem suele ser la lista de ingredientes separada por
 * comas ("Jamón, piña, mozzarella"). En el modal se muestran como chips —
 * mucho más escaneable que un párrafo — pero solo cuando el texto realmente
 * tiene esa forma: si el dueño escribió prosa desde el CMS, se respeta.
 */

/** Un fragmento más largo que esto casi seguro es prosa, no un ingrediente. */
const MAX_INGREDIENT_LENGTH = 30;

/** Puntuación de oración: delata prosa aunque haya comas. */
const SENTENCE_PUNCTUATION = /[.:;!?]/;

export function parseIngredients(description: string): string[] | null {
  const parts = description
    .split(/[,·•]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;
  if (parts.some((part) => part.length > MAX_INGREDIENT_LENGTH || SENTENCE_PUNCTUATION.test(part))) {
    return null;
  }
  // Dedupe: un ingrediente repetido en el CMS produciría keys duplicadas en React.
  return [...new Set(parts)];
}
