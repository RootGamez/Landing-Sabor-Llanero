import { EmptyState } from '../ui/EmptyState';

interface ComingSoonProps {
  title: string;
  description: string;
}

/** Contenido común de las páginas del back-office que aún no están implementadas. */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">{title}</h1>
        <p className="mt-1 max-w-prose text-sm text-text-muted">{description}</p>
      </div>
      <div className="rounded-xl2 border-2 border-dashed border-border bg-surface">
        <EmptyState
          title="Próximamente"
          description="Estamos preparando esta sección. Pronto podrás usarla desde aquí."
        />
      </div>
    </div>
  );
}
