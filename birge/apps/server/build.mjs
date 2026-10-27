// Серверді бір файлға жинайды: @birge/shared ішіне кіреді, қалған npm пакеттері сыртта қалады.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => name !== '@birge/shared');

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  external: [...external, 'pino-pretty'],
  logLevel: 'info',
});
