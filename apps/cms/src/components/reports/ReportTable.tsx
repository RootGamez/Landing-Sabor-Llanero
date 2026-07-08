interface Column<T> {
  key: keyof T;
  label: string;
}

interface ReportTableProps<T extends Record<string, unknown>> {
  title: string;
  rows: T[] | undefined;
  loading: boolean;
  columns: Column<T>[];
  emptyMessage?: string;
}

export function ReportTable<T extends Record<string, unknown>>({
  title,
  rows,
  loading,
  columns,
  emptyMessage = 'Sin datos para el período seleccionado.',
}: ReportTableProps<T>) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-text-muted">
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} className="px-3 py-2">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading &&
              Array.from({ length: 3 }, (_, i) => (
                <tr key={`skeleton-${i}`}>
                  <td colSpan={columns.length} className="px-3 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-border" />
                  </td>
                </tr>
              ))}
            {!loading && (!rows || rows.length === 0) && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-center text-text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              rows?.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-3 py-2 text-text">
                      {String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
