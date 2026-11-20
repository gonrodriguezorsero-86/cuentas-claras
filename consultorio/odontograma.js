// RN Consultorio · Odontograma anatómico (vista vestibular con raíces + vista oclusal con 5 caras)
// Convención: rojo = a realizar · azul = existente / realizado.

export const COLOR = { r: '#d32f2f', e: '#1e5bc6' };
export const CARA_T = {
  caries: { n: 'Caries', modo: 'r' },
  restauracion: { n: 'Restauración', modo: 'e' },
  sellante: { n: 'Sellante', modo: 'e' },
};
export const DIENTE_T = {
  ausente: { n: 'Ausente', modo: 'e' },
  extraccion: { n: 'Extracción', modo: 'r' },
  corona: { n: 'Corona', modo: 'e' },
  endodoncia: { n: 'Endodoncia', modo: 'e' },
  implante: { n: 'Implante', modo: 'e' },
  perno: { n: 'Perno', modo: 'e' },
  protesis: { n: 'Prótesis / puente', modo: 'e' },
  fractura: { n: 'Fractura', modo: 'r' },
};
export const CARA_N = { O: 'oclusal', I: 'incisal', M: 'mesial', D: 'distal', V: 'vestibular', P: 'palatino', L: 'lingual' };

export const ADULTO = { sup: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], inf: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] };
export const NINO = { sup: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65], inf: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75] };
export const VALIDOS = new Set([...ADULTO.sup, ...ADULTO.inf, ...NINO.sup, ...NINO.inf].map(String));

// ---------- anatomía ----------
function info(fdi) {
  const q = Math.floor(fdi / 10), n = fdi % 10, temp = q >= 5, sup = [1, 2, 5, 6].includes(q);
  const der = [1, 4, 5, 8].includes(q); // lado derecho del paciente = izquierda en pantalla
  let kind;
  if (temp) kind = n <= 2 ? 'inc' : n === 3 ? 'can' : 'mol';
  else kind = n <= 2 ? 'inc' : n === 3 ? 'can' : n <= 5 ? 'pm' : 'mol';
  // ancho (vista vestibular), alto de corona, largo de raíz, profundidad oclusal relativa
  const P = sup
    ? { 1: [26, 31, 38, .82], 2: [20, 27, 35, .85], 3: [23, 31, 50, 1.02], 4: [21, 25, 40, 1.25], 5: [20, 24, 40, 1.25], 6: [31, 23, 37, 1.08], 7: [29, 22, 35, 1.1], 8: [26, 21, 31, 1.08] }
    : { 1: [16, 26, 34, 1.12], 2: [17, 26, 35, 1.1], 3: [21, 30, 45, 1.05], 4: [21, 24, 40, 1.05], 5: [21, 24, 41, 1.02], 6: [33, 23, 38, .95], 7: [31, 22, 36, .95], 8: [29, 21, 32, .95] };
  const T = sup
    ? { 1: [20, 23, 26, .85], 2: [16, 21, 24, .9], 3: [19, 23, 30, 1], 4: [22, 19, 24, 1.1], 5: [27, 19, 26, 1.05] }
    : { 1: [13, 20, 22, 1.05], 2: [14, 20, 23, 1.05], 3: [17, 22, 27, 1], 4: [23, 19, 24, .95], 5: [28, 19, 26, .95] };
  const [w, ch, rl, dp] = (temp ? T : P)[n];
  let raices = 1;
  if (kind === 'mol') raices = sup ? 3 : 2;
  else if (!temp && sup && n === 4) raices = 2;
  return { fdi, q, n, temp, sup, der, kind, w, ch, rl, dp, raices, anterior: kind === 'inc' || kind === 'can' };
}

