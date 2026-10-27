import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Әр тест өз PGlite дерекқорын (WebAssembly-дегі Postgres) іске қосады — бұл бірнеше секунд алады.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
