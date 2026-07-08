"use client";

import type { ReactNode } from "react";
import type { CollectionWithItems, Lang, Size, WhatsappConfig } from "@sabor/shared";
import { CATALOG_UI, displayCollectionTitle } from "@/lib/catalogUi";
import Carousel from "@/components/menu/Carousel";
import ItemCard from "@/components/menu/ItemCard";
import MenuHeading from "@/components/menu/MenuHeading";

interface CollectionRailProps {
  /** Colección ya filtrada (activa y con ítems); null/vacía ⇒ no renderiza nada. */
  collection: CollectionWithItems | null;
  sizes: Size[];
  lang: Lang;
  whatsapp: WhatsappConfig;
  icon?: ReactNode;
  /** Para rails montados sobre fondo oscuro (bloque de promos). */
  dark?: boolean;
}

/**
 * Rail horizontal de una colección de merchandising (top_sellers /
 * daily_featured / promos): encabezado h3 + carrusel scroll-snap de cards.
 * Colecciones vacías o inactivas NO se renderizan — ni su título
 * (requisito de la fase 5; el fetcher ya las filtra, esto es el backstop).
 */
export default function CollectionRail({
  collection,
  sizes,
  lang,
  whatsapp,
  icon,
  dark = false,
}: CollectionRailProps) {
  if (!collection || !collection.isActive || collection.items.length === 0) return null;

  const ui = CATALOG_UI[lang];

  return (
    <div>
      <MenuHeading icon={icon} title={displayCollectionTitle(collection, lang)} light={dark} />
      <Carousel prevLabel={ui.prev} nextLabel={ui.next} dark={dark}>
        {collection.items.map((item) => (
          <div key={item.id} className="w-[16rem] shrink-0 snap-start sm:w-[18rem]">
            <ItemCard
              item={item}
              sizes={sizes}
              lang={lang}
              whatsapp={whatsapp}
              imageSizes="(max-width: 640px) 16rem, 18rem"
              compact
            />
          </div>
        ))}
      </Carousel>
    </div>
  );
}