function crown(t) {
  const a = t.w / 2, h = t.ch, nk = a * (t.kind === 'mol' ? .82 : .74);
  const side = `M ${-nk} 0 C ${-a * 1.03} ${h * .18} ${-a * 1.05} ${h * .6} ${-a * .9} ${h * .9} `;
  let edge;
  if (t.kind === 'inc') edge = `Q ${-a * .86} ${h * 1.01} ${-a * .58} ${h * 1.01} L ${a * .58} ${h * 1.01} Q ${a * .86} ${h * 1.01} ${a * .9} ${h * .9} `;
  else if (t.kind === 'can') edge = `Q ${-a * .78} ${h * 1.0} ${-a * .42} ${h * 1.02} Q ${-a * .12} ${h * 1.1} 0 ${h * 1.14} Q ${a * .12} ${h * 1.1} ${a * .42} ${h * 1.02} Q ${a * .78} ${h * 1.0} ${a * .9} ${h * .9} `;
  else if (t.kind === 'pm') edge = `Q ${-a * .72} ${h * 1.03} ${-a * .32} ${h * 1.05} Q 0 ${h * 1.13} ${a * .32} ${h * 1.05} Q ${a * .72} ${h * 1.03} ${a * .9} ${h * .9} `;
  else edge = `Q ${-a * .84} ${h * 1.05} ${-a * .52} ${h * 1.06} Q ${-a * .22} ${h * 1.09} ${-a * .04} ${h * 1.0} Q ${a * .08} ${h * .97} ${a * .16} ${h * 1.03} Q ${a * .34} ${h * 1.09} ${a * .56} ${h * 1.05} Q ${a * .84} ${h * 1.04} ${a * .9} ${h * .9} `;
  const close = `C ${a * 1.05} ${h * .6} ${a * 1.03} ${h * .18} ${nk} 0 Q 0 ${-h * (t.anterior ? .16 : .08)} ${-nk} 0 Z`;
  return { d: side + edge + close, nk };
}
function root(xc, w, len, tilt) {
  const hw = w / 2;
  return `M ${xc - hw} 2 C ${xc - hw * 1.02} ${-len * .5} ${xc - hw * .42 + tilt} ${-len * .93} ${xc + tilt} ${-len} C ${xc + hw * .42 + tilt} ${-len * .93} ${xc + hw * 1.02} ${-len * .5} ${xc + hw} 2 Z`;
}
function roots(t, nk) {
  const L = t.rl, out = [];
  if (t.raices === 1) out.push({ d: root(0, nk * 1.9, L, 0), x: 0, len: L });
  else if (t.raices === 2 && t.kind === 'pm') { out.push({ d: root(-nk * .42, nk * 1.0, L * .97, -1.5), x: -nk * .42, len: L * .97 }); out.push({ d: root(nk * .42, nk * 1.0, L, 1.5), x: nk * .42, len: L }); }
  else if (t.raices === 2) { out.push({ d: root(-nk * .5, nk * .8, L, -2), x: -nk * .5, len: L }); out.push({ d: root(nk * .5, nk * .78, L * .94, 2.5), x: nk * .5, len: L * .94 }); }
  else { out.push({ d: root(0, nk * .7, L * 1.06, 0), x: 0, len: L * 1.06, atras: true }); out.push({ d: root(-nk * .55, nk * .68, L * .92, -3), x: -nk * .55, len: L * .92 }); out.push({ d: root(nk * .55, nk * .64, L * .86, 3), x: nk * .55, len: L * .86 }); }
  return out;
}
function ocl(t) {
  const W = Math.min(t.w * .92, 30), D = Math.min(W * t.dp, 30);
  const rx = t.kind === 'mol' ? W * .3 : t.kind === 'pm' ? W * .45 : W * .4, ry = t.kind === 'mol' ? D * .3 : D * .45;
  return { W, D, rx, ry };
}

// ---------- marcas ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function caraPos(t, f) { // devuelve 'top' | 'bot' | 'izq' | 'der' | 'cen' para una cara
  if (f === 'O' || f === 'I') return 'cen';
  if (f === 'V') return t.sup ? 'top' : 'bot';
  if (f === 'P' || f === 'L') return t.sup ? 'bot' : 'top';
  if (f === 'M') return t.der ? 'der' : 'izq';
  if (f === 'D') return t.der ? 'izq' : 'der';
}
function posCara(t, p) {
  if (p === 'cen') return t.anterior ? 'I' : 'O';
  if (p === 'top') return t.sup ? 'V' : 'L';
  if (p === 'bot') return t.sup ? 'P' : 'V';
  if (p === 'izq') return t.der ? 'D' : 'M';
  return t.der ? 'M' : 'D';
}
export function carasDe(fdi) { const t = info(+fdi); return t.anterior ? ['I', 'M', 'D', 'V', t.sup ? 'P' : 'L'] : ['O', 'M', 'D', 'V', t.sup ? 'P' : 'L']; }

