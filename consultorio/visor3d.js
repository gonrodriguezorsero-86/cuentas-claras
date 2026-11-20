// RN Consultorio · visor de escaneos 3D (STL, PLY, OBJ, también dentro de .zip)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const EXT_3D = ['stl', 'ply', 'obj'];
export const es3D = nombre => EXT_3D.includes((nombre.split('.').pop() || '').toLowerCase());

async function desdeZip(buf) {
  const { unzipSync } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
  const files = unzipSync(new Uint8Array(buf));
  return Object.entries(files).filter(([n]) => es3D(n) && !n.startsWith('__MACOSX')).map(([n, d]) => ({ nombre: n.split('/').pop(), buf: d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) }));
}

function mallaDe(nombre, buf) {
  const ext = nombre.split('.').pop().toLowerCase();
  if (ext === 'obj') {
    const obj = new OBJLoader().parse(new TextDecoder().decode(buf));
    const geos = []; obj.traverse(o => { if (o.isMesh) geos.push(o.geometry); });
    return geos;
  }
  const g = ext === 'stl' ? new STLLoader().parse(buf) : new PLYLoader().parse(buf);
  return [g];
}

export async function abrirVisor(contenedor, { nombre, buf, onInfo }) {
  contenedor.innerHTML = '';
  let piezas = [];
  if (nombre.toLowerCase().endsWith('.zip')) piezas = await desdeZip(buf);
  else piezas = [{ nombre, buf }];
  if (!piezas.length) throw new Error('El .zip no tiene archivos STL, PLY u OBJ para ver.');

  const W = () => contenedor.clientWidth || 800, H = () => contenedor.clientHeight || 500;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  contenedor.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, W() / H(), 0.1, 5000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6250, 1.1));
  const d1 = new THREE.DirectionalLight(0xffffff, 1.6); d1.position.set(1, 1.5, 2); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, .6); d2.position.set(-1.5, -.5, -1); scene.add(d2);
  const grupo = new THREE.Group(); scene.add(grupo);
  const tonos = [0xf3ead6, 0xe9c9c0, 0xdfe7ee, 0xeae2c8];
  const capas = [];
  piezas.forEach((p, i) => {
    for (let g of mallaDe(p.nombre, p.buf)) {
      if (p.nombre.toLowerCase().endsWith('.stl')) { if (g.attributes.normal) g.deleteAttribute('normal'); try { g = mergeVertices(g, 1e-4); } catch (_) {} } // superficie suave
      if (!g.attributes.normal) g.computeVertexNormals();
      const col = !!g.attributes.color;
      const mat = new THREE.MeshStandardMaterial({ color: col ? 0xffffff : tonos[i % tonos.length], vertexColors: col, roughness: .55, metalness: 0, side: THREE.DoubleSide });
      const m = new THREE.Mesh(g, mat); grupo.add(m); capas.push({ nombre: p.nombre, mesh: m });
    }
  });
  // centrar y encuadrar
  const box = new THREE.Box3().setFromObject(grupo), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  grupo.position.sub(c);
  const r = Math.max(size.x, size.y, size.z) || 50;
  const ctr = new OrbitControls(cam, renderer.domElement); ctr.enableDamping = true;
  const encuadrar = () => { cam.position.set(0, 0, r * 1.9); cam.up.set(0, 1, 0); ctr.target.set(0, 0, 0); ctr.update(); };
  encuadrar(); cam.near = r / 100; cam.far = r * 20; cam.updateProjectionMatrix();
  let vivo = true;
  const loop = () => { if (!vivo) return; ctr.update(); renderer.render(scene, cam); requestAnimationFrame(loop); };
  loop();
  const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); }); ro.observe(contenedor);
  if (onInfo) onInfo({ capas: capas.map(x => x.nombre), mm: [size.x, size.y, size.z].map(v => Math.round(v)) });
  return {
    encuadrar,
    vista(dir) { const p = { frente: [0, 0, 1], arriba: [0, 1, 0.001], abajo: [0, -1, 0.001], izq: [-1, 0, 0], der: [1, 0, 0] }[dir]; cam.position.set(p[0] * r * 1.9, p[1] * r * 1.9, p[2] * r * 1.9); ctr.target.set(0, 0, 0); ctr.update(); },
    capa(i, visible) { if (capas[i]) capas[i].mesh.visible = visible; },
    cerrar() { vivo = false; ro.disconnect(); ctr.dispose(); renderer.dispose(); contenedor.innerHTML = ''; },
  };
}
