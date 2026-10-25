// Servidor do painel do 2º turno: serve /public e repassa os dados oficiais do TSE
// (o TSE não envia cabeçalho CORS, então o navegador não consegue buscar direto).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const CICLO = process.env.CICLO || 'ele2026';
const ELEICAO = process.env.ELEICAO || '6258'; // Presidente, 2º turno 2026
const CARGO = '0001';
const BASE = `https://resultados.tse.jus.br/oficial/${CICLO}/${ELEICAO}/dados`;
const REFRESH_MS = 10_000;

const UFS = ['ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb',
  'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to', 'zz'];

const num = s => (s == null || s === '' ? 0 : Number(String(s).replace(',', '.')));

function normalizar(j) {
  const cargo = j.carg?.[0] || {};
  const cands = [];
  for (const agr of cargo.agr || []) {
    for (const par of agr.par || []) {
      for (const c of par.cand || []) {
        cands.push({ n: c.n, nome: c.nmu, partido: par.sg, votos: num(c.vap), pct: num(c.pvapn), eleito: c.e === 's' });
      }
    }
  }
  cands.sort((a, b) => b.votos - a.votos);
  return {
    atualizado: `${j.dg} ${j.hg}`,
    finalizado: j.tf === 's',
    secoes: { totalizadas: num(j.s?.st), total: num(j.s?.ts), pct: num(j.s?.pstn) },
    eleitorado: num(j.e?.te),
    comparecimento: num(j.e?.c),
    abstencao: num(j.e?.a),
    validos: num(j.v?.vv),
    brancos: num(j.v?.vb),
    nulos: num(j.v?.tvn),
    cands,
  };
}

let cache = { ok: false, erro: 'carregando', buscadoEm: null, br: null, ufs: {} };

async function buscar(uf) {
  const url = `${BASE}/${uf}/${uf}-c${CARGO}-e${ELEICAO.padStart(6, '0')}-u.json`;
  const r = await fetch(url, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`${uf}: HTTP ${r.status}`);
  return normalizar(await r.json());
}

async function atualizar() {
  const res = await Promise.allSettled(['br', ...UFS].map(buscar));
  const [br, ...rest] = res;
  if (br.status === 'fulfilled') {
    const ufs = { ...cache.ufs };
    rest.forEach((r, i) => { if (r.status === 'fulfilled') ufs[UFS[i].toUpperCase()] = r.value; });
    cache = { ok: true, erro: null, buscadoEm: new Date().toISOString(), br: br.value, ufs };
  } else {
    cache = { ...cache, erro: String(br.reason?.message || br.reason) };
    console.error('[TSE]', cache.erro);
  }
}

// Em ambiente serverless (Vercel) o loop não sobrevive entre requisições,
// então a própria requisição busca no TSE quando o cache está vencido.
let emAndamento = null;
function garantirAtual() {
  const idade = cache.buscadoEm ? Date.now() - Date.parse(cache.buscadoEm) : Infinity;
  if (cache.ok && idade < REFRESH_MS) return Promise.resolve();
  emAndamento ||= atualizar()
    .catch(e => { cache = { ...cache, erro: String(e.message || e) }; })
    .finally(() => { emAndamento = null; });
  return emAndamento;
}

async function loop() {
  try { await atualizar(); } catch (e) { console.error(e); }
  setTimeout(loop, REFRESH_MS);
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.geojson': 'application/json', '.svg': 'image/svg+xml' };
const PUB = path.join(__dirname, 'public');

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/resultados') {
    await garantirAtual();
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(cache));
  }
  const arq = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!arq.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(arq, (err, data) => {
    if (err) { res.writeHead(404); return res.end('não encontrado'); }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Apuração ao vivo em http://localhost:${PORT}  (fonte: ${BASE})`);
  loop();
});
