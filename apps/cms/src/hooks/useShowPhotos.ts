import { useCallback, useState } from 'react';
import { readShowPhotos, writeShowPhotos, type ConnectionHint } from '../lib/posPhotos';

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserConnection(): ConnectionHint | undefined {
  return (navigator as Navigator & { connection?: ConnectionHint }).connection;
}

/** Interruptor "Mostrar fotos" del POS, persistido en localStorage (ver `readShowPhotos` para el valor inicial). */
export function useShowPhotos(): [boolean, (next: boolean) => void] {
  const [showPhotos, setShowPhotos] = useState(() => readShowPhotos(browserStorage(), browserConnection()));
  const update = useCallback((next: boolean) => {
    setShowPhotos(next);
    writeShowPhotos(browserStorage(), next);
  }, []);
  return [showPhotos, update];
}