function dibujarDiente(t, dd, sel) {
  const m = (dd && dd.marcas) || [], c = (dd && dd.caras) || {};
  const has = k => m.find(x => x.t === k);
  const aus = has('ausente'), imp = has('implante');
  const { d: cd, nk } = crown(t);
  const rs = roots(t, nk);
  let g = '';
  // raíces (o implante)
  if (imp) {
    const L = t.rl * .85, w = nk * 1.15;
    g += `<rect x="${-w / 2}" y="${-L}" width="${w}" height="${L + 2}" rx="${w * .35}" fill="url(#oImp)" stroke="#6d737a" stroke-width=".7"/>`;
    for (let y = -L + 5; y < -2; y += 4.2) g += `<path d="M ${-w / 2 - 1.2} ${y} L ${w / 2 + 1.2} ${y + 1.6}" stroke="#5d6369" stroke-width="1.1" fill="none"/>`;
    g += `<rect x="${-w / 2 - 1}" y="${-L}" width="${w + 2}" height="${L + 2}" rx="${w * .35}" fill="none" stroke="${COLOR[imp.m]}" stroke-width="1.6"/>`;
  } else {
    for (const r of rs) g += `<path d="${r.d}" fill="url(#oRoot)" stroke="#a99673" stroke-width=".7" ${r.atras ? 'opacity=".55"' : ''}/>`;
    for (const r of rs) if (!r.atras) g += `<path d="M ${r.x - .6} -2 Q ${r.x} ${-r.len * .5} ${r.x + (r.x ? r.x * .06 : 0)} ${-r.len * .88}" stroke="#c9b48b" stroke-width="1.1" fill="none" opacity=".7"/>`;
  }
  // corona con volumen
  g += `<path d="${cd}" fill="url(#oEn)" stroke="#a49c89" stroke-width=".8"/>`;
  g += `<path d="${cd}" fill="url(#oEnV)"/>`;
  g += `<ellipse cx="${-t.w * .14}" cy="${t.ch * .42}" rx="${t.w * .11}" ry="${t.ch * .26}" fill="#fff" opacity=".55" filter="url(#oBlur)"/>`;
  if (t.kind === 'mol' || t.kind === 'pm') g += `<path d="M ${-t.w * .05} ${t.ch * .55} Q 0 ${t.ch * .8} ${t.w * .02} ${t.ch * .98}" stroke="#b8af9b" stroke-width=".7" fill="none" opacity=".8"/>`;
  // marcas a nivel diente
  for (const x of m) {
    const col = COLOR[x.m] || COLOR.e;
    if (x.t === 'corona') g += `<path d="${cd}" fill="${col}" fill-opacity=".2" stroke="${col}" stroke-width="2.2"/>`;
    if (x.t === 'endodoncia' && !imp) for (const r of rs) if (!r.atras) g += `<path d="M ${r.x * .3} ${t.ch * .35} L ${r.x} -4 L ${r.x + (r.x ? r.x * .06 : 0)} ${-r.len * .9}" stroke="${col}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`;
    if (x.t === 'perno' && !imp) g += `<path d="M 0 ${t.ch * .3} L 0 ${-t.rl * .5}" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`;
    if (x.t === 'fractura') g += `<path d="M ${-t.w * .32} ${t.ch * .25} L ${-t.w * .08} ${t.ch * .48} L ${-t.w * .2} ${t.ch * .62} L ${t.w * .2} ${t.ch * .9}" stroke="${col}" stroke-width="2" fill="none" stroke-linejoin="round"/>`;
    if (x.t === 'protesis') g += `<rect x="${-t.w / 2 - 1.5}" y="${t.ch * .42}" width="${t.w + 3}" height="4" rx="2" fill="${col}" opacity=".85"/>`;
  }
  // caras visibles en vestibular: tinte suave si la cara V está marcada
  if (c.V) g += `<path d="${cd}" fill="${COLOR[c.V.m]}" fill-opacity=".22"/>`;
  let wrap = `<g class="vv" data-d="${t.fdi}"${aus ? ' opacity=".16"' : ''}>${g}</g>`;
  if (aus) wrap += `<path d="M ${-t.w * .45} ${t.ch * .5} L ${t.w * .45} ${t.ch * .5}" stroke="${COLOR[aus.m]}" stroke-width="2.4" stroke-linecap="round"/><path d="M ${-t.w * .45} ${-t.rl * .4} L ${t.w * .45} ${-t.rl * .4}" stroke="${COLOR[aus.m]}" stroke-width="2.4" stroke-linecap="round"/>`;
  const ex = has('extraccion');
  if (ex) wrap += `<path d="M ${-t.w * .5} ${t.ch * 1.05} L ${t.w * .5} ${-t.rl * .85} M ${t.w * .5} ${t.ch * 1.05} L ${-t.w * .5} ${-t.rl * .85}" stroke="${COLOR[ex.m]}" stroke-width="2.6" stroke-linecap="round"/>`;
  // área de selección
  wrap += `<rect class="hit" data-d="${t.fdi}" x="${-t.w / 2 - 2}" y="${-t.rl - 2}" width="${t.w + 4}" height="${t.rl + t.ch * 1.15 + 4}" fill="transparent"${sel ? ` stroke="#f5c400" stroke-width="1.6" rx="5"` : ''}/>`;
  return wrap;
}

