import GalleryGrid from "@/components/ui/GalleryGrid";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { galleryImages } from "@/lib/galleryImages";

/**
 * Galería de fotos del local y los productos.
 */
export default function Gallery() {
  return (
    <section id="galeria" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          title="Nuestra Galería"
          subtitle="Un vistazo a lo que sale de nuestro horno"
        />
        <Reveal>
          <GalleryGrid images={galleryImages} />
        </Reveal>
      </div>
    </section>
  );
}
