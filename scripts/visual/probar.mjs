import { cdp, ev, foto, esperar, chrome, ws } from "./cdp.mjs";
import fs from "node:fs";

await cdp("Page.enable");
await cdp("Page.navigate", { url: "http://localhost:4321/" });
await esperar(3000);

// Encuadrar la sección
await ev(`document.getElementById("recibes").scrollIntoView({block:"start"}); scrollBy(0,-60); 1`);
await esperar(900);

const estado = () => ev(`(() => {
  const s = document.getElementById("recibes");
  if (!s) return "SIN SECCION";
  return Array.from(s.querySelectorAll(".rec__li")).map((li,k) => {
    const c = li.querySelector(".caja"), p = li.querySelector(".pil"), t = li.querySelector(".tarj");
    const g = (e) => getComputedStyle(e);
    return k + (li.classList.contains("is-on") ? "*" : " ")
      + " caja=" + Math.round(c.getBoundingClientRect().height)
      + " pil(h" + p.offsetHeight + " op" + (+g(p).opacity).toFixed(2) + ")"
      + " tarj(h" + t.offsetHeight + " op" + (+g(t).opacity).toFixed(2) + ")";
  }).join("\\n");
})()`);

console.log("═══ REPOSO (punto 0 abierto) ═══");
console.log(await estado());
await foto("a_reposo.png");

// Solapamiento: ¿alguna caja muestra pil y tarj visibles a la vez?
const solape = () => ev(`(() => {
  const s = document.getElementById("recibes");
  let peor = 0, quien = -1;
  Array.from(s.querySelectorAll(".rec__li")).forEach((li,k) => {
    const p = +getComputedStyle(li.querySelector(".pil")).opacity;
    const t = +getComputedStyle(li.querySelector(".tarj")).opacity;
    const m = Math.min(p, t);
    if (m > peor) { peor = m; quien = k; }
  });
  return { peor: +peor.toFixed(3), quien };
})()`);

console.log("\n═══ CLIC en el punto 3 («La red de relacionados») ═══");
await ev(`document.querySelectorAll("#recibes .pil")[3].click(); 1`);

const marcas = [0, 100, 200, 320, 460, 620, 900, 1300, 1800];
let previo = 0;
for (const t of marcas) {
  await esperar(t - previo); previo = t;
  const s = await solape();
  const altos = await ev(`Array.from(document.querySelectorAll("#recibes .caja")).map(c=>Math.round(c.getBoundingClientRect().height)).join(" ")`);
  console.log(`t=${String(t).padStart(4)}ms  altos=[${altos}]  solape_max=${s.peor} (fila ${s.quien})`);
  if ([200, 460, 1800].includes(t)) await foto(`b_${t}.png`);
}

console.log("\n═══ FINAL ═══");
console.log(await estado());
await foto("c_final.png");

ws.close(); chrome.kill();