function dibujarOclusal(t, dd) {
  const { W, D, rx, ry } = ocl(t), c = (dd && dd.caras) || {}, m = (dd && dd.marcas) || [];
  const id = 'oc' + t.fdi, w2 = W / 2, d2 = D / 2, iw = W * .2, idp = D * .2;
  const out = `M ${-w2 + rx} ${-d2} H ${w2 - rx} Q ${w2} ${-d2} ${w2} ${-d2 + ry} V ${d2 - ry} Q ${w2} ${d2} ${w2 - rx} ${d2} H ${-w2 + rx} Q ${-w2} ${d2} ${-w2} ${d2 - ry} V ${-d2 + ry} Q ${-w2} ${-d2} ${-w2 + rx} ${-d2} Z`;
  const zonas = {
    top: `M ${-w2 - 2} ${-d2 - 2} L ${w2 + 2} ${-d2 - 2} L ${iw} ${-idp} L ${-iw} ${-idp} Z`,
    bot: `M ${-w2 - 2} ${d2 + 2} L ${w2 + 2} ${d2 + 2} L ${iw} ${idp} L ${-iw} ${idp} Z`,
    izq: `M ${-w2 - 2} ${-d2 - 2} L ${-iw} ${-idp} L ${-iw} ${idp} L ${-w2 - 2} ${d2 + 2} Z`,
    der: `M ${w2 + 2} ${-d2 - 2} L ${iw} ${-idp} L ${iw} ${idp} L ${w2 + 2} ${d2 + 2} Z`,
    cen: `M ${-iw} ${-idp} H ${iw} V ${idp} H ${-iw} Z`,
  };
  const aus = m.find(x => x.t === 'ausente'), ex = m.find(x => x.t === 'extraccion'), cor = m.find(x => x.t === 'corona'), imp = m.find(x => x.t === 'implante');
  let g = `<clipPath id="${id}"><path d="${out}"/></clipPath>`;
  g += `<g${aus ? ' opacity=".18"' : ''}><path d="${out}" fill="url(#oOc)" stroke="#a49c89" stroke-width=".8"/>`;
  // relieve: fisuras / cúspides
  if (t.kind === 'mol') g += `<path d="M ${-W * .28} ${-D * .05} Q ${-W * .1} ${D * .08} 0 ${-D * .02} Q ${W * .12} ${-D * .1} ${W * .28} ${D * .04} M 0 ${-D * .02} L ${-W * .04} ${-D * .3} M 0 ${-D * .02} L ${W * .05} ${D * .3}" stroke="#bfb49c" stroke-width=".9" fill="none"/>`;
  else if (t.kind === 'pm') g += `<path d="M ${-W * .3} 0 Q 0 ${D * .06} ${W * .3} 0" stroke="#bfb49c" stroke-width=".9" fill="none"/>`;
  else g += `<path d="M ${-W * .3} ${t.sup ? -D * .12 : D * .12} Q 0 ${t.sup ? -D * .2 : D * .2} ${W * .3} ${t.sup ? -D * .12 : D * .12}" stroke="#cfc6b2" stroke-width=".8" fill="none"/>`;
  g += `<g clip-path="url(#${id})">`;
  for (const [p, z] of Object.entries(zonas)) {
    const f = posCara(t, p), mk = c[f];
    if (mk) {
      const col = COLOR[mk.m] || COLOR.e;
      g += mk.t === 'sellante' ? `<path d="${z}" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="1.2" stroke-dasharray="2 1.5"/>` : `<path d="${z}" fill="${col}" fill-opacity="${mk.t === 'caries' ? .9 : .7}"/>`;
    }
    g += `<path class="cara" data-d="${t.fdi}" data-f="${f}" d="${z}" fill="transparent" stroke="#b8ae98" stroke-width=".55"><title>${t.fdi} · ${CARA_N[f]}</title></path>`;
  }
  g += `</g>`;
  if (cor) g += `<path d="${out}" fill="none" stroke="${COLOR[cor.m]}" stroke-width="2.4"/>`;
  if (imp) g += `<circle r="${Math.min(W, D) * .22}" fill="none" stroke="${COLOR[imp.m]}" stroke-width="1.8"/>`;
  g += `</g>`;
  if (ex) g += `<path d="M ${-w2} ${-d2} L ${w2} ${d2} M ${w2} ${-d2} L ${-w2} ${d2}" stroke="${COLOR[ex.m]}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (aus) g += `<path d="M ${-w2} 0 L ${w2} 0" stroke="${COLOR[aus.m]}" stroke-width="2.2" stroke-linecap="round"/>`;
  return g;
}

const DEFS = `<defs>
<linearGradient id="oEn" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#cbc3ad"/><stop offset=".22" stop-color="#efe9da"/><stop offset=".45" stop-color="#fdfbf6"/><stop offset=".72" stop-color="#ece5d3"/><stop offset="1" stop-color="#bfb59c"/></linearGradient>
<linearGradient id="oEnV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e3cf9a" stop-opacity=".45"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#c7d6df" stop-opacity=".55"/></linearGradient>
<linearGradient id="oRoot" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#b49e72"/><stop offset=".45" stop-color="#ead9ae"/><stop offset="1" stop-color="#ad9668"/></linearGradient>
<radialGradient id="oOc" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#fffdf8"/><stop offset=".65" stop-color="#eee7d6"/><stop offset="1" stop-color="#cdc3aa"/></radialGradient>
<linearGradient id="oImp" x1="0" x2="1"><stop offset="0" stop-color="#8b9299"/><stop offset=".5" stop-color="#dfe3e7"/><stop offset="1" stop-color="#80878e"/></linearGradient>
<filter id="oBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
</defs>`;

export function svgOdontograma(datos, opts = {}) {
  const tabla = (datos && datos.denticion === 'nino') ? NINO : ADULTO;
  const D = (datos && datos.dientes) || {};
  const gap = 5, sepMid = 10;
  const ancho = l => l.reduce((s, f) => s + info(f).w + gap, 0) + sepMid;
  const W = Math.max(ancho(tabla.sup), ancho(tabla.inf)) + 20;
  const R = 56, C = 36, yCejS = 10 + R, yNumS = yCejS + C + 14, yOcS = yNumS + 24;
  const yOcI = yOcS + 46, yNumI = yOcI + 26, yCejI = yNumI + 12 + C, H = yCejI + R + 10;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="odo-svg" role="img" aria-label="Odontograma">${DEFS}`;
  s += `<line x1="${W / 2}" y1="6" x2="${W / 2}" y2="${H - 6}" stroke="#e6e3da" stroke-width="1" stroke-dasharray="3 3"/>`;
  s += `<line x1="8" y1="${(yOcS + yOcI) / 2}" x2="${W - 8}" y2="${(yOcS + yOcI) / 2}" stroke="#e6e3da" stroke-width="1" stroke-dasharray="3 3"/>`;
  const fila = (lista, sup) => {
    const tot = ancho(lista); let x = (W - tot) / 2 + gap / 2;
    lista.forEach((f, i) => {
      const t = info(f); if (i === lista.length / 2) x += sepMid;
      const cx = x + t.w / 2, dd = D[f], sel = String(opts.sel) === String(f);
      const yC = sup ? yCejS : yCejI;
      s += `<g class="diente" data-d="${f}"><g transform="translate(${cx} ${yC})${sup ? '' : ' scale(1 -1)'}">${dibujarDiente(t, dd, sel)}</g>`;
      s += `<text x="${cx}" y="${sup ? yNumS : yNumI}" text-anchor="middle" class="odo-n${sel ? ' sel' : ''}${dd && dd.nota ? ' nota' : ''}" data-d="${f}">${f}</text>`;
      s += `<g transform="translate(${cx} ${sup ? yOcS : yOcI})">${dibujarOclusal(t, dd)}</g></g>`;
      x += t.w + gap;
    });
  };
  fila(tabla.sup, true); fila(tabla.inf, false);
  s += `<text x="10" y="${yCejS - R + 6}" class="odo-lbl">Superior · derecha del paciente</text><text x="${W - 10}" y="${yCejS - R + 6}" text-anchor="end" class="odo-lbl">izquierda</text>`;
  s += `<text x="10" y="${H - 4}" class="odo-lbl">Inferior</text>`;
  return s + `</svg>`;
}

