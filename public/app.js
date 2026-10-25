const POLL_MS = 5000;
const LULA = '13', BOLSO = '22';
const NOMES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins', ZZ: 'Exterior',
};

const fmt = n => n.toLocaleString('pt-BR');
const pct = (n, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const $ = id => document.getElementById(id);

let dados = null;
let proxima = Date.now() + POLL_MS;

// Cor do estado: vermelho (Lula) ou azul (Flávio), mais intensa quanto maior a vantagem
const escalaLula = d3.scaleLinear().domain([0, 30]).range(['#f4a3a3', '#a50f0f']).clamp(true);
const escalaBolso = d3.scaleLinear().domain([0, 30]).range(['#a9c1f5', '#0f2f86']).clamp(true);

function cand(r, n) { return r?.cands.find(c => c.n === n) || { votos: 0, pct: 0 }; }

function corUF(r) {
  if (!r || r.secoes.totalizadas === 0) return getComputedStyle(document.documentElement).getPropertyValue('--vazio');
  const l = cand(r, LULA), b = cand(r, BOLSO);
  if (l.votos === b.votos) return '#7c7c8a';
  const margem = Math.abs(l.pct - b.pct);
  return l.votos > b.votos ? escalaLula(margem) : escalaBolso(margem);
}

function setTexto(el, valor) {
  if (el.textContent !== valor) {
    const tinha = el.textContent !== '–' && el.textContent !== '';
    el.textContent = valor;
    if (tinha) { el.classList.remove('mudou'); void el.offsetWidth; el.classList.add('mudou'); }
  }
}

// ---------- Mapa ----------
let caminhos, rotulos;
async function montarMapa() {
  const geo = await (await fetch('estados.geojson')).json();
  const W = 900, H = 820;
  const proj = d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], geo);
  const gerador = d3.geoPath(proj);
  const svg = d3.select('#mapa').append('svg').attr('viewBox', `0 0 ${W} ${H}`);
  caminhos = svg.append('g').selectAll('path').data(geo.features).join('path')
    .attr('class', 'uf').attr('d', gerador).attr('fill', 'var(--vazio)')
    .on('mousemove', (ev, f) => mostrarTooltip(ev, f.properties.uf))
    .on('mouseleave', () => { $('tooltip').hidden = true; });
  // rótulos (ajuste manual para estados pequenos do litoral)
  const desloc = { DF: [0, 0], RN: [14, -4], PB: [22, 0], PE: [30, 2], AL: [22, 6], SE: [16, 10], ES: [14, 4], RJ: [10, 12] };
  rotulos = svg.append('g').selectAll('text').data(geo.features).join('text')
    .attr('transform', f => {
      const [x, y] = gerador.centroid(f), [dx, dy] = desloc[f.properties.uf] || [0, 0];
      return `translate(${x + dx},${y + dy + 4})`;
    })
    .text(f => f.properties.uf);
}

function pintarMapa() {
  if (!caminhos || !dados) return;
  caminhos.attr('fill', f => corUF(dados.ufs[f.properties.uf]));
}

function mostrarTooltip(ev, uf) {
  const r = dados?.ufs[uf], t = $('tooltip');
  if (!r) return;
  const l = cand(r, LULA), b = cand(r, BOLSO);
  t.innerHTML = `
    <h3>${NOMES[uf]} (${uf})</h3>
    <div class="linha"><span style="color:#ff7a7a">● Lula</span><b>${pct(l.pct)}%</b><span>${fmt(l.votos)}</span></div>
    <div class="linha"><span style="color:#7aa5ff">● Flávio</span><b>${pct(b.pct)}%</b><span>${fmt(b.votos)}</span></div>
    <div class="mudo">Seções apuradas: ${pct(r.secoes.pct)}% (${fmt(r.secoes.totalizadas)} de ${fmt(r.secoes.total)})</div>`;
  t.hidden = false;
  const x = Math.min(ev.clientX + 14, innerWidth - t.offsetWidth - 8);
  const y = Math.min(ev.clientY + 14, innerHeight - t.offsetHeight - 8);
  t.style.left = x + 'px'; t.style.top = y + 'px';
}

