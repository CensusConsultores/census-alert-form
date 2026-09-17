// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Estático puro. Sin adaptador: la landing se sirve desde Cloudflare Pages,
// que no ejecuta nada del lado del servidor.
//
// `site` no es decorativo: de ahí salen las URL absolutas del canonical, del
// og:url y del sitemap. Sin él, Astro genera rutas relativas y las redes
// sociales no pueden resolver la imagen de previsualización.
export default defineConfig({
  site: 'https://censusalert.com',
  output: 'static',
  integrations: [
    sitemap({
      // El formulario va con `noindex`: incluirlo en el sitemap sería
      // pedirle a Google que indexe una página que le dice que no.
      // Señales contradictorias es lo peor que se le puede dar.
      filter: (pagina) => !pagina.includes("/formulario"),
    }),
  ],
});
