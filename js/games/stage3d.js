/* =====================================================================
   ProMouser Online: 3D stage toolkit for the non-shooter games.
   A studio set (reflective grid floor, key + rim light, soft shadows,
   adaptive quality), pedestals that carry each player's own showcase
   mouse, DOM labels pinned to 3D points, particle bursts, screen shake
   and pointer picking.
   ===================================================================== */
import { THREE, engine } from './fps.js';
import { buildMouse, animateMouse, pressMouse } from '../mouse3d.js';
import { ITEMS } from '../data.js';
export { THREE, buildMouse, animateMouse, pressMouse };

export const LIME = '#d7ff3c', HOT = '#ff5b2e', BLUE = '#5cb8ff';
export const PLAYER_COLORS = [LIME, HOT, BLUE, '#f472b6', '#f5c542', '#a78bfa', '#34d399', '#fb7185', '#22d3ee', '#e879f9', '#fde047', '#94a3b8'];
const MICE = ITEMS.filter(i => i.kind === 'mouse').map(i => i.id);
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const mouseIdFor = p => (p && p.showcase) || MICE[hash(p ? p.user_id : 'x') % MICE.length];

function gridTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; x.strokeRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1; for (let i = 64; i < 512; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(20, 20); t.anisotropy = 8; return t;
}

export function studio(stage, { fov = 40, bloom = .5, bg = '#0b0c0e', fog = [14, 42], floorTint = LIME } = {}) {
  const E = engine(stage, { fov, bloom }), { scene, cam } = E;
  scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, fog[0], fog[1]); scene.environmentIntensity = .55;
  scene.add(new THREE.HemisphereLight('#dfe6ff', '#14161a', .55));
  const key = new THREE.DirectionalLight('#fff3e2', 2.2); key.position.set(-6, 12, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 }); key.shadow.bias = -.0004; scene.add(key);
  const rim = new THREE.DirectionalLight('#c8d2ff', .7); rim.position.set(8, 6, -10); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#121418', roughness: .82, metalness: .15, emissive: floorTint, emissiveMap: gridTex(), emissiveIntensity: .07 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const fns = new Set(), labels = new Set(); let raf = 0, last = performance.now(), shakeAmt = 0, alive = true;
  const base = new THREE.Vector3(), baseLook = new THREE.Vector3();
  const st = {
    E, THREE, scene, cam, floor, key,
    setCam(pos, look) { base.set(...pos); baseLook.set(...look); cam.position.copy(base); cam.lookAt(baseLook); },
    onFrame(fn) { fns.add(fn); return () => fns.delete(fn); },
    shake(a = .12) { shakeAmt = Math.max(shakeAmt, a); },
    // DOM label pinned to a 3D point (crisper than text in 3D)
    label(html, cls = '') { const el = document.createElement('div'); el.className = 'tag3 ' + cls; el.innerHTML = html; stage.appendChild(el); const L = { el, pos: new THREE.Vector3(), set(h) { el.innerHTML = h; }, remove() { el.remove(); labels.delete(L); } }; labels.add(L); return L; },
    project(v) { const p = v.clone().project(cam), r = stage.getBoundingClientRect(); return [(p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height, p.z < 1]; },
    pick(e, objects) { const r = E.canvas.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam); return ray.intersectObjects(objects, true)[0] || null; },
    ray(e) { const r = E.canvas.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam); return ray; },
    burst(at, color = LIME, n = 18, speed = 3.2) {
      const pos = new Float32Array(n * 3), vel = []; for (let i = 0; i < n; i++) { pos.set([at.x, at.y, at.z], i * 3); vel.push(new THREE.Vector3((Math.random() - .5) * speed, Math.random() * speed, (Math.random() - .5) * speed)); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), size: .07, transparent: true, toneMapped: false, depthWrite: false })); scene.add(pts);
      let life = .55; const off = st.onFrame(dt => { life -= dt; pts.material.opacity = Math.max(0, life / .55); const a = g.attributes.position; vel.forEach((v, k) => { v.y -= 7 * dt; a.setXYZ(k, a.getX(k) + v.x * dt, a.getY(k) + v.y * dt, a.getZ(k) + v.z * dt); }); a.needsUpdate = true; if (life <= 0) { off(); scene.remove(pts); g.dispose(); pts.material.dispose(); } });
    },
    start() {
      const frame = now => {
        if (!alive) return; raf = requestAnimationFrame(frame);
        const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
        fns.forEach(f => f(dt, t));
        shakeAmt *= Math.pow(.02, dt);
        cam.position.copy(base).add(new THREE.Vector3((Math.random() - .5) * shakeAmt, (Math.random() - .5) * shakeAmt, 0)); cam.lookAt(baseLook);
        labels.forEach(L => { const [x, y, vis] = st.project(L.pos); L.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; L.el.style.visibility = vis ? '' : 'hidden'; });
        E.render();
      };
      raf = requestAnimationFrame(frame);
    },
    dispose() { alive = false; cancelAnimationFrame(raf); labels.forEach(L => L.el.remove()); setTimeout(() => E.dispose(), 30); }
  };
  return st;
}

/* a hexagonal pedestal with a light ring, carrying a player's mouse */
export function pedestal(st, player, color = LIME, { scale = 1 } = {}) {
  const g = new THREE.Group(), T = THREE;
  const metal = new T.MeshStandardMaterial({ color: '#1b1e24', roughness: .35, metalness: .85 });
  const base = new T.Mesh(new T.CylinderGeometry(1.25, 1.4, .5, 6), metal); base.position.y = .25; base.castShadow = base.receiveShadow = true; g.add(base);
  const top = new T.Mesh(new T.CylinderGeometry(1.12, 1.18, .08, 6), new T.MeshStandardMaterial({ color: '#0d0e11', roughness: .6, metalness: .3 })); top.position.y = .54; top.receiveShadow = true; g.add(top);
  const ringMat = new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(2), toneMapped: false });
  const ring = new T.Mesh(new T.TorusGeometry(1.32, .025, 6, 6), ringMat); ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 6; ring.position.y = .42; g.add(ring);
  const glow = new T.PointLight(color, 0, 4, 2); glow.position.set(0, 1.4, 1.2); g.add(glow);
  const m = buildMouse(mouseIdFor(player)); m.scale.setScalar(.62); m.position.y = .58; m.rotation.y = 0; g.add(m);
  g.scale.setScalar(scale); st.scene.add(g);
  return { g, mouse: m, ring, ringMat, glow, color: new T.Color(color),
    flash(k = 1) { glow.intensity = 6 * k; ringMat.color.copy(this.color).multiplyScalar(2 + 3 * k); },
    tick(dt, t) { glow.intensity *= Math.pow(.01, dt); ringMat.color.lerp(this.color.clone().multiplyScalar(2), Math.min(1, dt * 6)); animateMouse(m, t); } };
}
