import type { InspectStats } from './source';
import type { ImportPlan } from './types';

const soles = (amount: number): string =>
  `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function formatInspectReport(stats: InspectStats): string {
  const lines = ['== Aronium pos.db =='];
  for (const [table, total] of Object.entries(stats.counts)) lines.push(`  ${table.padEnd(14)} ${total}`);
  lines.push(`Rango de fechas: ${stats.dateRange.first ?? '-'}  ->  ${stats.dateRange.last ?? '-'}`);
  lines.push('Total vendido por tipo de documento:');
  for (const t of stats.totalsByDocumentType) lines.push(`  ${t.name.padEnd(14)} ${String(t.documents).padStart(6)} docs  ${soles(t.total)}`);
  lines.push('Métodos de pago:');
  for (const p of stats.paymentMethods) lines.push(`  ${p.name.padEnd(14)} ${String(p.payments).padStart(6)} pagos ${soles(p.amount)}`);
  lines.push(`Líneas con cantidad fraccionaria: ${stats.fractionalLines}`);
  lines.push(`Cierres Z (ZReport): ${stats.zReports}`);
  return `${lines.join('\n')}\n`;
}

export function formatBuildSummary(plan: ImportPlan, files: readonly string[]): string {
  const lines = [
    `Sesiones de caja: ${plan.sessions.length}`,
    `Ventas:           ${plan.salesCount}`,
    `Líneas:           ${plan.itemsCount}`,
    `Total esperado:   ${plan.totalCents} céntimos (${soles(plan.totalCents / 100)})`,
    `Archivos SQL:     ${files.length}`,
    `Advertencias:     ${plan.warnings.length}`,
    ...plan.warnings.slice(0, 20).map((w) => `  - ${w}`),
  ];
  if (plan.warnings.length > 20) lines.push(`  ... y ${plan.warnings.length - 20} más`);
  return `${lines.join('\n')}\n`;
}
