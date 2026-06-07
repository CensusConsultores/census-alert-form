// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// output 'static' en Astro 6+ prerenderea las páginas .astro y permite
// que los endpoints API (src/pages/api/*) corran server-side en Vercel.
// Es el equivalente al antiguo 'hybrid' que fue removido.
export default defineConfig({
  output: 'static',
  adapter: vercel(),
});
