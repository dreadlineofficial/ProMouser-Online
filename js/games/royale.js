/* Click Royale (3D): players stand in a ring. Each 5-second round, light pillars rise with your
   clicks; the slowest player's platform drops into the void. Last one standing wins. */
import { onPress, results, sleep, hud, pill, nameTag } from './common.js';
import { studio, pedestal, THREE, pressMouse, PLAYER_COLORS, LIME, HOT } from './stage3d.js';

export function buildSet(st, players, meId) {
  const n = players.length, R = Math.max(5, n * 1.15), lanes = {};
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R + 2.2, R + 2.4, .3, 64), new THREE.MeshStandardMaterial({ color: '#16191e', metalness: .6, roughness: .45 })); disc.position.y = -.16; disc.receiveShadow = true; st.scene.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 2.3, .04, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(LIME).multiplyScalar(1.6), toneMapped: false })); rim.rotation.x = Math.PI / 2; st.scene.add(rim);
  const holo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, .1, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(LIME).multiplyScalar(.25), toneMapped: false })); holo.position.y = .05; st.scene.add(holo);
  players.forEach((p, i) => {
    const a = i / n * Math.PI * 2, x = Math.sin(a) * R, z = Math.cos(a) * R, c = p.user_id === meId ? LIME : PLAYER_COLORS[1 + (i % (PLAYER_COLORS.length - 1))];
    const ped = pedestal(st, p, c, { scale: .85 }); ped.g.position.set(x, 0, z); ped.g.lookAt(0, 0, 0); ped.g.rotateY(Math.PI);
    const pm = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8), transparent: true, opacity: .8, toneMapped: false });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, 1, 6), pm); pillar.position.set(x * .78, 0, z * .78); pillar.scale.y = .001; st.scene.add(pillar);
    lanes[p.user_id] = { p, ped, pillar, x, z, a, shown: 0, fall: 0, out: false };
  });
  return { lanes, holo, R };
}

