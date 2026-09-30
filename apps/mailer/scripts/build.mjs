// Empaqueta la Lambda en un único dist/index.cjs (CJS, sin node_modules) y lo
// comprime a dist/mailer.zip (como index.js, sin package.json => CJS), listo para subir en la consola de AWS
// (Code -> Upload from -> .zip). Handler: index.handler
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { zipSync } from 'fflate';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  minify: true,
  legalComments: 'none',
});

const code = readFileSync('dist/index.cjs');
writeFileSync('dist/mailer.zip', zipSync({ 'index.js': code }, { level: 9 }));
console.log(`dist/mailer.zip listo (${(code.length / 1024).toFixed(0)} KB sin comprimir)`);
