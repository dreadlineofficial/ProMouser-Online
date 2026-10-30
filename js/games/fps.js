/* =====================================================================
   ProMouser Online: shared 3D FPS engine (Neon Arena, Shooting Gallery)
   Renderer + bloom, mouse-look, a procedural gun with recoil and muzzle
   flash, tracers, sparks, crosshair/hitmarkers and synthesized sound.
   ===================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
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

/* a procedural rifle / pistol held by the camera */
export function gun(cam, { color = '#22d3ee', kind = 'rifle' } = {}) {
  const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: '#1a1b22', roughness: .45, metalness: .7 }), mid = new THREE.MeshStandardMaterial({ color: '#2c2f3a', roughness: .35, metalness: .8 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.4), toneMapped: false });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  if (kind === 'rifle') {
    box(.07, .09, .5, dark, 0, 0, -.25); box(.06, .06, .32, mid, 0, .07, -.2); box(.045, .14, .07, dark, 0, -.1, -.08); box(.05, .12, .09, mid, 0, -.09, -.3);
    box(.075, .02, .44, glow, 0, .046, -.25); box(.012, .012, .3, glow, .037, 0, -.28);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .28, 12), mid); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .01, -.62); g.add(barrel);
    box(.03, .035, .05, glow, 0, .11, -.12);
  } else {
    box(.06, .08, .26, dark, 0, 0, -.14); box(.05, .14, .07, mid, 0, -.1, -.05); box(.062, .015, .24, glow, 0, .045, -.14);
  }
  g.scale.setScalar(.85); g.position.set(.24, -.23, -.4); cam.add(g);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 8), new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false }));
  flash.position.set(0, .01, kind === 'rifle' ? -.78 : -.3); flash.visible = false; g.add(flash);
  const light = new THREE.PointLight(color, 0, 6); light.position.copy(flash.position); g.add(light);
  const muzzle = new THREE.Object3D(); muzzle.position.copy(flash.position); g.add(muzzle);
  let kick = 0, bob = 0;
  return {
    group: g, muzzle,
    fire() { kick = 1; flash.visible = true; flash.scale.setScalar(.8 + Math.random() * .7); light.intensity = 9; setTimeout(() => { flash.visible = false; light.intensity = 0; }, 45); },
    update(dt, moving, reloading) {
      kick = Math.max(0, kick - dt * 9); bob += dt * (moving ? 9 : 2);
      g.position.set(.24 + Math.sin(bob) * (moving ? .012 : .003), -.23 + Math.abs(Math.cos(bob)) * (moving ? .014 : .003) - (reloading ? .12 : 0), -.4 + kick * .06);
      g.rotation.x = kick * .12 + (reloading ? -.5 : 0); g.rotation.z = reloading ? .4 : 0;
    }
  };
}

/* tracers and sparks */
export function fx(scene) {
  const items = [];
  const tracerMat = c => new THREE.LineBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3), transparent: true, opacity: 1, toneMapped: false });
  return {
    tracer(a, b, color = '#ffe08a') { const geo = new THREE.BufferGeometry().setFromPoints([a, b]), l = new THREE.Line(geo, tracerMat(color)); scene.add(l); items.push({ o: l, life: .07, max: .07 }); },
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
  const c = document.createElement('div');
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
export function textSprite(text, { color = '#ffffff', size = 64, glow = '#a855f7', w = 512, h = 128 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.font = `800 ${size}px "DM Sans", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = glow; x.shadowBlur = 18; x.fillStyle = color; x.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(w / h * .5, .5, 1);
  return s;
}
