/**
 * Importador de Aronium (F8). Uso (desde apps/api):
 *   pnpm import-aronium inspect <pos.db>
 *   pnpm import-aronium map <pos.db> --menu <menu.json> [--out <dir>]
 *   pnpm import-aronium build <pos.db> --map <product-map.csv> [--menu <menu.json>] [--from YYYY-MM-DD] [--out <dir>]
 * Salida por defecto: <repo>/legacy-import/ (ignorada por git). Ver README.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { parseMapCsv, serializeMapCsv } from './map-csv';
import { buildMapRows, fillSlugs, missingSlugs } from './product-map';
import { formatBuildSummary, formatInspectReport } from './report';
import { batchStatements, renderPlan, renderRelinkSql, renderRollbackSql, renderVerifySql } from './sql';
import { collectInspectStats, openPosDb, readRawData } from './source';
import { buildPlan } from './transform';
import type { MenuEntry } from './types';

const DEFAULT_OUT_DIR = path.resolve(import.meta.dirname, '../../../../legacy-import');
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const menuSchema = z.array(
  z.object({ id: z.number().int().positive(), nameEs: z.string(), categorySlug: z.string(), slug: z.string().optional() }),
);

const USAGE = `Uso:
  import-aronium inspect <pos.db>
  import-aronium map <pos.db> --menu <menu.json> [--out <dir>]
  import-aronium build <pos.db> --map <product-map.csv> [--menu <menu.json>] [--from YYYY-MM-DD] [--out <dir>]
`;

const out = (text: string): void => {
  process.stdout.write(text);
};

function readMenu(file: string): MenuEntry[] {
  return menuSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function writeFile(dir: string, name: string, content: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, name);
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

function runInspect(dbPath: string): void {
  out(formatInspectReport(collectInspectStats(openPosDb(dbPath))));
}

function runMap(dbPath: string, menuFile: string, outDir: string): void {
  const rows = buildMapRows(readRawData(openPosDb(dbPath)).products, readMenu(menuFile));
  const target = writeFile(outDir, 'product-map.csv', serializeMapCsv(rows));
  const auto = rows.filter((r) => r.status === 'auto').length;
  out(`${target}\n  ${auto} emparejados, ${rows.length - auto} sin emparejar (completa item_slug a mano; item_id es opcional).\n`);
}

interface BuildArgs {
  dbPath: string;
  mapFile: string;
  menuFile: string | undefined;
  outDir: string;
  from: string | undefined;
}

function runBuild({ dbPath, mapFile, menuFile, outDir, from }: BuildArgs): void {
  if (from !== undefined && !ISO_DAY.test(from)) throw new Error(`--from debe ser YYYY-MM-DD (recibido "${from}")`);
  const parsed = parseMapCsv(fs.readFileSync(mapFile, 'utf8'));
  const menu = menuFile ? readMenu(menuFile) : null;
  const map = menu ? fillSlugs(parsed, menu) : parsed;
  const absent = menu ? missingSlugs(map, menu) : [];
  const plan = buildPlan(readRawData(openPosDb(dbPath)), map, { from });
  const batches = batchStatements(renderPlan(plan));
  const files = batches.map((batch, index) => {
    const name = `aronium-${String(index + 1).padStart(3, '0')}.sql`;
    return writeFile(outDir, name, `-- Aronium ${index + 1}/${batches.length}\n${batch.join('\n')}\n`);
  });
  const verify = renderVerifySql({ ...plan, sessionsCount: plan.sessions.length });
  const verifyFile = writeFile(outDir, 'verify.sql', verify);
  const relinkFile = writeFile(outDir, 'relink-items.sql', renderRelinkSql(plan.mapRows));
  writeFile(outDir, 'rollback-aronium.sql', renderRollbackSql());
  if (absent.length > 0) out(`Aviso: ${absent.length} slug(s) del CSV no existen en el menú: ${absent.join(', ')}
`);
  out(formatBuildSummary(plan, files));
  out(`Verificación: ${verifyFile}\nRe-vincular ítems (tras corregir el CSV): ${relinkFile}\n`);
}

function requireValue(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Falta ${label}\n${USAGE}`);
  return value;
}

function main(argv: string[]): void {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      menu: { type: 'string' },
      map: { type: 'string' },
      from: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const [command, dbPath] = positionals;
  const outDir = values.out ? path.resolve(values.out) : DEFAULT_OUT_DIR;
  const db = requireValue(dbPath, '<pos.db>');
  if (command === 'inspect') return runInspect(db);
  if (command === 'map') return runMap(db, requireValue(values.menu, '--menu <menu.json>'), outDir);
  if (command === 'build') {
    const mapFile = requireValue(values.map, '--map <product-map.csv>');
    return runBuild({ dbPath: db, mapFile, menuFile: values.menu, outDir, from: values.from });
  }
  throw new Error(`Subcomando desconocido "${command ?? ''}"\n${USAGE}`);
}

try {
  main(process.argv.slice(2));
} catch (error: unknown) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
