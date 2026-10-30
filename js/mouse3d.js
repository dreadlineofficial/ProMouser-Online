/* =====================================================================
   ProMouser Online: 3D digital mice
   Every mouse is modelled in code: a sculpted shell (four shapes), split
   buttons, scroll wheel, side buttons and an RGB strip, with physically
   based materials and painted patterns. One shared renderer makes shop
   thumbnails; viewer() gives an interactive, bloom-lit 3D view.
   ===================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { itemById, RARITY } from './data.js';

const SHAPES = {   // length, width, height (scene units ≈ 10 cm), hump position (−1 back … 1 front), front taper, side bulge
  classic:   { L: 2.4, W: 1.24, H: .74, hump: -.22, taper: .14, ergo: 0 },
  ergo:      { L: 2.5, W: 1.36, H: .86, hump: -.12, taper: .1,  ergo: 1 },
  mini:      { L: 2.2, W: 1.16, H: .7,  hump: -.3,  taper: .18, ergo: 0 },
  honeycomb: { L: 2.4, W: 1.22, H: .74, hump: -.22, taper: .14, ergo: 0 }
};

/* the shell surface: height of the top at (x, z) in -1..1 coordinates */
function topY(s, x, z) {
  const hump = Math.exp(-((z - s.hump) ** 2) / .8);
  const across = Math.max(0, 1 - Math.pow(Math.abs(x), 2.6));
  const tilt = s.ergo ? 1 - .22 * Math.max(0, x) : 1;            // ergonomic: right side lower
  const nose = 1 - .35 * Math.max(0, z - .55) ** 2;               // a blunt, rounded front
  return s.H * (.44 + .56 * hump) * Math.pow(across, .5) * tilt * nose;
}
const halfW = (s, z) => (s.W / 2) * (1 - s.taper * .7 * Math.max(0, z) ** 2 - .1 * Math.max(0, -z) ** 3) * (s.ergo ? 1 + .05 * Math.max(0, -z) : 1);

