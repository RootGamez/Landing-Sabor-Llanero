import { useCallback, useEffect, useState, type RefObject } from 'react';
import { renderPngBlob, type RenderPngOptions } from '../lib/closureShare';

export type ClosureImageStatus = 'loading' | 'ready' | 'error';

export interface ClosureImage {
  status: ClosureImageStatus;
  blob: Blob | null;
  regenerate: () => void;
}

/** Todo lo que, al cambiar, obliga a generar otra imagen. Son valores primitivos salvo `version`. */
interface ImageInputs {
  version: unknown;
  attempt: number;
  auto: boolean;
  fixedWidth: number | undefined;
  fixedHeight: number | undefined;
  background: string | undefined;
}

/** Resultado de una generación junto con las entradas con que se produjo. */
interface ImageResult {
  inputs: ImageInputs;
  status: 'ready' | 'error';
  blob: Blob | null;
}

function sameInputs(a: ImageInputs, b: ImageInputs): boolean {
  return (
    Object.is(a.version, b.version) &&
    a.attempt === b.attempt &&
    a.auto === b.auto &&
    a.fixedWidth === b.fixedWidth &&
    a.fixedHeight === b.fixedHeight &&
    a.background === b.background
  );
}

/**
 * Genera el PNG de la tarjeta apenas se monta (y al cambiar `version`), no al
 * tocar "Compartir": la hoja de compartir del navegador exige que `share()` se
 * llame enseguida del toque, y capturar el DOM tarda cientos de milisegundos.
 *
 * El resultado se guarda junto con las entradas con que se generó; si ya no
 * coinciden con las actuales (cambió `version` u opciones), se informa
 * `loading` sin blob en el mismo render, para no ofrecer una imagen vieja.
 *
 * Invariante: `nodeRef.current` ya está asignado cuando corre el efecto (el
 * nodo es hijo del componente que llama al hook). Si no lo estuviera, el
 * estado pasa a `error` en vez de quedarse cargando para siempre.
 */
export function useClosureImage(
  nodeRef: RefObject<HTMLElement | null>,
  version: unknown,
  options?: RenderPngOptions,
): ClosureImage {
  // Se usan valores primitivos: un objeto literal nuevo en cada render no debe regenerar la imagen.
  const auto = options?.size === 'auto';
  const fixed = typeof options?.size === 'object' ? options.size : undefined;
  const fixedWidth = fixed?.width;
  const fixedHeight = fixed?.height;
  const background = options?.backgroundColor;
  const [result, setResult] = useState<ImageResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const inputs: ImageInputs = { version, attempt, auto, fixedWidth, fixedHeight, background };
    const node = nodeRef.current;
    if (!node) {
      setResult({ inputs, status: 'error', blob: null });
      return;
    }
    let cancelled = false;
    // Un frame para que el layout de la tarjeta esté pintado antes de capturar.
    const frame = window.requestAnimationFrame(() => {
      const size =
        fixedWidth !== undefined && fixedHeight !== undefined ? { width: fixedWidth, height: fixedHeight } : undefined;
      renderPngBlob(node, { size: auto ? 'auto' : size, backgroundColor: background })
        .then((blob) => {
          if (!cancelled) setResult({ inputs, status: 'ready', blob });
        })
        .catch(() => {
          if (!cancelled) setResult({ inputs, status: 'error', blob: null });
        });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [nodeRef, version, attempt, auto, fixedWidth, fixedHeight, background]);

  const regenerate = useCallback(() => setAttempt((n) => n + 1), []);
  const current: ImageInputs = { version, attempt, auto, fixedWidth, fixedHeight, background };
  const fresh = result !== null && sameInputs(result.inputs, current) ? result : null;
  return { status: fresh?.status ?? 'loading', blob: fresh?.blob ?? null, regenerate };
}
