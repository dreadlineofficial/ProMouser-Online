/* =====================================================================
   ProMouser Online: 3D digital mice

   Each mouse is built like a real one: a lofted shell from a top-view
   outline and a side profile, then separate parts — split left/right
   buttons with part lines, a treaded wheel in its slot, a DPI button,
   side buttons, rubber side grips, a base plate, skates and a logo —
   each with its own physically based material.
   One shared renderer makes shop thumbnails; viewer() is the
   interactive, studio-lit 3D view.
   ===================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { itemById, RARITY } from './data.js';

/* ---------- shell shapes (scene unit ≈ 5 cm; 2.5 ≈ a 125 mm mouse) ----------
   L/W/H: length, max width, max height · hump: where the back peaks (0 back … 1 front)
   front: nose height vs. peak · waist: pinch near the front · n/m: side/top squareness
   btn: where the buttons begin · ergo: right-handed shape with a lower right side and a flared left */
const SHAPES = {
  classic:   { L: 2.5, W: 1.28, H: .8,  hump: .36, front: .5,  back: .52, waist: .05, n: 2.5, m: 1.55, btn: .54, ergo: 0 },
  ergo:      { L: 2.55, W: 1.36, H: .88, hump: .4, front: .46, back: .5,  waist: .03, n: 2.7, m: 1.45, btn: .56, ergo: 1 },
  mini:      { L: 2.3, W: 1.24, H: .76, hump: .34, front: .52, back: .55, waist: .06, n: 2.4, m: 1.6,  btn: .53, ergo: 0 },
  honeycomb: { L: 2.5, W: 1.28, H: .8,  hump: .36, front: .5,  back: .52, waist: .05, n: 2.5, m: 1.55, btn: .54, ergo: 0 }
};
const BASE = .07;   // base plate thickness
const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const ends = (t, p) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * t - 1), p)), .5);   // 0 at the ends, rounded

function halfW(s, t) {
  const plan = .84 + .16 * Math.exp(-(((t - .3) / .3) ** 2)) - s.waist * Math.exp(-(((t - .66) / .14) ** 2)) + (s.ergo ? .05 * Math.exp(-(((t - .35) / .25) ** 2)) : 0);
  return s.W / 2 * ends(t, 3.4) * plan;
}
function topH(s, t) {
  const prof = t < s.hump ? s.back + (1 - s.back) * ss(t / s.hump) : 1 - (1 - s.front) * ss((t - s.hump) / (1 - s.hump));
  return s.H * ends(t, 7) * prof;
}
// a point on the surface: t along the length (0 back … 1 front), a around the section (0 right side … π left side)
function surf(s, t, a, grow = 0) {
  const w = halfW(s, t) + grow, h = topH(s, t) + grow, c = Math.cos(a), sn = Math.max(0, Math.sin(a));
  let x = w * Math.sign(c) * Math.pow(Math.abs(c), 2 / s.n), y = h * Math.pow(sn, 2 / s.m);
  if (s.ergo) {
    if (x > 0) y *= 1 - .17 * (x / (w || 1));                                                                // right side slopes down
    else x *= 1 + .06 * Math.sin(Math.PI * Math.min(1, y / (h || 1))) * Math.exp(-(((t - .42) / .22) ** 2));   // flared left side for the thumb
  }
  return new THREE.Vector3(x, y + BASE, (t - .5) * s.L);
}
function normalAt(s, t, a) {   // outward surface normal (numerical)
  const p = surf(s, t, a), dt = surf(s, Math.min(1, t + .01), a).sub(p), da = surf(s, t, a + .01).sub(p), n = da.cross(dt).normalize();
  return n.y < 0 ? n.negate() : n;
}
function loft(s, t0, t1, a0, a1, nt, na, grow = 0) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nt; i++) for (let j = 0; j <= na; j++) {
    const t = t0 + (t1 - t0) * i / nt, a = a0 + (a1 - a0) * j / na, p = surf(s, t, a, grow);
    pos.push(p.x, p.y, p.z); uv.push(a / Math.PI, t);
  }
  for (let i = 0; i < nt; i++) for (let j = 0; j < na; j++) { const A = i * (na + 1) + j, B = A + 1, C = A + na + 1, D = C + 1; idx.push(A, C, B, B, C, D); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const outline = (s, k = 1, n = 120) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(halfW(s, t) * k, (t - .5) * s.L)); } for (let i = n; i >= 0; i--) { const t = i / n; pts.push(new THREE.Vector2(-halfW(s, t) * k, (t - .5) * s.L)); } return pts; };