export async function start(stage, ctx) {
  const RD = 5000, me = ctx.me.user_id, alive = new Set(ctx.all.map(p => p.user_id)), outRound = {};
  const st = studio(stage, { fov: 42 }), S = buildSet(st, ctx.all, me), L = S.lanes;
  let round = 0, counts = {}, running = false, mine = 0, t0 = 0, orbit = L[me].a;
  const tags = {}; Object.values(L).forEach(l => { tags[l.p.user_id] = st.label('', l.p.user_id === me ? 'me' : ''); });
  const paint = () => Object.values(L).forEach(l => { const T = tags[l.p.user_id]; T.el.classList.toggle('out', l.out); T.set(`<b>${l.out ? 'OUT' : counts[l.p.user_id] || 0}</b>${nameTag(l.p)}`); });
  paint();
  st.onFrame((dt, t) => {
    // the camera drifts around the ring, staying behind you
    orbit += (L[me].a - orbit) * Math.min(1, dt * .8) + dt * .03; const d = S.R + 11;
    st.setCam([Math.sin(orbit) * d, 10, Math.cos(orbit) * d], [0, 1.4, 0]);
    S.holo.rotation.y += dt * .4;
    Object.values(L).forEach(l => {
      const target = Math.min(8, (counts[l.p.user_id] || 0) * .16); l.shown += (target - l.shown) * Math.min(1, dt * 10);
      l.pillar.scale.y = Math.max(.001, l.shown); l.pillar.position.y = l.shown / 2;
      if (l.out) { l.fall += dt; l.ped.g.position.y = -l.fall * l.fall * 9; l.ped.g.rotation.z = l.fall * .6; l.pillar.visible = false; }
      tags[l.p.user_id].pos.set(l.x, l.ped.g.position.y + 2.2, l.z);
      l.ped.tick(dt, t);
    });
  });
  st.start();
  const msg = document.createElement('div'); msg.className = 'hud-msg top'; stage.appendChild(msg);
  const say = (b, s = '') => { msg.innerHTML = b + (s ? `<small>${s}</small>` : ''); };
  const info = el => hud(stage, `<div class="hud-row">${pill('Round', round || 1)}${pill('Alive', alive.size)}${pill('Clicks', mine, '', 'big')}</div>${pill('Time', running ? (Math.max(0, RD - el) / 1000).toFixed(2) : '5.00', '', 'hot')}`);
  info(0); say('Click to survive', 'The slowest clicker each round is knocked out');
  onPress(stage, (t, b) => { if (!running || b !== 0 || !alive.has(me) || t - t0 > RD) return; mine++; counts[me] = mine; pressMouse(L[me].ped.mouse, 0); L[me].ped.flash(.5); if (mine % 4 === 0) st.burst(new THREE.Vector3(L[me].x * .78, L[me].shown, L[me].z * .78), LIME, 6, 2); });
  ctx.listen('p', d => { if (d.r === round) Object.assign(counts, d.c); });
  ctx.listen('rs', async d => {
    round = d.r; counts = {}; mine = 0; const in_ = alive.has(me);
    say(in_ ? '3' : 'Spectating', in_ ? `Round ${round}: the slowest is out` : 'You’re out. Watch the rest!');
    for (let i = 2; i > 0 && in_; i--) { await sleep(700); say(String(i), `Round ${round}`); }
    await sleep(700); running = true; t0 = performance.now(); if (in_) say('CLICK!');
    const rate = Object.fromEntries(ctx.bots.map(b => [b.user_id, (6.5 + ctx.rand() * 3.5 + round * .25) * b.skill])), prev = {};
    const tick = setInterval(() => {
      const el = Math.min(RD, performance.now() - t0), c = {};
      if (alive.has(me)) c[me] = mine;
      if (ctx.isHost) ctx.bots.forEach(b => { if (alive.has(b.user_id)) c[b.user_id] = Math.floor(rate[b.user_id] * el / 1000); });
      ctx.emit('p', { r: round, c }); paint(); info(el);
      Object.values(L).forEach(l => { const id = l.p.user_id; if (id !== me && (counts[id] || 0) > (prev[id] || 0)) { pressMouse(l.ped.mouse, 0); prev[id] = counts[id]; } });
    }, 120);
    await sleep(RD); running = false; clearInterval(tick); info(RD);
    const c = {}; if (alive.has(me)) c[me] = mine; if (ctx.isHost) ctx.bots.forEach(b => { if (alive.has(b.user_id)) c[b.user_id] = Math.floor(rate[b.user_id] * RD / 1000); });
    ctx.emit('p', { r: round, c }); say('Time!', 'Counting…');
  });
  ctx.listen('out', d => {
    alive.delete(d.id); outRound[d.id] = d.r; const l = L[d.id]; if (l) { l.out = true; st.shake(.18); st.burst(new THREE.Vector3(l.x, 1, l.z), HOT, 30, 4); }
    const who = ctx.all.find(p => p.user_id === d.id); paint(); info(RD);
    say(d.id === me ? 'Knocked out!' : `${who ? who.display_name : 'Someone'} is out`, `${d.n} clicks was the lowest`);
  });
  const finP = new Promise(res => ctx.listen('fin', res));
  await ctx.sync('go');
  if (ctx.isHost) {
    for (let r = 1; alive.size > 1 && r <= 12; r++) {
      ctx.emit('rs', { r }); await sleep(2100 + RD + 900);
      const live = [...alive].map(id => [id, counts[id] ?? 0]).sort((a, b) => a[1] - b[1] || ctx.rand() - .5);
      ctx.emit('out', { id: live[0][0], n: live[0][1], r }); await sleep(2000);
    }
    ctx.emit('fin', { winner: [...alive][0], outRound });
  }
  const fin = await finP;
  const total = Math.max(...Object.values(fin.outRound), 0), survived = id => id === fin.winner ? total : (fin.outRound[id] || 1) - 1;
  const standings = ctx.all.map(p => ({ ...p, score: survived(p.user_id), out: p.user_id !== fin.winner })).sort((a, b) => b.score - a.score).map(s => ({ ...s, label: s.out ? `out in round ${s.score + 1}` : 'Winner' }));
  const won = fin.winner === me; if (L[fin.winner]) { L[fin.winner].ped.flash(3); st.burst(new THREE.Vector3(L[fin.winner].x, 2, L[fin.winner].z), '#ffffff', 50, 5); }
  await sleep(800);
  results(stage, ctx, { score: survived(me), unit: 'rounds', won, title: won ? 'Last one standing' : 'Knocked out', sub: `${ctx.all.length} players started.`, standings });
}
