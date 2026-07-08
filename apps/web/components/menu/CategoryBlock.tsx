"use client";

import { CATALOG_COPY, displayName, type Lang, type Size, type WhatsappConfig } from "@sabor/shared";
import type { CatalogSection } from "@/lib/menuData";
import ItemCard from "@/components/menu/ItemCard";
import MenuHeading from "@/components/menu/MenuHeading";

interface CategoryBlockProps {
  section: CatalogSection;
  sizes: Size[];
  lang: Lang;
  whatsapp: WhatsappConfig;
}

/**
 * Una categoría del catálogo (respuesta de GET /menu-items/sections):
 * encabezado h3 bilingüe + grid responsivo de cards. El backend ya omite
 * categorías sin ítems activos; el estado vacío es solo un backstop.
 */
export default function CategoryBlock({ section, sizes, lang, whatsapp }: CategoryBlockProps) {
  const copy = CATALOG_COPY[lang];

  return (
    <div>
      <MenuHeading title={displayName(section.category, lang)} />
      {section.items.length === 0 ? (
        <p className="text-sm text-ink/60">{copy.noItems}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {section.items.map((item) => (
            <ItemCard key={item.id} item={item} sizes={sizes} lang={lang} whatsapp={whatsapp} />
          ))}
        </div>
      )}
    </div>
  );
}
