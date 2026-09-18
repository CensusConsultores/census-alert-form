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
  // El formulario se eliminó y todo se atiende por WhatsApp. La ruta se
  // redirige en vez de devolver 404: hay enlaces repartidos —correos,
  // QR impresos, marcadores— y romperlos pierde al cliente en el punto
  // exacto en el que iba a escribirnos.
  redirects: {
    '/formulario': 'https://wa.me/593978863448?text=' +
      encodeURIComponent('Hola, les escribo desde censusalert.com. Quisiera información sobre Census Alert.'),
  },
  integrations: [sitemap()],
});