function shellGeometry(s) {
  const g = new THREE.SphereGeometry(1, 128, 96), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // sphere → rounded box-ish (superellipsoid), then sculpt
    const sx = Math.sign(v.x) * Math.pow(Math.abs(v.x), .6), sz = Math.sign(v.z) * Math.pow(Math.abs(v.z), .62);
    const z = sz, w = halfW(s, z), x = sx * w;
    let y;
    if (v.y >= 0) y = Math.pow(v.y, .7) * topY(s, sx, z) + .06;
    else y = .06 + v.y * .08;                                       // flat base
    const groove = s.ergo && sx < -.55 && v.y > -.2 && v.y < .6 ? 1 - .07 * Math.sin(Math.PI * (v.y + .2) / .8) : 1;   // thumb groove on ergonomic shells
    p.setX(i, x * groove);
    p.setY(i, y); p.setZ(i, z * s.L / 2);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- painted patterns (canvas textures) ---------- */
const texCache = new Map();
function patternTex(kind, col = '#ffffff', base = '#000000') {
  const key = kind + col + base; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  if (kind === 'carbon') {
    for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) { const g = x.createLinearGradient(i * 8, j * 8, i * 8 + 8, j * 8 + 8); const a = (i + j) % 2; g.addColorStop(0, a ? '#2b2f38' : '#111317'); g.addColorStop(1, a ? '#16181d' : '#262a31'); x.fillStyle = g; x.fillRect(i * 8, j * 8, 8, 8); }
    x.fillStyle = col; x.fillRect(250, 0, 12, 512);
  } else if (kind === 'honeycomb') {
    x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 512); x.fillStyle = '#000'; const r = 15;
    for (let row = 0; row < 24; row++) for (let q = 0; q < 14; q++) { const cx = q * r * 3 + (row % 2) * r * 1.5, cy = row * r * .87 * 2.4; x.beginPath(); for (let k = 0; k < 6; k++) x.lineTo(cx + r * Math.cos(k * Math.PI / 3), cy + r * Math.sin(k * Math.PI / 3)); x.fill(); }
  } else if (kind === 'stripes') {
    x.strokeStyle = col; x.lineWidth = 10; for (let i = -512; i < 1024; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 300, 512); x.stroke(); }
  } else if (kind === 'petals') {
    for (let i = 0; i < 60; i++) { x.save(); x.translate(rnd() * 512, rnd() * 512); x.rotate(rnd() * 6.3); x.fillStyle = col; x.globalAlpha = .55 + rnd() * .45; x.beginPath(); x.ellipse(0, 0, 14, 7, 0, 0, 6.3); x.fill(); x.restore(); }
  } else if (kind === 'galaxy') {
    for (let i = 0; i < 9; i++) { const g = x.createRadialGradient(rnd() * 512, rnd() * 512, 0, rnd() * 512, rnd() * 512, 160 + rnd() * 120); const h = [270, 300, 220, 320][i % 4]; g.addColorStop(0, `hsla(${h},90%,60%,.55)`); g.addColorStop(1, 'transparent'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); }
    for (let i = 0; i < 420; i++) { x.fillStyle = `rgba(255,255,255,${.4 + rnd() * .6})`; const r = rnd() < .08 ? 1.8 : .8; x.beginPath(); x.arc(rnd() * 512, rnd() * 512, r, 0, 6.3); x.fill(); }
  } else if (kind === 'lava') {
    x.strokeStyle = '#ff6a00'; x.shadowColor = '#ffb000'; x.shadowBlur = 10;
    for (let i = 0; i < 26; i++) { x.lineWidth = 2 + rnd() * 4; x.beginPath(); let px = rnd() * 512, py = rnd() * 512; x.moveTo(px, py); for (let k = 0; k < 7; k++) { px += (rnd() - .5) * 120; py += (rnd() - .5) * 120; x.lineTo(px, py); } x.stroke(); }
  } else if (kind === 'circuit') {
    x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 3;
    for (let i = 0; i < 70; i++) { let px = Math.round(rnd() * 32) * 16, py = Math.round(rnd() * 32) * 16; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { if (rnd() < .5) px += (rnd() < .5 ? -1 : 1) * 48; else py += (rnd() < .5 ? -1 : 1) * 48; x.lineTo(px, py); } x.stroke(); x.beginPath(); x.arc(px, py, 5, 0, 6.3); x.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = kind === 'honeycomb' ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  texCache.set(key, t); return t;
}

/* ---------- build one mouse ---------- */
export function buildMouse(id) {
  const it = itemById[id] || itemById['m-starter'], k = it.look, s = SHAPES[k.shape] || SHAPES.classic;
  const group = new THREE.Group(); group.userData = { anim: k.anim, mats: [] };
  const geo = shellGeometry(s);
  const mat = new THREE.MeshPhysicalMaterial({ color: k.body, roughness: k.rough ?? .4, metalness: k.metal ?? 0, clearcoat: k.clearcoat || 0, clearcoatRoughness: .15, envMapIntensity: (k.metal || 0) > .5 ? 1.25 : .85 });
  if (k.iridescence) { mat.iridescence = k.iridescence; mat.iridescenceIOR = 1.6; mat.iridescenceThicknessRange = [180, 700]; }
  if (k.glass) Object.assign(mat, { transmission: 1, thickness: .6, roughness: .05, ior: 1.45, transparent: true });
  if (k.body2) {   // two-tone gradient shell
    const p = geo.attributes.position, cols = [], a = new THREE.Color(k.body), b = new THREE.Color(k.body2), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { c.copy(a).lerp(b, THREE.MathUtils.clamp(p.getZ(i) / s.L + .5, 0, 1)); cols.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); mat.vertexColors = true; mat.color.set('#ffffff');
  }
  if (k.pattern === 'carbon') { mat.map = patternTex('carbon', k.glow); }
  if (k.pattern === 'stripes' || k.pattern === 'petals' || k.pattern === 'circuit') {
    const t = patternTex(k.pattern, k.patternColor || '#fff', '#000000'); t.repeat.set(2, 1);
    mat.emissiveMap = t; mat.emissive = new THREE.Color(k.patternColor || '#fff'); mat.emissiveIntensity = k.pattern === 'petals' ? .35 : .9;
  }
  if (k.pattern === 'galaxy') { const t = patternTex('galaxy', '#fff', '#120a2a'); mat.map = t; mat.emissiveMap = t; mat.emissive = new THREE.Color('#ffffff'); mat.emissiveIntensity = .55; group.userData.scroll = t; }
  if (k.pattern === 'lava') { const t = patternTex('lava', '#ff6a00', '#000'); mat.emissiveMap = t; mat.emissive = new THREE.Color('#ff7a1a'); mat.emissiveIntensity = 1.4; group.userData.pulse = mat; }
  if (k.shape === 'honeycomb') { mat.alphaMap = patternTex('honeycomb'); mat.alphaMap.repeat.set(3, 2); mat.alphaTest = .5; mat.side = THREE.DoubleSide; mat.transparent = false; }
  const shell = new THREE.Mesh(geo, mat); shell.castShadow = true; group.add(shell); group.userData.mats.push(mat);

  // inner core: shows through honeycomb holes and glass shells
  if (k.shape === 'honeycomb' || k.inner) {
    const core = new THREE.Mesh(shellGeometry({ ...s, W: s.W * .88, H: s.H * .8, L: s.L * .92 }), new THREE.MeshStandardMaterial({ color: '#0b0b10', emissive: new THREE.Color(k.glow), emissiveIntensity: k.inner ? .9 : .35, roughness: .6 }));
    core.position.y = .02; group.add(core); group.userData.core = core.material;
  }

  // button split + side seams
  const seam = new THREE.MeshStandardMaterial({ color: '#05050a', roughness: .8 });
  const ptsOn = (fx, z0, z1, n = 24) => { const pts = []; for (let i = 0; i <= n; i++) { const zz = z0 + (z1 - z0) * i / n, w = halfW(s, zz); pts.push(new THREE.Vector3(fx * w, topY(s, fx, zz) + .065, zz * s.L / 2)); } return pts; };
  const tube = (pts, r, m) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8, false), m);
  group.add(tube(ptsOn(0, .98, .12), .012, seam));
  const cross = []; for (let i = 0; i <= 20; i++) { const fx = -.92 + 1.84 * i / 20, zz = .12; cross.push(new THREE.Vector3(fx * halfW(s, zz), topY(s, fx, zz) + .062, zz * s.L / 2)); }
  group.add(tube(cross, .01, seam));
  // scroll wheel
  const wz = .62, wy = topY(s, 0, wz) + .05;
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .1, 32), new THREE.MeshStandardMaterial({ color: k.wheel || '#111', roughness: .35, metalness: .3, emissive: new THREE.Color(k.wheel || '#000'), emissiveIntensity: k.wheel && k.wheel !== '#111' ? .35 : 0 }));
  wheel.rotation.z = Math.PI / 2; wheel.position.set(0, wy, wz * s.L / 2); group.add(wheel); group.userData.wheel = wheel;
  const slot = new THREE.Mesh(new THREE.BoxGeometry(.16, .06, .42), seam); slot.position.set(0, wy - .06, wz * s.L / 2); group.add(slot);
  // side buttons (left)
  const sideMat = new THREE.MeshPhysicalMaterial({ color: k.accent || '#333', roughness: .3, metalness: .4, clearcoat: .6 });
  [.18, -.12].forEach(zz => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(.045, .2, 4, 12), sideMat); b.rotation.x = Math.PI / 2; b.position.set(-halfW(s, zz) * .985 - .01, .36 * s.H + .12, zz * s.L / 2); group.add(b); });
  // RGB strip around the base
  const strip = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2, zz = Math.cos(a) * .97, w = halfW(s, zz) * 1.002; strip.push(new THREE.Vector3(Math.sin(a) * w, .1, zz * s.L / 2)); }
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(k.glow).multiplyScalar(2.2), toneMapped: false });
  group.add(tube(strip, .022, glowMat)); group.userData.glow = glowMat; group.userData.glowBase = new THREE.Color(k.glow);
  // logo dot near the palm
  const dot = new THREE.Mesh(new THREE.CircleGeometry(.07, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(k.glow).multiplyScalar(1.8), toneMapped: false }));
  dot.position.set(0, topY(s, 0, -.55) + .067, -.55 * s.L / 2); dot.rotation.x = -Math.PI / 2 + .35; group.add(dot); group.userData.dot = dot.material;
  // sit the mouse on y = 0, centred
  group.rotation.order = 'YXZ';
  return group;
}

