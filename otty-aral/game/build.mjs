import * as esbuild from 'esbuild';
import fs from 'fs';

const serve = process.argv.includes('--serve');
fs.mkdirSync('dist', { recursive: true });
for (const f of ['index.html', 'style.css']) fs.copyFileSync(f, 'dist/' + f);

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: !serve && !process.env.NOMIN,
  sourcemap: serve ? 'inline' : false,
  format: 'iife',
  target: ['chrome87'],
  outfile: 'dist/game.js',
  legalComments: 'none',
  charset: 'utf8',
};

if (serve) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 8080 });
  console.log('http://localhost:' + port);
} else {
  await esbuild.build(opts);
  console.log('built dist/game.js', (fs.statSync('dist/game.js').size / 1024).toFixed(0) + ' KB');
}
