import { Link } from 'react-router-dom';
import { Pencil, Star, Trash2 } from 'lucide-react';
import { formatPrice } from '../../lib/format';
import { mediaUrl } from '../../lib/format';
import type { MenuItemWithCover } from '../../lib/adminTypes';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/Button';

interface MenuItemAdminCardProps {
  item: MenuItemWithCover;
  /** Nombre de la categoría del ítem (para mostrar contexto en la card). */
  categoryName?: string;
  /** true si la categoría del ítem vende por tamaño (el precio vive en la categoría). */
  categoryHasSizes?: boolean;
  onDelete: (item: MenuItemWithCover) => void;
  deleting?: boolean;
}

/** Card de ítem del menú para el listado del CMS, con acciones de administración. */
export function MenuItemAdminCard({
  item,
  categoryName,
  categoryHasSizes,
  onDelete,
  deleting,
}: MenuItemAdminCardProps) {
  return (
    <Card className="group border-forest/15 transition-all hover:border-forest hover:shadow-sticker-lime">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {item.coverImageKey ? (
          <img
            src={mediaUrl(item.coverImageKey)}
            alt={item.nameEs}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted">
            <span className="rounded-md bg-surface px-2 py-1 text-xs font-semibold">Sin imagen</span>
          </div>
        )}
        {item.isFeatured && (
          <Badge variant="accent" className="absolute left-2 top-2 -rotate-3">
            <Star className="size-3" />
            Destacado
          </Badge>
        )}
        <Badge variant={item.isActive ? 'success' : 'muted'} className="absolute right-2 top-2">
          {item.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-text">{item.nameEs}</h3>
        {!item.nameEn && (
          <Badge variant="outline" className="w-fit">
            Sin traducir (EN)
          </Badge>
        )}
        <div className="mt-auto flex items-baseline gap-2">
          <span className="font-display text-lg font-bold text-forest">
            {item.price != null
              ? formatPrice(item.price)
              : categoryHasSizes
                ? 'Precio por tamaño'
                : '—'}
          </span>
        </div>
        {categoryName && <p className="text-xs text-text-muted">{categoryName}</p>}

        <div className="mt-2 flex items-center gap-2">
          <Button asChild variant="secondary" size="sm" className="flex-1">
            <Link to={`/menu/${item.id}`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleting}
            onClick={() => onDelete(item)}
            aria-label={`Eliminar ${item.nameEs}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
