/* =====================================================================
   ProMouser Online: shared 3D FPS engine (Arena, Shooting Gallery)
   Renderer + bloom, mouse-look, a procedural gun with recoil and muzzle
   flash, tracers, sparks, crosshair/hitmarkers, synthesized sound and a
   daylight world kit (sky, sun, concrete, AO blocks, wall lettering).
   ===================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE };

const HQ = new URLSearchParams(location.search).has('hq');   // ?hq keeps full quality (screenshots)
export function engine(stage, { fov = 78, bloom = .7 } = {}) {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; stage.appendChild(canvas);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1; r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(fov, 1, .05, 400); cam.rotation.order = 'YXZ'; scene.add(cam);
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .35; pm.dispose();
  const comp = new EffectComposer(r); comp.addPass(new RenderPass(scene, cam));
  const bl = new UnrealBloomPass(new THREE.Vector2(256, 256), bloom, .5, .82); comp.addPass(bl); comp.addPass(new OutputPass());
  const fit = () => { const w = stage.clientWidth, h = stage.clientHeight; r.setSize(w, h, false); comp.setSize(w * r.getPixelRatio(), h * r.getPixelRatio()); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  fit(); const ro = new ResizeObserver(fit); ro.observe(stage);
  // adaptive quality: if frames are slow (older laptops, no GPU), step down until it plays smoothly
  let level = 0, frames = 0, slow = 0, lastT = 0, winStart = 0;
  const steps = [
    () => { r.setPixelRatio(1); fit(); },
    () => { bl.enabled = false; },
    () => { r.shadowMap.enabled = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); r.setPixelRatio(.75); fit(); }
  ];
  function render() {
    const now = performance.now();
    if (lastT) { frames++; if (now - lastT > 40) slow++; } else winStart = now;
    lastT = now;
    if (!HQ && frames >= 5 && now - winStart > 1500) { if (slow / frames > .5 && level < steps.length) steps[level++](); frames = slow = 0; winStart = now; }   // judged every ~1.5 s
    if (bl.enabled) comp.render(); else r.render(scene, cam);
  }
  return { r, scene, cam, comp, canvas, render, get quality() { return 3 - level; }, dispose() { ro.disconnect(); comp.dispose && comp.dispose(); r.dispose(); r.forceContextLoss && r.forceContextLoss(); canvas.remove(); } };
}

/* mouse-look: pointer lock when allowed, arrow keys always */
export function look(canvas, cam, { sens = .0022 } = {}) {
  const st = { yaw: 0, pitch: 0, locked: false, keys: new Set(), buttons: 0, sens };
  const onMove = e => { if (!st.locked) return; st.yaw -= e.movementX * st.sens; st.pitch = THREE.MathUtils.clamp(st.pitch - e.movementY * st.sens, -1.45, 1.45); };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('pointerlockchange', () => { st.locked = document.pointerLockElement === canvas; });
  const kd = e => { if (/^(Key[WASDRQE]|Space|Shift(Left|Right)|Arrow\w+|Tab)$/.test(e.code)) e.preventDefault(); st.keys.add(e.code); };
  const ku = e => st.keys.delete(e.code);
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', () => st.keys.clear());
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  st.lock = () => { try { const p = canvas.requestPointerLock && canvas.requestPointerLock({ unadjustedMovement: true }); p && p.catch && p.catch(() => { try { canvas.requestPointerLock(); } catch (e) { /* not allowed */ } }); } catch (e) { /* not allowed */ } };
  st.apply = dt => {
    if (st.keys.has('ArrowLeft')) st.yaw += 2.2 * dt; if (st.keys.has('ArrowRight')) st.yaw -= 2.2 * dt;
    if (st.keys.has('ArrowUp')) st.pitch = Math.min(1.45, st.pitch + 1.6 * dt); if (st.keys.has('ArrowDown')) st.pitch = Math.max(-1.45, st.pitch - 1.6 * dt);
    cam.rotation.y = st.yaw; cam.rotation.x = st.pitch;
  };
  st.dispose = () => { document.removeEventListener('mousemove', onMove); removeEventListener('keydown', kd); removeEventListener('keyup', ku); if (document.pointerLockElement) document.exitPointerLock(); };
  return st;
}

