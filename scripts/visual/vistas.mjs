import { cdp, ev, foto, esperar, chrome, ws } from "./cdp.mjs";
await cdp("Page.enable");
await cdp("Page.navigate", { url: "http://localhost:4399/" });
await esperar(3000);
await ev(`document.getElementById("recibes").scrollIntoView({block:"center"}); 1`);
await esperar(800);

const ids = ["correo","informe","causa","red","bolsillo"];
for (let k = 0; k < ids.length; k++) {
  await ev(`document.querySelectorAll("#recibes .pil")[${k}].click(); 1`);
  await esperar(2300);                       // que termine la entrada escalonada
  const m = await ev(`(() => {
    const v = document.querySelector('[data-vista="${ids[k]}"]');
    const p = v.parentElement.getBoundingClientRect();
    let fondo = 0;
    v.querySelectorAll("*").forEach(e => {
      const r = e.getBoundingClientRect();
      if (r.height > 0 && r.bottom > fondo) fondo = r.bottom;
    });
    return { alto: Math.round(p.height), usado: Math.round(fondo - p.top),
             lleno: Math.round((fondo - p.top) / p.height * 100),
             desborde: Math.round(fondo - p.bottom) };
  })()`);
  console.log(`${ids[k].padEnd(9)} pantalla ${m.alto}px · contenido ${m.usado}px · lleno ${m.lleno}%` +
    (m.desborde > 0 ? `  ⚠ SE SALE ${m.desborde}px` : ""));
}
await foto("v_bolsillo.png");
ws.close(); chrome.kill();