/* ---------- painted textures ---------- */
const texCache = new Map();
function canvasTex(key, draw, { size = 512, color = true, repeat = [1, 1] } = {}) {
  const k = key + repeat.join('x'); if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  texCache.set(k, t); return t;
}
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function patternTex(kind, col = '#ffffff', base = '#000000') {
  return canvasTex('p' + kind + col + base, (x, S) => {
    const r = seeded(); x.fillStyle = base; x.fillRect(0, 0, S, S);
    if (kind === 'carbon') {
      const q = 16; for (let i = 0; i < S / q; i++) for (let j = 0; j < S / q; j++) { const g = x.createLinearGradient(i * q, j * q, i * q + q, j * q + q), on = (i + j) % 2; g.addColorStop(0, on ? '#30343d' : '#101216'); g.addColorStop(1, on ? '#15171c' : '#2a2e36'); x.fillStyle = g; x.fillRect(i * q, j * q, q, q); }
    } else if (kind === 'stripes') {
      x.fillStyle = col; [.2, .26, .74, .8].forEach(u => x.fillRect(u * S, 0, S * .018, S));   // twin racing stripes along the length
    } else if (kind === 'petals') {
      for (let i = 0; i < 70; i++) { x.save(); x.translate(r() * S, r() * S); x.rotate(r() * 6.3); x.fillStyle = col; x.globalAlpha = .45 + r() * .5; x.beginPath(); x.ellipse(0, 0, 11, 5.5, 0, 0, 6.3); x.fill(); x.restore(); }
    } else if (kind === 'galaxy') {
      for (let i = 0; i < 10; i++) { const cx = r() * S, cy = r() * S, g = x.createRadialGradient(cx, cy, 0, cx, cy, 120 + r() * 140), h = [265, 295, 220, 320][i % 4]; g.addColorStop(0, `hsla(${h},85%,58%,.5)`); g.addColorStop(1, 'transparent'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
      for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,255,255,${.35 + r() * .65})`; x.beginPath(); x.arc(r() * S, r() * S, r() < .06 ? 1.6 : .7, 0, 6.3); x.fill(); }
    } else if (kind === 'lava') {
      x.strokeStyle = '#ff7a1a'; x.shadowColor = '#ffb000'; x.shadowBlur = 8;
      for (let i = 0; i < 30; i++) { x.lineWidth = 1.5 + r() * 3.5; x.beginPath(); let px = r() * S, py = r() * S; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - .5) * 110; py += (r() - .5) * 110; x.lineTo(px, py); } x.stroke(); }
    } else if (kind === 'circuit') {
      x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2.5;
      for (let i = 0; i < 80; i++) { let px = Math.round(r() * 32) * 16, py = Math.round(r() * 32) * 16; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { if (r() < .5) px += (r() < .5 ? -1 : 1) * 48; else py += (r() < .5 ? -1 : 1) * 48; x.lineTo(px, py); } x.stroke(); x.beginPath(); x.arc(px, py, 4, 0, 6.3); x.fill(); }
    }
  });
}
const honeyTex = () => canvasTex('honey', (x, S) => {
  x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); x.fillStyle = '#000'; const rr = 13, w = rr * Math.sqrt(3);
  for (let row = -1; row < S / (rr * 1.5) + 1; row++) for (let q = -1; q < S / w + 1; q++) { const cx = q * w + (row % 2 ? w / 2 : 0), cy = row * rr * 1.5; x.beginPath(); for (let k = 0; k < 6; k++) x.lineTo(cx + rr * .78 * Math.cos(Math.PI / 6 + k * Math.PI / 3), cy + rr * .78 * Math.sin(Math.PI / 6 + k * Math.PI / 3)); x.fill(); }
}, { color: false, repeat: [3, 2.2] });
const gripTex = () => canvasTex('grip', (x, S) => {   // diamond knurl bump map
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S); x.fillStyle = '#fff'; const q = 16;
  for (let i = 0; i < S / q; i++) for (let j = 0; j < S / q; j++) { const cx = i * q + q / 2, cy = j * q + q / 2; x.beginPath(); x.moveTo(cx, cy - 6); x.lineTo(cx + 6, cy); x.lineTo(cx, cy + 6); x.lineTo(cx - 6, cy); x.fill(); }
}, { color: false, size: 256, repeat: [4, 4] });
const treadTex = () => canvasTex('tread', (x, S) => { x.fillStyle = '#000'; x.fillRect(0, 0, S, S); x.fillStyle = '#fff'; for (let i = 0; i < 48; i++) x.fillRect(i * S / 48, 0, S / 96, S); }, { color: false, size: 256 });
const grainTex = () => canvasTex('grain', (x, S) => { const d = x.createImageData(S, S), r = seeded(3); for (let i = 0; i < d.data.length; i += 4) { const v = 150 + r() * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); }, { color: false, size: 256, repeat: [3, 3] });

/* ---------- build one mouse ---------- */
export function buildMouse(id) {
  const it = itemById[id] || itemById['m-starter'], k = it.look, s = SHAPES[k.shape] || SHAPES.classic;
  const g = new THREE.Group(); g.userData = { anim: k.anim, shells: [], s };
  const metal = k.metal ?? 0, glass = !!k.glass, honey = k.shape === 'honeycomb';
  const shellMat = () => {
    const m = new THREE.MeshPhysicalMaterial({ color: k.body, roughness: k.rough ?? .5, metalness: metal, clearcoat: k.clearcoat ?? (metal > .5 ? .3 : .1), clearcoatRoughness: .35, roughnessMap: metal > .5 || glass ? null : grainTex(), envMapIntensity: metal > .5 ? 1.3 : 1, side: THREE.DoubleSide });
    if (k.iridescence) Object.assign(m, { iridescence: k.iridescence, iridescenceIOR: 1.7, iridescenceThicknessRange: [200, 750] });
    if (glass) Object.assign(m, { transmission: 1, thickness: .5, roughness: .08, ior: 1.45, clearcoat: 1 });
    if (k.pattern === 'carbon') { m.map = patternTex('carbon'); m.map.repeat.set(5, 5); }
    if (k.pattern === 'galaxy') { const t = patternTex('galaxy', '#fff', '#140a2c'); m.map = t; m.emissiveMap = t; m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = .45; g.userData.scroll = t; }
    if (k.pattern === 'lava') { m.emissiveMap = patternTex('lava', '#ff7a1a'); m.emissive = new THREE.Color('#ff7a1a'); m.emissiveIntensity = 1.6; g.userData.pulse = m; }
    if (['stripes', 'petals', 'circuit'].includes(k.pattern)) { m.emissiveMap = patternTex(k.pattern, k.patternColor || '#fff'); m.emissive = new THREE.Color(k.patternColor || '#fff'); m.emissiveIntensity = k.pattern === 'petals' ? .32 : .85; }
    if (honey) { m.alphaMap = honeyTex(); m.alphaTest = .5; }
    if (k.body2) m.vertexColors = true;
    g.userData.shells.push(m); return m;
  };
  const tint = geo => {   // two-tone gradient shells
    if (!k.body2) return geo; const p = geo.attributes.position, a = new THREE.Color(k.body), b = new THREE.Color(k.body2), c = new THREE.Color(), cols = [];
    for (let i = 0; i < p.count; i++) { c.copy(a).lerp(b, THREE.MathUtils.clamp(p.getZ(i) / s.L + .5, 0, 1)); cols.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return geo;
  };
  const add = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
  const aS = .52, gA = .016, gT = .012, PI = Math.PI;
  // inner body: shows through part lines, honeycomb holes and glass
  const core = new THREE.MeshStandardMaterial({ color: '#07070a', roughness: .8, emissive: new THREE.Color(k.glow || '#000'), emissiveIntensity: k.inner ? .9 : honey ? .35 : 0 });
  add(loft(s, .004, .996, 0, PI, 60, 40, -.02), core, false); g.userData.core = core;
  // shell: sides (full length) + palm (behind the buttons)
  const sh = shellMat();
  add(tint(loft(s, 0, 1, 0, aS, 96, 14)), sh); add(tint(loft(s, 0, 1, PI - aS, PI, 96, 14)), sh);
  add(tint(loft(s, 0, s.btn - gT, aS, PI - aS, 60, 40)), sh);
  // buttons: split, raised a hair, with a gap down the middle
  const btnL = new THREE.Group(), btnR = new THREE.Group(); g.add(btnL, btnR);
  [[btnR, aS + .01, PI / 2 - gA], [btnL, PI / 2 + gA, PI - aS - .01]].forEach(([grp, a0, a1]) => { const m = new THREE.Mesh(tint(loft(s, s.btn, 1, a0, a1, 50, 22, .004)), sh); m.castShadow = true; grp.add(m); });
  g.userData.buttons = [btnL, btnR];
  // rubber side grips
  if (k.grips !== false && !glass && !honey && metal < .8) {
    const rub = new THREE.MeshStandardMaterial({ color: k.grip || '#15161a', roughness: .92, bumpMap: gripTex(), bumpScale: .9 });
    add(loft(s, .32, .66, .08, .44, 30, 10, .006), rub); add(loft(s, .32, .66, PI - .44, PI - .08, 30, 10, .006), rub);
  }
  // scroll wheel in its slot
  const tw = s.btn + (1 - s.btn) * .42, wy = topH(s, tw) + BASE - .05, wz = (tw - .5) * s.L;
  const slot = add(new THREE.BoxGeometry(.12, .1, .44), new THREE.MeshStandardMaterial({ color: '#050506', roughness: .9 }), false); slot.position.set(0, wy - .035, wz);
  const wheelMat = new THREE.MeshStandardMaterial({ color: k.wheel || '#1a1a1e', roughness: .55, metalness: .2, bumpMap: treadTex(), bumpScale: 1.4, emissive: new THREE.Color(k.wheel && !/^#1|^#0/.test(k.wheel) ? k.wheel : '#000'), emissiveIntensity: .25 });
  const wheel = add(new THREE.CylinderGeometry(.15, .15, .085, 48, 1), wheelMat); wheel.rotation.z = PI / 2; wheel.position.set(0, wy + .02, wz); g.userData.wheel = wheel;
  const hub = add(new THREE.CylinderGeometry(.155, .155, .02, 48), new THREE.MeshStandardMaterial({ color: '#2a2b30', metalness: .8, roughness: .3 })); hub.rotation.z = PI / 2; hub.position.copy(wheel.position);
  // DPI button behind the wheel, side buttons on the left
  const accent = new THREE.MeshPhysicalMaterial({ color: k.accent || '#2a2d36', roughness: .32, metalness: .4, clearcoat: .7 });
  const pill = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);
  const tdpi = s.btn - .075, dpi = add(pill(.035, .1), accent); dpi.rotation.x = PI / 2; dpi.position.copy(surf(s, tdpi, PI / 2, .01));
  [.47, .6].forEach(t => { const sb = add(pill(.038, .2), accent), p = surf(s, t, PI - .62, .018); sb.rotation.x = PI / 2; sb.position.copy(p); });   // thumb height
  // base plate, skates
  const plate = new THREE.Shape(outline(s, .995)), base = add(new THREE.ExtrudeGeometry(plate, { depth: BASE, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: '#0b0b0e', roughness: .6 }));
  base.rotation.x = PI / 2; base.position.y = BASE;
  // logo on the palm and an RGB strip around the base
  const glowCol = new THREE.Color(k.glow || '#ffffff');
  const logoMat = new THREE.MeshBasicMaterial({ color: glowCol.clone().multiplyScalar(1.8), toneMapped: false });
  const lp = surf(s, .24, PI / 2, .006), logo = add(new THREE.RingGeometry(.045, .085, 32), logoMat, false);
  logo.position.copy(lp); logo.lookAt(lp.clone().add(normalAt(s, .24, PI / 2))); g.userData.logo = logoMat;
  const strip = []; for (let i = 0; i <= 160; i++) { const u = i / 160, t = u < .5 ? u * 2 : 2 - u * 2, side = u < .5 ? 1 : -1; strip.push(new THREE.Vector3(side * (halfW(s, t) + .006), BASE + .055, (t - .5) * s.L)); }
  const glowMat = new THREE.MeshBasicMaterial({ color: glowCol.clone().multiplyScalar(2.2), toneMapped: false });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strip, true), 200, .012, 6, true), glowMat, false); g.userData.glow = glowMat; g.userData.glowBase = glowCol;
  g.rotation.order = 'YXZ';
  return g;
}

/* pressing a button (CPS games) */
export function pressMouse(g, which = 0, amount = 1) { const b = g.userData.buttons && g.userData.buttons[which]; if (b) b.position.y = -.025 * amount; }

export function animateMouse(g, t) {
  const u = g.userData;
  if (u.anim === 'hue') { const c = new THREE.Color().setHSL((t * .08) % 1, .9, .6); u.glow.color.copy(c).multiplyScalar(2.2); u.logo.color.copy(c).multiplyScalar(1.8); if (u.core && u.core.emissiveIntensity) u.core.emissive.copy(c); u.shells.forEach(m => { if (m.iridescence) m.iridescenceThicknessRange = [180 + 140 * Math.sin(t), 760]; }); }
  if (u.anim === 'pulse') { const k = .5 + .5 * Math.sin(t * 2.4); if (u.pulse) u.pulse.emissiveIntensity = 1.1 + k; u.glow.color.copy(u.glowBase).multiplyScalar(1.4 + k); if (u.core) u.core.emissiveIntensity = .5 + .5 * k; }
  if (u.anim === 'drift' && u.scroll) u.scroll.offset.x = t * .02;
  if (u.wheel) u.wheel.rotation.x = t * .9;
  if (u.buttons) u.buttons.forEach(b => { b.position.y *= .8; });
}

/* ---------- studio ----------
   A product-photo setup: a soft gradient dome with long softbox strips (smooth, elongated
   highlights instead of blotches), a curved cyclorama backdrop and a shadow-catching floor. */
const envCache = new WeakMap();
function studioEnv(renderer) {
  if (envCache.has(renderer)) return envCache.get(renderer);
  const sc = new THREE.Scene(), dome = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: {},
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 v; void main(){ float h = v.y * .5 + .5; gl_FragColor = vec4(mix(vec3(.02), vec3(.22, .23, .26), smoothstep(.35, 1., h)), 1.); }' }));
  sc.add(dome);
  const box = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
  box(14, 3, -6, 9, 6, 3.2); box(3, 10, 9, 3, -4, 2.2); box(10, 2, 0, 4, -10, 1.6); box(4, 4, -9, 2, -2, 1.2);
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(sc, .02).texture; pm.dispose();
  envCache.set(renderer, tex); return tex;
}
function stage(renderer, rarity, { backdrop = true } = {}) {
  const scene = new THREE.Scene(); scene.environment = studioEnv(renderer); scene.environmentIntensity = 1;
  const rc = new THREE.Color(RARITY[rarity] ? RARITY[rarity].color : '#d7ff3c');
  scene.add(new THREE.HemisphereLight('#e8eeff', '#16161b', .25));
  const key = new THREE.DirectionalLight('#fff4e6', 1.9); key.position.set(-4, 7, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 10; key.shadow.blurSamples = 20; Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); scene.add(key);
  const rim = new THREE.DirectionalLight(rc, 2.6); rim.position.set(3.5, 2.5, -4); scene.add(rim);
  if (backdrop) {   // dark seamless studio: the floor fades into the background, with a soft pool of light under the mouse
    const bg = new THREE.Color('#0f1114').lerp(rc, .035); scene.background = bg; scene.fog = new THREE.Fog(bg, 6.5, 13);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: '#1a1c21', roughness: .82, metalness: 0 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const pool = new THREE.SpotLight('#ffffff', 26, 12, .55, .9, 1.4); pool.position.set(.3, 6, .6); pool.target.position.set(0, 0, 0); scene.add(pool, pool.target);
  } else {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: .42 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  }
  return scene;
}
function makeRenderer(canvas, w, h) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!canvas });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setSize(w, h, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1; r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true; r.shadowMap.type = THREE.VSMShadowMap;
  r.setClearColor(0x000000, 0);
  return r;
}
function composer(renderer, scene, camera, w, h, strength = .45, threshold = .98) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });   // keeps transparency + MSAA
  const c = new EffectComposer(renderer, rt); c.setSize(w, h);
  c.addPass(new RenderPass(scene, camera)); c.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), strength, .35, threshold)); c.addPass(new OutputPass());
  return c;
}
export const webglOK = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
const placeCam = cam => { cam.position.set(-3.95, 1.6, 2.45); cam.lookAt(0, .32, 0); };   // low three-quarter from the front-left: shows the profile and side buttons

/* ---------- thumbnails: one renderer, cached images ---------- */
let thumbR = null; const thumbCache = new Map(); let queue = Promise.resolve();
const TH_VER = 'v5';
export function thumb(id, w = 360, h = 260) {
  const key = TH_VER + id + w + 'x' + h;
  if (thumbCache.has(key)) return Promise.resolve(thumbCache.get(key));
  try { const s = sessionStorage.getItem('pmo_th_' + key); if (s) { thumbCache.set(key, s); return Promise.resolve(s); } } catch (e) { /* storage off */ }
  if (!webglOK) return Promise.resolve(fallbackArt(id));
  queue = queue.then(() => new Promise(res => requestAnimationFrame(() => {
    try {
      if (!thumbR) thumbR = makeRenderer(document.createElement('canvas'), w, h);
      thumbR.setSize(w, h, false);
      const it = itemById[id], scene = stage(thumbR, it.rarity), cam = new THREE.PerspectiveCamera(27, w / h, .1, 50);
      const m = buildMouse(id); placeCam(cam); m.rotation.y = .1; animateMouse(m, 1.2); scene.add(m);
      const comp = composer(thumbR, scene, cam, w * thumbR.getPixelRatio(), h * thumbR.getPixelRatio(), .3); comp.render();
      const url = thumbR.domElement.toDataURL('image/webp', .88);
      thumbCache.set(key, url); try { sessionStorage.setItem('pmo_th_' + key, url); } catch (e) { /* full */ }
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); comp.dispose && comp.dispose();
      res(url);
    } catch (e) { console.warn('3D thumbnail failed', e); res(fallbackArt(id)); }
  })));
  return queue;
}
export function fallbackArt(id) {
  const k = (itemById[id] || {}).look || {};
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect x="38" y="10" width="44" height="72" rx="22" fill="${k.body || '#333'}" stroke="${k.glow || '#d7ff3c'}" stroke-width="2"/><path d="M60 11v26" stroke="#000" stroke-opacity=".5" stroke-width="2"/><rect x="57" y="20" width="6" height="11" rx="3" fill="${k.wheel || '#111'}"/></svg>`);
}

/* ---------- interactive viewer ---------- */
const live = new Set();   // open viewers; WebGL contexts are limited, so free the ones whose element left the page
export function gcViewers() { live.forEach(v => { if (!v.host.isConnected) v.dispose(); }); }
export function viewer(host, id, opts = {}) {
  gcViewers(); if (host._pmView) host._pmView.dispose();
  if (!webglOK) { host.insertAdjacentHTML('afterbegin', `<img src="${fallbackArt(id)}" alt="">`); return { set() {}, dispose() {} }; }
  const w = host.clientWidth || 400, h = host.clientHeight || 300, canvas = document.createElement('canvas'); host.prepend(canvas);
  const r = makeRenderer(canvas, w, h); let it = itemById[id];
  let scene = stage(r, it.rarity), m = buildMouse(id); scene.add(m);
  const cam = new THREE.PerspectiveCamera(opts.fov || 26, w / h, .1, 50); placeCam(cam);
  if (opts.far) { cam.position.multiplyScalar(opts.far); cam.lookAt(0, .33, .1); }
  const shift = (W, H) => { if (opts.shift) cam.setViewOffset(W, H, -W * opts.shift, 0, W, H); }; shift(w, h);   // push the mouse off-centre (hero layouts)
  let comp = composer(r, scene, cam, w * r.getPixelRatio(), h * r.getPixelRatio(), opts.bloom ?? .45);
  let yaw = .1, pitch = 0, vy = opts.spin === false ? 0 : .3, drag = null, raf = 0, t0 = performance.now(), alive = true;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; yaw = drag.yaw + (e.clientX - drag.x) * .01; pitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * .005, -.3, .5); });
  const up = () => { drag = null; canvas.style.cursor = ''; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const ro = new ResizeObserver(() => { const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return; r.setSize(W, H, false); cam.aspect = W / H; shift(W, H); cam.updateProjectionMatrix(); comp.setSize(W * r.getPixelRatio(), H * r.getPixelRatio()); }); ro.observe(host);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { if (e.isIntersecting && !raf && alive) loop(); }) : null; io && io.observe(host);
  function loop() {
    raf = requestAnimationFrame(loop);
    const b = host.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) { cancelAnimationFrame(raf); raf = 0; return; }
    const t = (performance.now() - t0) / 1000;
    if (!drag) yaw += vy * .016;
    m.rotation.y = yaw; m.rotation.x = pitch * .5; m.position.y = .04 + Math.sin(t * 1.4) * .02;
    animateMouse(m, t); comp.render();
  }
  loop();
  const handle = {
    host,
    set(newId) {
      scene.remove(m); m.traverse(o => o.geometry && o.geometry.dispose());
      it = itemById[newId]; scene = stage(r, it.rarity); m = buildMouse(newId); scene.add(m);
      comp = composer(r, scene, cam, r.domElement.width, r.domElement.height, opts.bloom ?? .45);
    },
    dispose() { if (!alive) return; alive = false; live.delete(handle); if (host._pmView === handle) host._pmView = null; cancelAnimationFrame(raf); ro.disconnect(); io && io.disconnect(); m.traverse(o => o.geometry && o.geometry.dispose()); comp.dispose && comp.dispose(); r.dispose(); r.forceContextLoss && r.forceContextLoss(); canvas.remove(); }
  };
  live.add(handle); host._pmView = handle;
  return handle;
}
export { THREE, SHAPES };