/* a procedural rifle / pistol held by the camera: matte polymer, machined metal, one lime accent */
export function gun(cam, { color = '#d7ff3c', kind = 'rifle' } = {}) {
  const g = new THREE.Group();
  const poly = new THREE.MeshStandardMaterial({ color: '#25282e', roughness: .78, metalness: .05 });
  const metal = new THREE.MeshStandardMaterial({ color: '#3b3f47', roughness: .32, metalness: .9 });
  const dark = new THREE.MeshStandardMaterial({ color: '#141518', roughness: .5, metalness: .6 });
  const paint = new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .1, emissive: color, emissiveIntensity: .08 });
  const box = (w, h, d, m, x, y, z, rx = 0) => { const b = new THREE.Mesh(Math.min(w, h, d) > .03 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * .22) : new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; b.castShadow = false; g.add(b); return b; };
  const cyl = (r, l, m, x, y, z, seg = 16) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); g.add(c); return c; };
  if (kind === 'rifle') {
    box(.072, .085, .34, metal, 0, 0, -.2);                 // upper receiver
    box(.066, .06, .3, poly, 0, -.055, -.2);                // lower receiver
    box(.078, .078, .36, poly, 0, .002, -.53);              // handguard
    for (let i = 0; i < 7; i++) box(.082, .012, .022, dark, 0, .046, -.39 - i * .045);   // top rail teeth
    box(.02, .03, .3, dark, .042, 0, -.53); box(.02, .03, .3, dark, -.042, 0, -.53);    // side rails
    cyl(.016, .26, metal, 0, .006, -.83); cyl(.024, .06, dark, 0, .006, -.95);          // barrel + muzzle brake
    box(.052, .15, .07, poly, 0, -.15, -.24, .28);          // magazine
    box(.05, .13, .06, poly, 0, -.13, -.07, -.32);          // grip
    box(.06, .07, .2, poly, 0, -.02, .04);                  // stock
    box(.074, .008, .06, paint, 0, .047, -.1);              // lime accent
    box(.05, .05, .1, dark, 0, .09, -.22);                  // optic body
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.019, 20), new THREE.MeshBasicMaterial({ color: '#ff5b2e', toneMapped: false })); lens.position.set(0, .095, -.271); lens.rotation.y = Math.PI; g.add(lens);
  } else {
    box(.058, .07, .24, metal, 0, .01, -.13); box(.054, .05, .22, poly, 0, -.04, -.12); box(.05, .13, .065, poly, 0, -.11, -.03, -.22);
    box(.06, .012, .08, paint, 0, .05, -.06); cyl(.013, .04, dark, 0, .01, -.265);
  }
  g.scale.setScalar(.56); cam.add(g);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(.18, .18), new THREE.MeshBasicMaterial({ map: flashTex(), color: '#ffd9a0', transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  flash.position.set(0, .006, kind === 'rifle' ? -1.0 : -.3); flash.visible = false; g.add(flash);
  const light = new THREE.PointLight('#ffc77a', 0, 7); light.position.copy(flash.position); g.add(light);
  const muzzle = new THREE.Object3D(); muzzle.position.copy(flash.position); g.add(muzzle);
  let kick = 0, bob = 0;
  return {
    group: g, muzzle,
    fire() { kick = 1; flash.visible = true; flash.rotation.z = Math.random() * 6; flash.scale.setScalar(.8 + Math.random() * .6); light.intensity = 6; setTimeout(() => { flash.visible = false; light.intensity = 0; }, 40); },
    update(dt, moving, reloading) {
      kick = Math.max(0, kick - dt * 9); bob += dt * (moving ? 9 : 2);
      g.position.set(.2 + Math.sin(bob) * (moving ? .01 : .003), -.2 + Math.abs(Math.cos(bob)) * (moving ? .012 : .003) - (reloading ? .1 : 0), -.34 + kick * .04);
      g.rotation.x = kick * .08 + (reloading ? -.5 : 0); g.rotation.z = reloading ? .4 : 0;
    }
  };
}
function flashTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,220,150,.9)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); x.fillStyle = gr;
  x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 22 : 64; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.fill();
  return new THREE.CanvasTexture(c);
}

/* ---------- daylight world kit: clean, readable, competitive ---------- */
export function daySky(scene, { top = '#5d86b0', horizon = '#d9d6cd', ground = '#a9a296', fog = [40, 140] } = {}) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(.46, horizon); gr.addColorStop(.5, horizon); gr.addColorStop(1, ground); x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false })));
  scene.background = new THREE.Color(horizon); scene.fog = new THREE.Fog(horizon, fog[0], fog[1]);
}
export function daylight(scene, { extent = 36, at = [24, 40, 14] } = {}) {
  scene.add(new THREE.HemisphereLight('#dfe8f4', '#7d7466', .95));
  const sun = new THREE.DirectionalLight('#ffeacc', 2.4); sun.position.set(...at); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 120 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  scene.add(sun); scene.environmentIntensity = .45; return sun;
}
/* poured-concrete floor: speckle, soft stains and saw-cut joints */
export function concreteTex(repeat = 8, { base = '#a39e94', joint = 'rgba(70,64,56,.35)' } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) { const gx = Math.random() * 512, gy = Math.random() * 512, r = 40 + Math.random() * 120, g = x.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, `rgba(${Math.random() < .5 ? '90,84,76' : '235,231,222'},.12)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); }
  for (let i = 0; i < 9000; i++) { const v = Math.random() < .5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${Math.random() * .07})`; x.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5); }
  x.strokeStyle = joint; x.lineWidth = 2; x.strokeRect(1, 1, 510, 510); x.beginPath(); x.moveTo(256, 0); x.lineTo(256, 512); x.moveTo(0, 256); x.lineTo(512, 256); x.lineWidth = 1; x.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/* a box with baked ambient occlusion (darker toward the ground) and a crisp dark cap line */
