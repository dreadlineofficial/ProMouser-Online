/* Aim Rush (3D): 30 seconds in a hangar. Drones appear at different depths and shrink as their timer
   runs out; hit them to shatter them. Faster hits and streaks score more, misses cost points.
   In a lobby everyone gets the same drones (shared seed) and sees live scores. */
import { onPress, countdown, results, sleep, hud, pill, avatar, nameTag } from './common.js';
import { studio, THREE, LIME, HOT } from './stage3d.js';

export function buildSet(st) {
  const hall = new THREE.Group(); st.scene.add(hall);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#16191e', roughness: .7, metalness: .3 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(34, 14, .5), wallMat); back.position.set(0, 7, -22); back.receiveShadow = true; hall.add(back);
  for (let i = -3; i <= 3; i++) {   // structural ribs with light strips
    const rib = new THREE.Mesh(new THREE.BoxGeometry(.5, 14, .9), new THREE.MeshStandardMaterial({ color: '#20242b', metalness: .7, roughness: .35 })); rib.position.set(i * 5, 7, -21.5); rib.castShadow = true; hall.add(rib);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.08, 11, .08), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? HOT : LIME).multiplyScalar(1.6), toneMapped: false })); strip.position.set(i * 5, 7, -21); hall.add(strip);
  }
  [-17, 17].forEach(x => { const w = new THREE.Mesh(new THREE.BoxGeometry(.5, 14, 30), wallMat); w.position.set(x, 7, -8); w.receiveShadow = true; hall.add(w); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2), new THREE.MeshBasicMaterial({ color: '#000' })); sign.position.set(0, 11.5, -21.7); hall.add(sign);
  return hall;
}
export function drone(color = LIME) {
  const g = new THREE.Group(), c = new THREE.Color(color);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 2), new THREE.MeshStandardMaterial({ color: '#202329', metalness: .7, roughness: .25, emissive: c, emissiveIntensity: .35 })); core.castShadow = true; g.add(core);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.2, 20, 16), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.6), toneMapped: false })); eye.position.z = .32; g.add(eye);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.66, .045, 8, 48), new THREE.MeshStandardMaterial({ color: '#2c3038', metalness: .9, roughness: .2 })); g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(.66, .02, 6, 48), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2), toneMapped: false })); ring2.rotation.y = Math.PI / 2; g.add(ring2);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.78, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);   // a fair hit area around the core
  g.userData = { ring, ring2, hit };
  return g;
}

export async function start(stage, ctx) {
  const DUR = 30000, LIFE = 1800, live = {}, me = ctx.me.user_id;
  const st = studio(stage, { fov: 52, fog: [18, 40] }); buildSet(st);
  st.setCam([0, 3.2, 8], [0, 3.4, -10]);
  stage.style.cursor = 'none';
  const ret = document.createElement('div'); ret.className = 'reticle'; stage.appendChild(ret);
  stage.addEventListener('pointermove', e => { const r = stage.getBoundingClientRect(); ret.style.left = (e.clientX - r.left) + 'px'; ret.style.top = (e.clientY - r.top) + 'px'; });
  const others = ctx.players.filter(p => p.user_id !== me);
  let score = 0, streak = 0, hits = 0, shots = 0, t0 = 0, done = false, running = false, drones = [];
  const draw = left => hud(stage, `<div class="hud-row">${pill('Score', score, '', 'big')}${pill('Streak', 'x' + (1 + Math.min(streak, 10) * .1).toFixed(1))}${others.map(p => `<span class="hud-box"><span>${avatar(p, 14)} ${p.display_name}</span><b>${live[p.user_id] || 0}</b></span>`).join('')}</div>${pill('Time', (left / 1000).toFixed(1), '', 'hot')}`);
  ctx.listen('s', d => { live[d.id] = d.s; });
  const spawn = () => {
    const r = ctx.rand, bonus = r() < .2, d = drone(bonus ? HOT : LIME), z = -4 - r() * 13, spread = 4 + (-z) * .45;
    d.position.set((r() - .5) * spread * 2, 1.2 + r() * (3 + (-z) * .25), z); d.userData.born = performance.now(); d.userData.spin = (r() - .5) * 4;
    d.userData.bonus = bonus;   // orange drones are worth more
    st.scene.add(d); drones.push(d);
  };
  st.onFrame((dt, t) => {
    const now = performance.now();
    drones.forEach(d => { const k = Math.max(.25, 1 - (now - d.userData.born) / LIFE * .75); d.scale.setScalar(k); d.userData.ring.rotation.x += dt * 2; d.userData.ring2.rotation.x += dt * 3; d.rotation.y = Math.sin(t + d.position.x) * .4; d.position.y += Math.sin(t * 2 + d.position.x) * dt * .2; });
    if (running) {
      drones.filter(d => now - d.userData.born > LIFE).forEach(d => { st.scene.remove(d); drones = drones.filter(x => x !== d); streak = 0; spawn(); });
      draw(Math.max(0, DUR - (now - t0)));
    }
  });
  st.start(); draw(DUR);
  await ctx.sync('go');
  await countdown(stage);
  t0 = performance.now(); running = true; for (let k = 0; k < 3; k++) spawn();
  onPress(stage, (t, b, e) => {
    if (!running || b !== 0) return; shots++;
    const hit = st.pick(e, drones.map(d => d.userData.hit)), now = performance.now();
    ret.classList.add('on'); setTimeout(() => ret.classList.remove('on'), 90);
    if (hit) {
      const d = drones.find(x => x.userData.hit === hit.object), speed = Math.max(0, 1 - (now - d.userData.born) / LIFE);
      hits++; streak++; const pts = Math.round((60 + 90 * speed) * (1 + Math.min(streak, 10) * .1) * (d.userData.bonus ? 1.5 : 1)); score += pts;
      st.burst(d.position.clone(), d.userData.bonus ? HOT : LIME, 26, 5); st.shake(.04);
      const tag = st.label(`<b>+${pts}</b>`, 'pop'); tag.pos.copy(d.position); setTimeout(() => tag.remove(), 700);
      st.scene.remove(d); drones = drones.filter(x => x !== d); spawn();
    } else { score = Math.max(0, score - 40); streak = 0; }
  });
  while (!done) { if (performance.now() - t0 >= DUR) done = true; else { ctx.emit('s', { id: me, s: score }); await sleep(400); } }
  running = false; drones.forEach(d => st.scene.remove(d)); drones = [];
  ctx.emit('s', { id: me, s: score }); live[me] = score; stage.style.cursor = ''; ret.remove();
  await sleep(ctx.mode === 'lobby' ? 1500 : 0);
  const standings = ctx.players.length > 1 ? ctx.players.map(p => ({ ...p, score: live[p.user_id] || 0 })).sort((a, b) => b.score - a.score) : null;
  const rank = standings ? standings.findIndex(s => s.user_id === me) + 1 : 1;
  results(stage, ctx, { score, unit: 'pts', won: !!standings && rank === 1, title: standings ? (rank === 1 ? 'You win' : `#${rank} of ${standings.length}`) : 'Time', sub: `${hits} hits · ${shots ? Math.round(hits / shots * 100) : 0}% accuracy`, standings });
}
