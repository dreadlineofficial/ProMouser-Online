/* Reaction Duel (3D): best of 5. Players stand in an arc facing a signal pylon. It glows red while
   you wait, then flashes green — the first click wins the round and fires a beam into the core.
   Clicking early sparks your pedestal and loses you the round. */
import { onPress, results, sleep, hud, pill, nameTag } from './common.js';
import { studio, pedestal, THREE, pressMouse, PLAYER_COLORS, LIME, HOT } from './stage3d.js';

export function buildSet(st, players, meId) {
  const n = players.length, lanes = {}, R = 6.2;
  // the pylon
  const pylon = new THREE.Group(); st.scene.add(pylon); pylon.position.set(0, 0, -3.5);
  const metal = new THREE.MeshStandardMaterial({ color: '#1b1e24', metalness: .85, roughness: .3 });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.35, .6, 4.2, 8), metal); col.position.y = 2.1; col.castShadow = true; pylon.add(col);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, .4, 8), metal); base.position.y = .2; base.receiveShadow = true; pylon.add(base);
  const coreMat = new THREE.MeshStandardMaterial({ color: '#2a2d33', emissive: '#555', emissiveIntensity: .4, roughness: .2, metalness: .2 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 3), coreMat); core.position.y = 5.3; pylon.add(core);
  const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), new THREE.MeshBasicMaterial({ color: '#3a3f48', wireframe: true })); cage.position.y = 5.3; pylon.add(cage);
  const light = new THREE.PointLight('#ffffff', 0, 26, 1.6); light.position.y = 5.3; pylon.add(light);
  const wave = new THREE.Mesh(new THREE.RingGeometry(.9, 1.05, 64), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false })); wave.rotation.x = -Math.PI / 2; wave.position.y = .05; pylon.add(wave);
  players.forEach((p, i) => {
    const a = n === 1 ? 0 : -0.55 + 1.1 * i / (n - 1), x = Math.sin(a) * R, z = -3.5 + Math.cos(a) * R;
    const c = p.user_id === meId ? LIME : PLAYER_COLORS[1 + (i % (PLAYER_COLORS.length - 1))];
    const ped = pedestal(st, p, c); ped.g.position.set(x, 0, z); ped.g.lookAt(0, 0, -3.5); ped.g.rotateY(Math.PI);
    lanes[p.user_id] = { p, ped, x, z, gems: [] };
  });
  return { lanes, pylon, core, coreMat, light, wave, cage };
}