// ---------- edición ----------
export function aplicar(datos, acc) {
  // acc: { diente, tipo, caras?, modo?, quitar? }
  datos.dientes = datos.dientes || {};
  const k = String(acc.diente);
  if (!VALIDOS.has(k)) return false;
  const dd = datos.dientes[k] = datos.dientes[k] || { marcas: [], caras: {} };
  dd.marcas = dd.marcas || []; dd.caras = dd.caras || {};
  if (acc.tipo === 'borrar') { delete datos.dientes[k]; return true; }
  if (CARA_T[acc.tipo]) {
    let caras = (acc.caras && acc.caras.length) ? acc.caras : [];
    const validas = carasDe(k);
    caras = caras.map(f => (f === 'O' || f === 'I') ? validas[0] : (f === 'L' || f === 'P') ? validas[4] : f).filter(f => validas.includes(f));
    if (!caras.length) caras = [validas[0]];
    for (const f of caras) {
      if (acc.quitar || (acc.toggle && dd.caras[f] && dd.caras[f].t === acc.tipo && dd.caras[f].m === (acc.modo || CARA_T[acc.tipo].modo))) delete dd.caras[f];
      else dd.caras[f] = { t: acc.tipo, m: acc.modo || CARA_T[acc.tipo].modo };
    }
  } else if (DIENTE_T[acc.tipo]) {
    const i = dd.marcas.findIndex(x => x.t === acc.tipo), m = acc.modo || DIENTE_T[acc.tipo].modo;
    if (i >= 0 && (acc.quitar || (acc.toggle && dd.marcas[i].m === m))) dd.marcas.splice(i, 1);
    else if (i >= 0) dd.marcas[i].m = m;
    else if (!acc.quitar) dd.marcas.push({ t: acc.tipo, m });
  } else return false;
  if (!dd.marcas.length && !Object.keys(dd.caras).length && !dd.nota) delete datos.dientes[k];
  return true;
}

