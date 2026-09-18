# Verificación visual

Pilota Chrome por CDP para **medir** animaciones y maquetación en vez de
mirarlas. Node 24 trae `WebSocket` global, así que no hace falta puppeteer.

Servir siempre el build, no el dev server: `npm run dev` ha llegado a dar
HTML nuevo con hoja de estilos vieja.

```bash
npm run build
(cd dist && python3 -m http.server 4399 &)
node scripts/visual/vistas.mjs     # % del teléfono que llena cada pantalla
node scripts/visual/probar.mjs     # alturas y solape fotograma a fotograma
node scripts/visual/capturas.mjs   # recorta al .marco, una por pantalla
node scripts/visual/muelle.mjs     # genera el linear() de un muelle
```

Trampas ya pagadas:
- el `clip` de `Page.captureScreenshot` va en coordenadas de **página**:
  hay que sumar `scrollX/scrollY` al `getBoundingClientRect()`
- no dupliques escala: o `deviceScaleFactor` o `clip.scale`, no los dos
- muestrear a mitad de transición y leerlo como estado final miente
