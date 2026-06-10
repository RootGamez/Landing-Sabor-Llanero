import GalleryGrid from "@/components/ui/GalleryGrid";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { galleryImages } from "@/lib/galleryImages";

/**
 * Galería sobre fondo carbón cálido: las fotos brillan como
 * en la vitrina de un horno.
 */
export default function Gallery() {
  return (
    <section id="galeria" className="texture-dots-light bg-charcoal py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          kicker="Galería"
          title="Directo del Horno"
          subtitle="Un vistazo a lo que preparamos cada tarde"
          light
        />
        <Reveal>
          <GalleryGrid images={galleryImages} />
        </Reveal>
      </div>
    </section>
  );
}