export async function start(stage, ctx) {
  const ROUNDS = 5, me = ctx.me.user_id, wins = Object.fromEntries(ctx.all.map(p => [p.user_id, 0])), times = Object.fromEntries(ctx.all.map(p => [p.user_id, []]));
  const st = studio(stage, { fov: 40 }), S = buildSet(st, ctx.all, me), L = S.lanes;
  st.setCam([L[me].x * .4, 4.6, 12.8], [0, 2.4, -3.5]);
  const tags = {}; Object.values(L).forEach(l => { const T = tags[l.p.user_id] = st.label('', l.p.user_id === me ? 'me' : ''); T.pos.set(l.x, 2.3, l.z); });
  const paint = () => Object.values(L).forEach(l => tags[l.p.user_id].set(`${nameTag(l.p)}<small>${'★'.repeat(wins[l.p.user_id])}${'☆'.repeat(Math.max(0, 3 - wins[l.p.user_id]))}</small>`));
  paint();
  let state = 'idle', goAt = 0, hits = {}, round = 0, timer = 0, coreCol = new THREE.Color('#555'), waveT = 9;
  const msg = document.createElement('div'); msg.className = 'hud-msg'; stage.appendChild(msg);
  const say = (big, small = '') => { msg.innerHTML = big + (small ? `<small>${small}</small>` : ''); };
  const setCore = (c, k) => { coreCol.set(c); S.coreMat.emissiveIntensity = k; S.light.color.set(c); S.light.intensity = k * 4; };
  st.onFrame((dt, t) => {
    S.coreMat.emissive.lerp(coreCol, Math.min(1, dt * 12)); S.cage.rotation.y += dt * .3; S.core.rotation.y -= dt * .5;
    if (state === 'wait') S.coreMat.emissiveIntensity = 1.2 + .5 * Math.sin(t * 9);
    waveT += dt; S.wave.scale.setScalar(1 + waveT * 14); S.wave.material.opacity = Math.max(0, .8 - waveT * 1.4);
    Object.values(L).forEach(l => l.ped.tick(dt, t));
  });
  st.start();
  const info = () => hud(stage, `<div class="hud-row">${pill('Round', `${round}/${ROUNDS}`)}${pill('Rounds won', wins[me])}</div>${pill('Best', times[me].length ? Math.min(...times[me]) + ' ms' : '—', '', 'hot')}`);
  info(); say('Click when the core turns green', 'Clicking early loses the round');
  const beam = (from, colr) => {   // a beam from a pedestal into the core
    const a = new THREE.Vector3(from.x, 1.2, from.z), b = new THREE.Vector3(0, 5.3, -3.5), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, len, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(colr).multiplyScalar(3), toneMapped: false, transparent: true }));
    m.position.copy(a).lerp(b, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); st.scene.add(m);
    let life = .5; const off = st.onFrame(dt => { life -= dt; m.material.opacity = Math.max(0, life / .5); if (life <= 0) { off(); st.scene.remove(m); } });
  };
  const report = (id, ms, early) => { if (hits[id]) return; hits[id] = { ms, early }; ctx.emit('hit', { id, r: round, ms, early }); };
  ctx.listen('hit', d => {
    if (d.r !== round) return; if (!hits[d.id]) hits[d.id] = { ms: d.ms, early: d.early };
    const l = L[d.id]; if (!l) return; pressMouse(l.ped.mouse, 0);
    if (d.early) { l.ped.flash(1.5); st.burst(new THREE.Vector3(l.x, 1.1, l.z), HOT, 22, 3); } else beam(l, l.ped.color);
  });
  ctx.listen('round', d => {
    round = d.r; hits = {}; state = 'wait'; info(); setCore('#ff2d3c', 1.4); say('Wait…', 'Don’t click yet');
    clearTimeout(timer); timer = setTimeout(() => { state = 'go'; setCore('#3dff7a', 1.7); waveT = 0; st.shake(.08); say('CLICK!'); goAt = performance.now(); requestAnimationFrame(t => { if (state === 'go') goAt = Math.max(goAt, t); }); }, d.delay);
    if (ctx.isHost) ctx.bots.forEach(b => {
      const early = ctx.rand() < .04, ms = Math.round((260 + ctx.rand() * 90 - 40) / b.skill);
      setTimeout(() => report(b.user_id, early ? null : ms, early), early ? d.delay * ctx.rand() : d.delay + ms);
    });
  });
  ctx.listen('end', d => {
    state = 'shown'; clearTimeout(timer);
    if (d.winner && wins[d.winner] != null) { wins[d.winner]++; const l = L[d.winner]; l.ped.flash(2.5); st.burst(new THREE.Vector3(l.x, 1.6, l.z), '#ffffff', 30, 3.5); }
    Object.entries(d.hits).forEach(([id, h]) => { if (!h.early && h.ms != null && times[id]) times[id].push(h.ms); });
    setCore('#5a5f68', .4); paint(); info();
    const w = ctx.all.find(p => p.user_id === d.winner), mine = d.hits[me];
    say(mine ? (mine.early ? 'Too soon!' : mine.ms + ' ms') : 'Too slow', w ? `${w.user_id === me ? 'You take' : w.display_name + ' takes'} round ${d.r}` : 'Nobody scored');
  });
  onPress(stage, (t, b) => {
    if (b !== 0) return;
    if (state === 'wait') { report(me, null, true); say('Too soon!', 'You jumped the gun'); state = 'shown'; }
    else if (state === 'go') { const ms = Math.max(0, Math.round(t - goAt)); report(me, ms, false); say(ms + ' ms', 'Waiting for the others…'); state = 'shown'; }
  });
  const finP = new Promise(res => ctx.listen('final', res));
  await ctx.sync('go');
  if (ctx.isHost) {
    for (let r = 1; r <= ROUNDS; r++) {
      ctx.emit('round', { r, delay: 1400 + Math.floor(ctx.rand() * 2400) });
      const t0 = Date.now(); while (Date.now() - t0 < 9000 && ctx.all.some(p => !hits[p.user_id])) await sleep(60);
      const valid = Object.entries(hits).filter(([, h]) => !h.early && h.ms != null).sort((a, b) => a[1].ms - b[1].ms);
      ctx.emit('end', { r, winner: valid.length ? valid[0][0] : null, hits });
      await sleep(1900);
    }
    ctx.emit('final', {});
  }
  await finP; await sleep(200);
  const avg = id => times[id].length ? Math.round(times[id].reduce((a, b) => a + b, 0) / times[id].length) : 999;
  const standings = ctx.all.map(p => ({ ...p, score: wins[p.user_id], avg: avg(p.user_id) })).sort((a, b) => b.score - a.score || a.avg - b.avg).map(s => ({ ...s, label: `${s.score} won · ${s.avg === 999 ? '—' : s.avg + ' ms'}` }));
  const rank = standings.findIndex(s => s.user_id === me) + 1;
  results(stage, ctx, { score: avg(me), unit: 'ms avg', won: rank === 1 && standings.length > 1, title: rank === 1 ? 'You win' : `#${rank} of ${standings.length}`, sub: `You won ${wins[me]} of ${ROUNDS} rounds.`, standings });
}
