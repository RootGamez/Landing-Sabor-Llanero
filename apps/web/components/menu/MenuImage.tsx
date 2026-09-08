import Image from "next/image";
import { PizzaSliceIcon } from "@/components/ui/icons";
import { mediaUrl } from "@/lib/api";

interface MenuImageProps {
  /** Clave R2 de la portada del ítem, o null si no tiene foto todavía. */
  coverImageKey: string | null;
  alt: string;
  sizes: string;
  /**
   * Clases del marco de la imagen (relación de aspecto + ancho). El contenedor
   * SIEMPRE reserva su espacio antes de que cargue la foto — cero layout shift
   * (Core Web Vitals: CLS). Por defecto, tarjeta vertical 4/3; la fila
   * horizontal de móvil pasa `h-full w-full`.
   */
  frameClassName?: string;
}

/**
 * Foto de un ítem del catálogo (servida por GET /api/media/:key) con
 * placeholder de marca cuando el ítem aún no tiene foto.
 */
export default function MenuImage({
  coverImageKey,
  alt,
  sizes,
  frameClassName = "aspect-[4/3] w-full",
}: MenuImageProps) {
  return (
    <div className={`relative overflow-hidden bg-cream-deep ${frameClassName}`}>
      {coverImageKey ? (
        <Image
          src={mediaUrl(coverImageKey)}
          alt={alt}
          fill
          sizes={sizes}
          loading="lazy"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      ) : (
        // Sin foto: se tiñe con el acento de la card (custom prop `--accent`,
        // heredada del <article>) para que la fila se vea intencional y de
        // marca, no como una imagen rota.
        <div
          className="flex h-full w-full items-center justify-center opacity-30"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--accent, var(--color-brand-blue)) 9%, var(--color-cream-deep))",
            color: "var(--accent, var(--color-brand-blue))",
          }}
          aria-hidden="true"
        >
          <PizzaSliceIcon className="h-9 w-9 sm:h-12 sm:w-12" />
        </div>
      )}
    </div>
  );
}
