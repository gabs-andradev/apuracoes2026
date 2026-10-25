// Reduz o GeoJSON dos estados (Douglas-Peucker + arredondamento) e acerta o sentido dos anéis para o d3-geo.
const fs = require('fs');
const [, , src, dst, tolArg] = process.argv;
const TOL = Number(tolArg || 0.02);

function sqSegDist(p, a, b) {
  let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
  if (dx || dy) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}
function dp(pts, tol) {
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]], t2 = tol * tol;
  while (stack.length) {
    const [s, e] = stack.pop(); let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = sqSegDist(pts[i], pts[s], pts[e]); if (d > max) { max = d; idx = i; } }
    if (max > t2) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = r => { let s = 0; for (let i = 0, n = r.length - 1; i < n; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2; };
const round = p => [Math.round(p[0] * 1e3) / 1e3, Math.round(p[1] * 1e3) / 1e3];

function ring(r, outer) {
  let out = dp(r, TOL).map(round);
  if (out.length < 4) return null;
  // d3-geo: anel externo no sentido horário (área planar negativa), buracos anti-horário
  if ((area(out) > 0) === outer) out.reverse();
  return out;
}
const g = JSON.parse(fs.readFileSync(src, 'utf8'));
g.features = g.features.map(f => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const coords = polys.map(p => p.map((r, i) => ring(r, i === 0)).filter(Boolean)).filter(p => p.length);
  return { type: 'Feature', id: f.properties.SIGLA, properties: { uf: f.properties.SIGLA, nome: f.properties.Estado }, geometry: { type: 'MultiPolygon', coordinates: coords } };
});
fs.writeFileSync(dst, JSON.stringify(g));
console.log('ok', fs.statSync(dst).size, 'bytes');
