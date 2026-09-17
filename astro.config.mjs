// @ts-check
import { defineConfig } from 'astro/config';

// Estático puro. Sin adaptador: la landing se sirve desde Cloudflare
// Workers con Static Assets, que no ejecuta nada del lado del servidor.
//
// Lo único que obligaba a tener adaptador era `src/pages/api/submit.ts`
// (el endpoint del formulario, que se retiró). Si algún día hace falta
// una función —el checkout de Stripe, por ejemplo— se añade `main` en
// wrangler.jsonc, no un adaptador.
export default defineConfig({
  output: 'static',
});
