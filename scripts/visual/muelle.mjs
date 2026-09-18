// Mismo muelle que Apple en FORMA (zeta 0.7, sobrepasa y vuelve) pero
// más flojo, para que el recorrido dure ~1.7x lo que dura el suyo.
const m = 1, k = 35, c = 8.3, v0 = 0, T = 1.7;
const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
const wd = w0 * Math.sqrt(1 - z * z);
const x = (t) => 1 - Math.exp(-z * w0 * t) *
  (Math.cos(wd * t) + ((z * w0 + v0) / wd) * Math.sin(wd * t));
const N = 44, p = [];
for (let i = 0; i <= N; i++) p.push(+x((i / N) * T).toFixed(4));
p[p.length - 1] = 1;
const cruce = p.findIndex(v => v >= 0.99) / N * T;
console.log(`zeta=${z.toFixed(2)} pico=${(Math.max(...p)*100-100).toFixed(1)}%  llega al 99% en ${(cruce*1000).toFixed(0)}ms de ${T*1000}ms`);
console.log("linear(" + p.join(", ") + ")");
