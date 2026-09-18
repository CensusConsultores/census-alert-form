import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const perfil = "/tmp/perfil-cdp-" + PORT;
fs.rmSync(perfil, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${perfil}`,
  "--window-size=1280,900", "--hide-scrollbars", "--force-device-scale-factor=1",
  "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

let ws, id = 0;
const pend = new Map();
for (let i = 0; i < 60; i++) {
  await esperar(300);
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const t = (await r.json()).find(x => x.type === "page");
    if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; }
  } catch {}
}
if (!ws) { chrome.kill(); throw new Error("Chrome no arrancó"); }
await new Promise(r => ws.addEventListener("open", r, { once: true }));
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id; pend.set(n, (m) => m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const ev = async (expr) => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "error JS");
  return r.result.value;
};
const foto = async (nombre) => {
  const { data } = await cdp("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(nombre, Buffer.from(data, "base64"));
};

export { cdp, ev, foto, esperar, chrome, ws };
