// RN Consultorio · lienzo de estratificación: dibujar y escribir sobre el diente tratado
import { svgEstratificacion } from './odontograma.js';

export const CAPAS_BASE = [
  { capa: 'Esmalte palatino', color: '#4f8fd6' },
  { capa: 'Dentina', color: '#e08a2e' },
  { capa: 'Mamelones', color: '#c25b93' },
  { capa: 'Efectos / tintes', color: '#7d63c6' },
  { capa: 'Esmalte vestibular', color: '#2e9e8f' },
];
const bgCache = new Map();
function fondo(piezas) {
  const k = (piezas || []).join(',');
  if (bgCache.has(k)) return bgCache.get(k);
  const { svg, aspecto } = svgEstratificacion(piezas);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = new Image(); img.src = url;
  const p = new Promise(r => { img.onload = () => r({ img, aspecto }); img.onerror = () => r({ img: null, aspecto }); });
  bgCache.set(k, p); return p;
}
function dibujar(ctx, W, H, datos) {
  for (const t of (datos && datos.trazos) || []) {
    if (!t.pts || t.pts.length < 1) continue;
    ctx.strokeStyle = t.c; ctx.lineWidth = (t.w || 3) * W / 600; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = t.a ?? .85;
    ctx.beginPath(); ctx.moveTo(t.pts[0][0] * W, t.pts[0][1] * H);
    for (const p of t.pts.slice(1)) ctx.lineTo(p[0] * W, p[1] * H);
    if (t.pts.length === 1) ctx.lineTo(t.pts[0][0] * W + .1, t.pts[0][1] * H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const x of (datos && datos.textos) || []) {
    const fs = Math.max(11, W / 42);
    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`; ctx.textBaseline = 'middle';
    const w = ctx.measureText(x.t).width;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x.x * W - 3, x.y * H - fs * .65, w + 6, fs * 1.3);
    ctx.fillStyle = x.c || '#222'; ctx.fillText(x.t, x.x * W, x.y * H);
  }
}

// imagen estática (para la lista de la historia clínica)
export async function imagenEstratificacion(piezas, datos, ancho = 600) {
  const { img, aspecto } = await fondo(piezas);
  const c = document.createElement('canvas'); c.width = ancho; c.height = Math.round(ancho / aspecto);
  const ctx = c.getContext('2d'); if (img) ctx.drawImage(img, 0, 0, c.width, c.height);
  dibujar(ctx, c.width, c.height, datos); return c.toDataURL('image/png');
}

export function crearLienzo(cont, { piezas, datos, pens, onChange }) {
  let D = { trazos: [], textos: [], ...(datos || {}) }, P = piezas || [11], pen = (pens && pens[0]) || { color: '#222' }, herr = 'lapiz', grosor = 3, actual = null, fd = null;
  cont.innerHTML = `<div class="lz-bar"><span class="lz-pens"></span>
    <span class="sw"><button type="button" data-h="lapiz" class="on n">Lápiz</button><button type="button" data-h="texto">Texto</button><button type="button" data-h="goma">Goma</button></span>
    <span class="sw"><button type="button" data-g="2">fino</button><button type="button" data-g="3" class="on n">medio</button><button type="button" data-g="6">grueso</button></span>
    <button type="button" class="btn ghost" data-a="undo" style="padding:5px 9px">Deshacer</button><button type="button" class="btn ghost" data-a="clear" style="padding:5px 9px">Limpiar</button></div>
    <div class="lz-wrap"><canvas class="lz-c"></canvas><input class="lz-in" placeholder="Escribí y Enter" hidden></div>`;
  const cv = cont.querySelector('canvas'), ctx = cv.getContext('2d'), inp = cont.querySelector('.lz-in'), wrap = cont.querySelector('.lz-wrap');
  const pintarPens = (lista) => {
    const ps = lista && lista.length ? lista : [{ capa: 'Negro', color: '#222' }];
    cont.querySelector('.lz-pens').innerHTML = ps.map((p, i) => `<button type="button" class="pen${p.color === pen.color ? ' on' : ''}" data-i="${i}" title="${(p.capa || '').replace(/"/g, '')}" style="--c:${p.color}"></button>`).join('') + `<button type="button" class="pen${pen.color === '#222' ? ' on' : ''}" data-i="-1" title="Negro" style="--c:#222"></button>`;
    cont.querySelector('.lz-pens').onclick = e => { const b = e.target.closest('.pen'); if (!b) return; const i = +b.dataset.i; pen = i < 0 ? { color: '#222' } : ps[i]; if (herr === 'goma') setHerr('lapiz'); pintarPens(ps); };
  };
  pintarPens(pens);
  const setHerr = h => { herr = h; cont.querySelectorAll('[data-h]').forEach(b => { const on = b.dataset.h === h; b.classList.toggle('on', on); b.classList.toggle('n', on); }); cv.style.cursor = h === 'texto' ? 'text' : 'crosshair'; };
  cont.querySelector('.lz-bar').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.h) setHerr(b.dataset.h);
    if (b.dataset.g) { grosor = +b.dataset.g; cont.querySelectorAll('[data-g]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.classList.toggle('n', on); }); }
    if (b.dataset.a === 'undo') { const ult = [...D.trazos.map((t, i) => [t.ts || i, 't', i]), ...D.textos.map((t, i) => [t.ts || i, 'x', i])].sort((a, b) => b[0] - a[0])[0]; if (ult) (ult[1] === 't' ? D.trazos : D.textos).splice(ult[2], 1); render(); cambio(); }
    if (b.dataset.a === 'clear') { if (b.dataset.c !== '1') { b.dataset.c = '1'; b.textContent = '¿Seguro?'; setTimeout(() => { b.dataset.c = ''; b.textContent = 'Limpiar'; }, 2500); return; } D = { trazos: [], textos: [] }; b.dataset.c = ''; b.textContent = 'Limpiar'; render(); cambio(); }
  });
  const cambio = () => onChange && onChange(D);
  async function render() {
    if (!fd) fd = await fondo(P);
    const maxH = Math.max(260, innerHeight * .55), w = Math.round(Math.min(wrap.clientWidth || 600, maxH * fd.aspecto)), h = Math.round(w / fd.aspecto), dpr = Math.min(devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (fd.img) ctx.drawImage(fd.img, 0, 0, cv.width, cv.height);
    dibujar(ctx, cv.width, cv.height, D);
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', e => {
    const p = pos(e);
    if (herr === 'texto') { e.preventDefault(); const r = cv.getBoundingClientRect(); inp.hidden = false; inp.style.left = (cv.offsetLeft + p[0] * r.width) + 'px'; inp.style.top = (cv.offsetTop + p[1] * r.height - 14) + 'px'; inp.dataset.x = p[0]; inp.dataset.y = p[1]; inp.value = ''; inp.focus(); return; }
    if (herr === 'goma') { borrarCerca(p); return; }
    cv.setPointerCapture(e.pointerId); actual = { c: pen.color, w: grosor, pts: [p], ts: Date.now(), capa: pen.capa || '' }; D.trazos.push(actual); render();
  });
  cv.addEventListener('pointermove', e => { if (herr === 'goma' && e.buttons) { borrarCerca(pos(e)); return; } if (!actual) return; actual.pts.push(pos(e).map(v => Math.round(v * 1000) / 1000)); render(); });
  const fin = () => { if (actual) { actual = null; cambio(); } };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
  function borrarCerca(p) {
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    const n0 = D.trazos.length + D.textos.length;
    D.trazos = D.trazos.filter(t => !t.pts.some(q => d2(q, p) < .0006));
    D.textos = D.textos.filter(t => d2([t.x, t.y], p) > .002);
    if (D.trazos.length + D.textos.length !== n0) { render(); cambio(); }
  }
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } if (e.key === 'Escape') { inp.value = ''; inp.blur(); } });
  inp.addEventListener('blur', () => { const t = inp.value.trim(); inp.hidden = true; if (t) { D.textos.push({ x: +inp.dataset.x, y: +inp.dataset.y, t, c: pen.color, ts: Date.now() }); render(); cambio(); } });
  const ro = new ResizeObserver(() => render()); ro.observe(wrap);
  render();
  return {
    get: () => D,
    setPiezas(p) { P = p && p.length ? p : [11]; fd = null; render(); },
    setPens(ps) { pens = ps; if (!ps.some(x => x.color === pen.color)) pen = ps[0] || { color: '#222' }; pintarPens(ps); },
    destroy() { ro.disconnect(); cont.innerHTML = ''; },
  };
}
