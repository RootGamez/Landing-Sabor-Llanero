import { memo, useMemo, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { API_BASE_URL } from '../../lib/env';
import { canResizePhotos, PHOTO_WIDTHS, photoOriginalUrl, photoSrc, photoSrcSet, type PhotoEnv } from '../../lib/posPhotos';

/** Lado de la miniatura en pantalla (px); `size-16` de Tailwind equivale a 64 px. */
const PHOTO_PX = 64;
const [SMALLEST_WIDTH] = PHOTO_WIDTHS;

/** El entorno no cambia mientras la página está abierta: se calcula una vez. */
const PHOTO_ENV: PhotoEnv = { apiBaseUrl: API_BASE_URL, pageHostname: window.location.hostname };
const CAN_RESIZE = canResizePhotos(PHOTO_ENV);

/** `resized`: miniatura de Cloudflare; `original`: segundo intento si la transformación falla; `failed`: queda el ícono. */
type Attempt = 'resized' | 'original' | 'failed';

interface TilePhotoProps {
  imageKey: string | null | undefined;
}

/**
 * Miniatura cuadrada de una celda: caja de tamaño fijo (sin saltos de layout), carga perezosa y
 * decodificación asíncrona. Sin foto, o si fallan la miniatura y la original, queda el ícono: nunca una imagen rota.
 */
export const TilePhoto = memo(function TilePhoto({ imageKey }: TilePhotoProps) {
  const [state, setState] = useState<{ key: string | null | undefined; attempt: Attempt }>({
    key: imageKey,
    attempt: 'resized',
  });
  const attempt: Attempt = state.key === imageKey ? state.attempt : 'resized';
  const sources = useMemo(() => {
    if (!imageKey) return null;
    return {
      resized: { src: photoSrc(imageKey, SMALLEST_WIDTH, PHOTO_ENV), srcSet: photoSrcSet(imageKey, PHOTO_ENV) },
      original: { src: photoOriginalUrl(imageKey, PHOTO_ENV), srcSet: undefined },
    };
  }, [imageKey]);

  function handleError() {
    // Sin transformaciones la miniatura ya es la original: no hay segundo intento.
    setState({ key: imageKey, attempt: attempt === 'resized' && CAN_RESIZE ? 'original' : 'failed' });
  }

  const source = sources && attempt !== 'failed' ? sources[attempt] : null;
  return (
    <span
      aria-hidden="true"
      className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-forest/15 bg-white/60 text-text/60"
    >
      <UtensilsCrossed className="size-7" />
      {source && (
        <img
          key={attempt}
          src={source.src}
          srcSet={source.srcSet}
          sizes={`${PHOTO_PX}px`}
          alt=""
          width={PHOTO_PX}
          height={PHOTO_PX}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={handleError}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
});