// ---------- Painel ----------
function renderizar() {
  const br = dados.br;
  const l = cand(br, LULA), b = cand(br, BOLSO);

  for (const [sel, c] of [['.cand.lula', l], ['.cand.bolso', b]]) {
    const el = document.querySelector(sel);
    setTexto(el.querySelector('.pct'), pct(c.pct));
    setTexto(el.querySelector('.votos'), fmt(c.votos));
    el.querySelector('.selo-eleito').hidden = !c.eleito;
  }
  document.querySelector('.cand.lula').classList.toggle('lider', l.votos > b.votos);
  document.querySelector('.cand.bolso').classList.toggle('lider', b.votos > l.votos);

  setTexto($('urnas-pct'), pct(br.secoes.pct));
  $('urnas-st').textContent = fmt(br.secoes.totalizadas);
  $('urnas-ts').textContent = fmt(br.secoes.total);
  $('barra-urnas').style.width = br.secoes.pct + '%';

  const soma = l.votos + b.votos;
  $('seg-lula').style.width = (soma ? (l.votos / soma) * 100 : 50) + '%';
  $('seg-bolso').style.width = (soma ? (b.votos / soma) * 100 : 50) + '%';
  const dif = Math.abs(l.votos - b.votos);
  $('diferenca').innerHTML = soma === 0 ? 'Aguardando os primeiros votos…'
    : dif === 0 ? 'Empate'
    : `<b>${l.votos > b.votos ? 'Lula' : 'Flávio Bolsonaro'}</b> lidera por <b>${fmt(dif)}</b> votos (${pct(Math.abs(l.pct - b.pct))} p.p.)`;

  const pe = (v, t) => `${fmt(v)} <small>${t ? pct((v / t) * 100, 1) + '%' : ''}</small>`;
  $('eleitorado').innerHTML = fmt(br.eleitorado);
  $('comparecimento').innerHTML = pe(br.comparecimento, br.comparecimento + br.abstencao);
  $('abstencao').innerHTML = pe(br.abstencao, br.comparecimento + br.abstencao);
  $('validos').innerHTML = pe(br.validos, br.comparecimento);
  $('brancos').innerHTML = pe(br.brancos, br.comparecimento);
  $('nulos').innerHTML = pe(br.nulos, br.comparecimento);

  // Tabela por estado, ordenada pelo tamanho do eleitorado
  const linhas = Object.entries(dados.ufs).sort((a, b) => b[1].eleitorado - a[1].eleitorado);
  let nL = 0, nB = 0;
  $('tabela').innerHTML = linhas.map(([uf, r]) => {
    const cl = cand(r, LULA), cb = cand(r, BOLSO);
    const ld = r.secoes.totalizadas === 0 ? '' : cl.votos > cb.votos ? 'ld-lula' : cb.votos > cl.votos ? 'ld-bolso' : '';
    if (uf !== 'ZZ') { if (ld === 'ld-lula') nL++; else if (ld === 'ld-bolso') nB++; }
    return `<tr class="${ld}" title="${NOMES[uf]}">
      <td><b>${uf}</b></td>
      <td><span class="mini"><i style="width:${r.secoes.pct}%"></i></span>${pct(r.secoes.pct, 1)}%</td>
      <td class="r c-lula">${pct(cl.pct)}%</td>
      <td class="r c-bolso">${pct(cb.pct)}%</td></tr>`;
  }).join('');
  $('n-lula').textContent = nL;
  $('n-bolso').textContent = nB;

  $('atualizado').textContent = `TSE: ${br.atualizado}${br.finalizado ? ' · totalização encerrada' : ''}`;
  pintarMapa();
}

async function buscar() {
  try {
    const r = await fetch('/api/resultados', { cache: 'no-store' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'sem dados');
    dados = j;
    renderizar();
    $('erro').hidden = true;
  } catch (e) {
    $('erro').textContent = 'Falha ao atualizar: ' + e.message + ' — tentando novamente…';
    $('erro').hidden = false;
  } finally {
    proxima = Date.now() + POLL_MS;
    setTimeout(buscar, POLL_MS);
  }
}

setInterval(() => {
  const s = Math.max(0, Math.ceil((proxima - Date.now()) / 1000));
  $('contador').textContent = `● próxima atualização em ${s}s`;
}, 250);

montarMapa().then(pintarMapa);
buscar();