export function animateMouse(g, t) {
  const u = g.userData;
  if (u.anim === 'hue') { const c = new THREE.Color().setHSL((t * .08) % 1, .9, .6); u.glow.color.copy(c).multiplyScalar(2.2); u.dot.color.copy(c).multiplyScalar(1.8); u.mats.forEach(m => { if (m.iridescence) m.iridescenceThicknessRange = [160 + 120 * Math.sin(t), 700]; }); if (u.core) u.core.emissive.copy(c); }
  if (u.anim === 'pulse') { const k = .7 + .5 * Math.sin(t * 2.4); if (u.pulse) u.pulse.emissiveIntensity = 1.1 + k; u.glow.color.copy(u.glowBase).multiplyScalar(1.4 + k); if (u.core) u.core.emissiveIntensity = .6 + .4 * k; }
  if (u.anim === 'drift' && u.scroll) u.scroll.offset.x = t * .02;
  if (u.wheel) u.wheel.rotation.x = t * .8;
}

/* ---------- shared scene pieces ---------- */
function stage(renderer, rarity) {
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .7; pm.dispose();
  const rc = new THREE.Color(RARITY[rarity] ? RARITY[rarity].color : '#a855f7');
  scene.add(new THREE.HemisphereLight('#c8d4ff', '#100818', .45));
  const key = new THREE.DirectionalLight('#ffffff', 1.55); key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; scene.add(key);
  const rim = new THREE.PointLight(rc, 18, 12); rim.position.set(-3, 2, -3); scene.add(rim);
  const rim2 = new THREE.PointLight('#22d3ee', 8, 10); rim2.position.set(3, 1.2, -2.5); scene.add(rim2);
  // soft contact shadow
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = -.005; scene.add(sh);
  return scene;
}
function makeRenderer(canvas, w, h) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!canvas });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setSize(w, h, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = .92; r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.setClearColor(0x000000, 0);
  return r;
}
function composer(renderer, scene, camera, w, h, strength = .55, threshold = .96) {
  const c = new EffectComposer(renderer); c.setSize(w, h);
  c.addPass(new RenderPass(scene, camera));
  c.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), strength, .45, threshold));   // only the light strips and glowing patterns bloom
  c.addPass(new OutputPass());
  return c;
}
export const webglOK = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();

