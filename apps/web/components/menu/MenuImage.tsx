import Image from "next/image";
import { PizzaSliceIcon } from "@/components/ui/icons";
import { mediaUrl } from "@/lib/api";

interface MenuImageProps {
  /** Clave R2 de la portada del ítem, o null si no tiene foto todavía. */
  coverImageKey: string | null;
  alt: string;
  sizes: string;
}

/**
 * Foto de un ítem del catálogo (servida por GET /api/media/:key) con
 * placeholder de marca cuando el ítem aún no tiene foto. El contenedor
 * SIEMPRE reserva el mismo aspect-ratio (4/3) — cero layout shift, cargue
 * la imagen o no (Core Web Vitals: CLS).
 */
export default function MenuImage({ coverImageKey, alt, sizes }: MenuImageProps) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream-deep">
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
        <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
          <PizzaSliceIcon className="h-12 w-12 text-brand-blue/20" />
        </div>
      )}
    </div>
  );
}