export function block(w, h, d, color, { rough = .85, metal = 0, cap = true } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d, 1, Math.max(1, Math.round(h * 2)), 1), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(color);
  for (let i = 0; i < pos.count; i++) { const k = .62 + .38 * Math.min(1, (pos.getY(i) + h / 2) / Math.min(h, 2.2)); col.set([c.r * k, c.g * k, c.b * k], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal })); m.castShadow = m.receiveShadow = true;
  if (cap) { const k = new THREE.Mesh(new THREE.BoxGeometry(w + .04, .06, d + .04), new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(.8), roughness: .7, metalness: metal })); k.position.y = h / 2; k.castShadow = true; m.add(k); }
  return m;
}
/* painted lettering on a wall (a flat plane, not a billboard) */
export function wallText(text, { color = '#1d1f23', w = 1024, h = 160, size = 92, width = 12 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color; x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width * h / w), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .9 }));
}

/* tracers and sparks */
export function fx(scene) {
  const items = [];
  const tracerMat = c => new THREE.LineBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3), transparent: true, opacity: 1, toneMapped: false });
  return {
    tracer(a, b, color = '#ffe2a8') { const geo = new THREE.BufferGeometry().setFromPoints([a, b]), l = new THREE.Line(geo, tracerMat(color)); scene.add(l); items.push({ o: l, life: .07, max: .07 }); },
    sparks(at, color = '#ffd27a', n = 10) {
      const pos = new Float32Array(n * 3), vel = []; for (let i = 0; i < n; i++) { pos.set([at.x, at.y, at.z], i * 3); vel.push(new THREE.Vector3((Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 4)); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(color).multiplyScalar(3), size: .06, transparent: true, toneMapped: false })); scene.add(p); items.push({ o: p, life: .35, max: .35, vel });
    },
    update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; it.life -= dt; it.o.material.opacity = Math.max(0, it.life / it.max);
        if (it.vel) { const a = it.o.geometry.attributes.position; it.vel.forEach((v, k) => { v.y -= 9 * dt; a.setXYZ(k, a.getX(k) + v.x * dt, a.getY(k) + v.y * dt, a.getZ(k) + v.z * dt); }); a.needsUpdate = true; }
        if (it.life <= 0) { scene.remove(it.o); it.o.geometry.dispose(); it.o.material.dispose(); items.splice(i, 1); }
      }
    }
  };
}

/* DOM overlay: crosshair + hitmarker */
export function crosshair(stage) {
  const c = document.createElement('div'); c.className = 'xhair';
  c.innerHTML = `<div style="position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none;z-index:4">
    <i style="position:absolute;left:10px;top:0;width:2px;height:7px;background:#fff;box-shadow:0 0 4px #000"></i><i style="position:absolute;left:10px;bottom:0;width:2px;height:7px;background:#fff;box-shadow:0 0 4px #000"></i>
    <i style="position:absolute;top:10px;left:0;height:2px;width:7px;background:#fff;box-shadow:0 0 4px #000"></i><i style="position:absolute;top:10px;right:0;height:2px;width:7px;background:#fff;box-shadow:0 0 4px #000"></i></div>
    <div id="hitm" style="position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;pointer-events:none;z-index:4;opacity:0;transition:opacity .15s">
    <svg viewBox="0 0 30 30" width="30" height="30"><path d="M4 4l7 7M26 4l-7 7M4 26l7-7M26 26l-7-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg></div>`;
  stage.appendChild(c);
  const hm = c.querySelector('#hitm');
  return { hit(head) { hm.style.opacity = '1'; hm.querySelector('path').setAttribute('stroke', head ? '#ff4d6d' : '#fff'); clearTimeout(hm._t); hm._t = setTimeout(() => { hm.style.opacity = '0'; }, 140); } };
}

/* tiny synthesized sounds */
let ac = null;
export function sfx(kind) {
  try {
    ac = ac || new AudioContext(); const t = ac.currentTime;
    if (kind === 'shot' || kind === 'pistol') {
      const len = .12, buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = buf; f.type = 'lowpass'; f.frequency.value = kind === 'pistol' ? 2600 : 1800; g.gain.value = .16;
      s.connect(f).connect(g).connect(ac.destination); s.start(t);
    } else {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = kind === 'kill' ? 'square' : 'sine';
      o.frequency.setValueAtTime(kind === 'kill' ? 880 : kind === 'hurt' ? 140 : 1250, t); if (kind === 'kill') o.frequency.setValueAtTime(1320, t + .07);
      g.gain.setValueAtTime(kind === 'hurt' ? .12 : .06, t); g.gain.exponentialRampToValueAtTime(.0001, t + (kind === 'kill' ? .2 : .09)); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .25);
    }
  } catch (e) { /* audio blocked */ }
}

/* neon text on a canvas texture (signs, name tags) */
export function textSprite(text, { color = '#ffffff', size = 64, glow = 'rgba(0,0,0,.85)', w = 512, h = 128, blur = 10 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = glow; x.shadowBlur = blur; x.fillStyle = color; x.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(w / h * .5, .5, 1);
  return s;
}
