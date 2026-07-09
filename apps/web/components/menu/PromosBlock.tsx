"use client";

import type {
  CollectionWithItems,
  Lang,
  MenuItemWithPrices,
  Size,
  WhatsappConfig,
} from "@sabor/shared";
import { TagIcon } from "@/components/ui/icons";
import CollectionRail from "@/components/menu/CollectionRail";

interface PromosBlockProps {
  collection: CollectionWithItems | null;
  sizes: Size[];
  lang: Lang;
  whatsapp: WhatsappConfig;
  onOpen: (item: MenuItemWithPrices) => void;
}

/**
 * Bloque "Promos especiales" con tratamiento visual diferenciado: panel
 * rojo profundo de marca (mismo recurso que las secciones oscuras de la
 * landing: texture-dots-light + resplandores), con las cards blancas
 * brillando encima. Si la colección está vacía o inactiva, no se renderiza.
 */
export default function PromosBlock({ collection, sizes, lang, whatsapp, onOpen }: PromosBlockProps) {
  if (!collection || !collection.isActive || collection.items.length === 0) return null;

  return (
    <div className="texture-dots-light relative overflow-hidden rounded-3xl bg-brand-red-deep bg-linear-to-br from-brand-red to-brand-red-deep p-5 shadow-glow-red sm:p-7 md:p-9">
      {/* Resplandor cálido de fondo */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand-yellow/20 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative">
        <CollectionRail
          collection={collection}
          sizes={sizes}
          lang={lang}
          whatsapp={whatsapp}
          onOpen={onOpen}
          icon={<TagIcon className="h-5 w-5" />}
          dark
        />
      </div>
    </div>
  );
}
