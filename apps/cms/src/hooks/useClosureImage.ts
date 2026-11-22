import { useCallback, useEffect, useState, type RefObject } from 'react';
import { renderPngBlob } from '../lib/closureShare';

export type ClosureImageStatus = 'loading' | 'ready' | 'error';

export interface ClosureImage {
  status: ClosureImageStatus;
  blob: Blob | null;
  regenerate: () => void;
}

/**
 * Genera el PNG de la tarjeta apenas se monta (y al cambiar `version`), no al
 * tocar "Compartir": la hoja de compartir del navegador exige que `share()` se
 * llame enseguida del toque, y capturar el DOM tarda cientos de milisegundos.
 */
export function useClosureImage(nodeRef: RefObject<HTMLElement | null>, version: unknown): ClosureImage {
  const [state, setState] = useState<{ status: ClosureImageStatus; blob: Blob | null }>({
    status: 'loading',
    blob: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    let cancelled = false;
    setState({ status: 'loading', blob: null });
    // Un frame para que el layout de la tarjeta esté pintado antes de capturar.
    const frame = window.requestAnimationFrame(() => {
      renderPngBlob(node)
        .then((blob) => !cancelled && setState({ status: 'ready', blob }))
        .catch(() => !cancelled && setState({ status: 'error', blob: null }));
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [nodeRef, version, attempt]);

  const regenerate = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, regenerate };
}