/* ---------- thumbnails: one renderer, cached images ---------- */
let thumbR = null; const thumbCache = new Map(); let queue = Promise.resolve();
export function thumb(id, w = 360, h = 260) {
  const key = id + w + 'x' + h;
  if (thumbCache.has(key)) return Promise.resolve(thumbCache.get(key));
  try { const s = sessionStorage.getItem('pmo_th_' + key); if (s) { thumbCache.set(key, s); return Promise.resolve(s); } } catch (e) { /* storage off */ }
  if (!webglOK) return Promise.resolve(fallbackArt(id));
  queue = queue.then(() => new Promise(res => requestAnimationFrame(() => {
    try {
      if (!thumbR) { const cv = document.createElement('canvas'); thumbR = makeRenderer(cv, w, h); }
      thumbR.setSize(w, h, false);
      const it = itemById[id], scene = stage(thumbR, it.rarity), cam = new THREE.PerspectiveCamera(32, w / h, .1, 50);
      cam.position.set(2.9, 2.3, 3.1); cam.lookAt(0, .3, 0);
      const m = buildMouse(id); m.rotation.y = -.55; animateMouse(m, 1.2); scene.add(m);
      const comp = composer(thumbR, scene, cam, w * thumbR.getPixelRatio(), h * thumbR.getPixelRatio(), .32, .99); comp.render();
      const url = thumbR.domElement.toDataURL('image/webp', .85);
      thumbCache.set(key, url); try { sessionStorage.setItem('pmo_th_' + key, url); } catch (e) { /* full */ }
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); comp.dispose && comp.dispose();
      res(url);
    } catch (e) { console.warn('3D thumbnail failed', e); res(fallbackArt(id)); }
  })));
  return queue;
}
export function fallbackArt(id) {
  const k = (itemById[id] || {}).look || {};
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${k.body || '#333'}"/><stop offset="1" stop-color="${k.body2 || k.accent || '#111'}"/></linearGradient></defs><rect x="38" y="10" width="44" height="72" rx="22" fill="url(#g)" stroke="${k.glow || '#a855f7'}" stroke-width="2.5"/><path d="M60 11v26" stroke="#000" stroke-opacity=".5" stroke-width="2"/><rect x="57" y="20" width="6" height="11" rx="3" fill="${k.wheel || '#111'}"/></svg>`);
}

/* ---------- interactive viewer ---------- */
const live = new Set();   // open viewers; WebGL contexts are limited, so free the ones whose element left the page
export function gcViewers() { live.forEach(v => { if (!v.host.isConnected) v.dispose(); }); }
export function viewer(host, id, opts = {}) {
  gcViewers(); if (host._pmView) host._pmView.dispose();
  if (!webglOK) { host.innerHTML = `<img src="${fallbackArt(id)}" alt="">`; return { set() {}, dispose() {} }; }
  const w = host.clientWidth || 400, h = host.clientHeight || 300, canvas = document.createElement('canvas'); host.prepend(canvas);
  const r = makeRenderer(canvas, w, h); let it = itemById[id];
  let scene = stage(r, it.rarity), m = buildMouse(id); scene.add(m);
  const cam = new THREE.PerspectiveCamera(30, w / h, .1, 50); cam.position.set(0, 2.2, 5.2); cam.lookAt(0, .3, 0);
  let comp = composer(r, scene, cam, w * r.getPixelRatio(), h * r.getPixelRatio(), opts.bloom ?? .6);
  let yaw = -.6, pitch = .12, vy = opts.spin === false ? 0 : .35, drag = null, raf = 0, t0 = performance.now(), alive = true;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; yaw = drag.yaw + (e.clientX - drag.x) * .01; pitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * .006, -.35, .7); });
  const up = () => { drag = null; canvas.style.cursor = ''; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const ro = new ResizeObserver(() => { const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return; r.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); comp.setSize(W * r.getPixelRatio(), H * r.getPixelRatio()); }); ro.observe(host);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { if (e.isIntersecting && !raf && alive) loop(); }) : null; io && io.observe(host);
  function loop() {
    raf = requestAnimationFrame(loop);
    if (io && host.getBoundingClientRect().bottom < 0) { cancelAnimationFrame(raf); raf = 0; return; }
    const t = (performance.now() - t0) / 1000;
    if (!drag) yaw += vy * .016;
    m.rotation.y = yaw; m.rotation.x = pitch * .4; m.position.y = .05 + Math.sin(t * 1.6) * .03;
    animateMouse(m, t); comp.render();
  }
  loop();
  const handle = {
    host,
    set(newId) {
      scene.remove(m); m.traverse(o => o.geometry && o.geometry.dispose());
      it = itemById[newId]; scene = stage(r, it.rarity); m = buildMouse(newId); scene.add(m);
      comp = composer(r, scene, cam, r.domElement.width, r.domElement.height, opts.bloom ?? .6);
    },
    dispose() { if (!alive) return; alive = false; live.delete(handle); if (host._pmView === handle) host._pmView = null; cancelAnimationFrame(raf); ro.disconnect(); io && io.disconnect(); m.traverse(o => o.geometry && o.geometry.dispose()); comp.dispose && comp.dispose(); r.dispose(); r.forceContextLoss && r.forceContextLoss(); canvas.remove(); }
  };
  live.add(handle); host._pmView = handle;
  return handle;
}
