/* Orb Tracking (3D): keep your reticle on a glowing orb as it weaves through a tunnel for 30 s.
   Score = % of time on target. Same orb path for everyone in a lobby. */
import { countdown, results, sleep, hud, pill, avatar } from './common.js';
import { studio, THREE, LIME, HOT } from './stage3d.js';

export function buildSet(st) {
  const rings = [];
  for (let i = 0; i < 18; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(7.5, .07, 6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 3 ? '#2a2f38' : LIME).multiplyScalar(i % 3 ? 1 : 1.3), toneMapped: false }));
    r.rotation.z = Math.PI / 6; r.position.set(0, 4, -i * 4); st.scene.add(r); rings.push(r);
  }
  const orb = new THREE.Group(); st.scene.add(orb);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.55, 32, 24), new THREE.MeshStandardMaterial({ color: '#fff', emissive: LIME, emissiveIntensity: 1.6, roughness: .2 })); orb.add(core);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(.85, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(LIME).multiplyScalar(1.4), wireframe: true, toneMapped: false })); orb.add(shell);
  const light = new THREE.PointLight(LIME, 14, 14, 1.8); orb.add(light);
  const hitbox = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); orb.add(hitbox);
  return { rings, orb, core, shell, light, hitbox };
}

export async function start(stage, ctx) {
  const DUR = 30000, live = {}, me = ctx.me.user_id;
  const st = studio(stage, { fov: 55, fog: [10, 70], bg: '#090a0c' }), S = buildSet(st);
  st.setCam([0, 4, 9], [0, 4, -10]); st.floor.visible = false;
  const r = ctx.rand, ph = Array.from({ length: 6 }, () => r() * 6.28), sp = Array.from({ length: 6 }, () => .25 + r() * .55);
  const path = t => { const s = t / 1000, dash = Math.sin(s * 1.7 + ph[5]) > .9 ? 1.8 : 1; return new THREE.Vector3(5.2 * Math.sin(s * sp[0] * dash + ph[0]) + 1.2 * Math.sin(s * sp[1] * 3 + ph[1]), 4 + 2.8 * Math.cos(s * sp[2] * dash + ph[2]) + .8 * Math.sin(s * sp[3] * 2.4 + ph[3]), -6 + 3 * Math.sin(s * sp[4] + ph[4])); };
  stage.style.cursor = 'none';
  const ret = document.createElement('div'); ret.className = 'reticle'; stage.appendChild(ret);
  let lastE = null; stage.addEventListener('pointermove', e => { lastE = e; const b = stage.getBoundingClientRect(); ret.style.left = (e.clientX - b.left) + 'px'; ret.style.top = (e.clientY - b.top) + 'px'; });
  stage.addEventListener('contextmenu', e => e.preventDefault());
  // a beam from the bottom of the screen to the orb while you're on it
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(HOT).multiplyScalar(2.5), toneMapped: false, transparent: true })); st.scene.add(beam); beam.visible = false;
  const others = ctx.players.filter(p => p.user_id !== me);
  ctx.listen('s', d => { live[d.id] = d.s; });
  let on = 0, total = 0, t0 = 0, running = false, pct = 0;
  const draw = left => hud(stage, `<div class="hud-row">${pill('On target', pct + '%', '', 'big')}${others.map(p => `<span class="hud-box"><span>${avatar(p, 14)} ${p.display_name}</span><b>${live[p.user_id] ?? 0}%</b></span>`).join('')}</div>${pill('Time', (left / 1000).toFixed(1), '', 'hot')}`);
  st.onFrame((dt, t) => {
    S.rings.forEach(rg => { rg.position.z += dt * 6; if (rg.position.z > 9) rg.position.z -= 72; });
    const now = performance.now(), p = path(running ? now - t0 : 0); S.orb.position.copy(p); S.shell.rotation.x += dt; S.shell.rotation.y += dt * 1.3;
    if (!running) return;
    const hit = lastE && st.pick(lastE, [S.hitbox]);
    total += dt; if (hit) on += dt;
    ret.classList.toggle('on', !!hit); S.core.material.emissive.set(hit ? HOT : LIME); S.light.color.set(hit ? HOT : LIME);
    beam.visible = !!hit; if (hit) { const a = new THREE.Vector3(0, -.5, 6), len = a.distanceTo(p); beam.scale.y = len; beam.position.copy(a).lerp(p, .5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(a).normalize()); }
    pct = Math.round(on / Math.max(.001, total) * 100); draw(Math.max(0, DUR - (now - t0)));
  });
  st.start(); draw(DUR);
  await ctx.sync('go');
  await countdown(stage);
  t0 = performance.now(); running = true;
  while (performance.now() - t0 < DUR) { ctx.emit('s', { id: me, s: pct }); await sleep(500); }
  running = false; beam.visible = false;
  const final = Math.round(on / Math.max(.001, total) * 1000) / 10;
  ctx.emit('s', { id: me, s: final }); live[me] = final; stage.style.cursor = ''; ret.remove();
  await sleep(ctx.mode === 'lobby' ? 1500 : 0);
  const standings = ctx.players.length > 1 ? ctx.players.map(p => ({ ...p, score: live[p.user_id] || 0 })).sort((a, b) => b.score - a.score).map(s => ({ ...s, label: s.score + '%' })) : null;
  const rank = standings ? standings.findIndex(s => s.user_id === me) + 1 : 1;
  results(stage, ctx, { score: final, unit: '% on target', won: !!standings && rank === 1, title: standings ? (rank === 1 ? 'You win' : `#${rank} of ${standings.length}`) : final >= 70 ? 'Locked on' : 'Nice tracking', standings });
}