export function resumen(datos) {
  const D = (datos && datos.dientes) || {}, out = [];
  for (const k of Object.keys(D).sort((a, b) => ordenFDI(a) - ordenFDI(b))) {
    const dd = D[k], partes = [];
    for (const m of dd.marcas || []) partes.push({ txt: DIENTE_T[m.t].n, m: m.m });
    const porTipo = {};
    for (const [f, c] of Object.entries(dd.caras || {})) { const kk = c.t + c.m; (porTipo[kk] = porTipo[kk] || { t: c.t, m: c.m, f: [] }).f.push(f); }
    for (const x of Object.values(porTipo)) partes.push({ txt: CARA_T[x.t].n + ' ' + x.f.join(''), m: x.m });
    out.push({ diente: k, partes, nota: dd.nota || '' });
  }
  return out;
}
function ordenFDI(k) { const q = Math.floor(k / 10), n = k % 10; const ordQ = { 1: 0, 2: 1, 3: 3, 4: 2, 5: 4, 6: 5, 7: 7, 8: 6 }[q]; return ordQ * 100 + ([1, 4, 5, 8].includes(q) ? 10 - n : n); }

// ---------- dictado por voz ----------
const NUM = { uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28 };
const DEC = { treinta: 3, cuarenta: 4, cincuenta: 5, sesenta: 6, setenta: 7, ochenta: 8 };
const sinTilde = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function numerosATexto(s) {
  s = s.replace(/\b(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta)\s+y\s+(uno|dos|tres|cuatro|cinco|seis|siete|ocho)\b/g, (_, d, u) => String(DEC[d] * 10 + NUM[u]));
  s = s.replace(/\b(once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|veintiuno|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho)\b/g, w => String(NUM[w]));
  s = s.replace(/\b(uno|dos|tres|cuatro|cinco|seis|siete|ocho)\s+(uno|dos|tres|cuatro|cinco|seis|siete|ocho)\b/g, (_, a, b) => String(NUM[a] * 10 + NUM[b]));
  return s;
}
const PAL = [
  [/caries/, 'caries'], [/restaura|obtura|arreglo|resina|amalgama|empaste|composite/, 'restauracion'], [/sellante|sellad/, 'sellante'],
  [/corona|funda/, 'corona'], [/endodon|conducto|tratamiento de conducto/, 'endodoncia'], [/implante/, 'implante'], [/perno/, 'perno'],
  [/protesis|puente/, 'protesis'], [/fractura|fisura|roto|rota/, 'fractura'], [/extrac|sacar|extraer/, 'extraccion'], [/ausente|falta|no tiene|perdid/, 'ausente'],
  [/borra|quita|sacale|limpia/, 'borrar'],
];
const CARAS_P = [[/mesio[\s-]*ocluso[\s-]*distal|\bmod\b/, 'MOD'], [/mesio[\s-]*oclusal|\bmo\b/, 'MO'], [/disto[\s-]*oclusal|\bdo\b/, 'DO'], [/oclusal|incisal/, 'O'], [/mesial/, 'M'], [/distal/, 'D'], [/vestibular|bucal/, 'V'], [/palatin|lingual/, 'L']];
export function interpretarVoz(texto) {
  let s = numerosATexto(sinTilde(texto || ''));
  const frases = s.split(/[,.;]|\by\s+(?=(?:el|la|en|pieza|diente)?\s*\d)|\by\s+(?=caries|corona|restaura|endodon|implante|extrac|falta|ausente|sellante|perno|fractura)/);
  const acc = []; let ultimoTipo = null, ultimoModo = null;
  for (let f of frases) {
    f = f.trim(); if (!f) continue;
    const dientes = [...f.matchAll(/\b([1-8][1-8])\b/g)].map(x => x[1]).filter(d => VALIDOS.has(d));
    let tipo = null; for (const [rx, t] of PAL) if (rx.test(f)) { tipo = t; break; }
    if (!tipo) tipo = ultimoTipo;
    let caras = []; let resto = f;
    for (const [rx, c] of CARAS_P) if (rx.test(resto)) { caras.push(...c.split('')); resto = resto.replace(rx, ' '); }
    caras = [...new Set(caras)];
    let modo = null;
    if (/a realizar|realizar|hacer|pendiente|por hacer|indicad/.test(f)) modo = 'r';
    else if (/existente|ya tiene|tiene una|hecha|hecho|realizad|antigu|vieja/.test(f)) modo = 'e';
    if (!modo) modo = ultimoTipo === tipo ? ultimoModo : null;
    if (!tipo || !dientes.length) continue;
    for (const d of dientes) acc.push({ diente: d, tipo, caras, modo: modo || (CARA_T[tipo] || DIENTE_T[tipo] || {}).modo || 'e' });
    ultimoTipo = tipo; ultimoModo = modo;
  }
  return acc;
}
export function describirAccion(a) {
  const nombre = (CARA_T[a.tipo] || DIENTE_T[a.tipo] || { n: a.tipo === 'borrar' ? 'Borrar todo' : a.tipo }).n;
  const caras = CARA_T[a.tipo] ? ' ' + ((a.caras && a.caras.length) ? a.caras.map(c => CARA_N[c] || c).join('-') : CARA_N[carasDe(a.diente)[0]]) : '';
  return `${a.diente}: ${nombre}${caras}${a.tipo === 'borrar' ? '' : (a.modo === 'r' ? ' (a realizar)' : ' (existente)')}`;
}
export { info as infoDiente };
