import { cdp, ev, esperar, chrome, ws } from "./cdp.mjs";
import fs from "node:fs";
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 900, height: 760, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: "http://localhost:4399/" });
await esperar(2500);
await ev(`document.getElementById("recibes").scrollIntoView({block:"center"}); 1`);
await esperar(700);
const ids = ["correo","informe","causa","red","bolsillo"];
for (let k = 0; k < ids.length; k++) {
  await ev(`document.querySelectorAll("#recibes .pil")[${k}].click(); 1`);
  await esperar(2400);
  const c = await ev(`(() => { const r = document.querySelector("#recibes .marco").getBoundingClientRect();
    return { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY),
             width: Math.round(r.width), height: Math.round(r.height), scale: 2 }; })()`);
  const { data } = await cdp("Page.captureScreenshot", { format: "png", clip: c, captureBeyondViewport: true });
  fs.writeFileSync(`p_${k}_${ids[k]}.png`, Buffer.from(data, "base64"));
}
ws.close(); chrome.kill();
