/* CPS Duel (3D): 10 seconds, highest clicks-per-second wins.
   Every player stands on a pedestal with their own showcase mouse; each click presses its
   left button and pumps energy into the tube behind it. 1v1 vs a bot, or 2–8 players in a lobby. */
import { onPress, countdown, results, sleep, hud, pill, esc, nameTag } from './common.js';
import { studio, pedestal, THREE, pressMouse, PLAYER_COLORS, LIME } from './stage3d.js';

const FULL = 140;   // clicks that fill a tube

export function buildSet(st, players, meId) {
  const n = players.length, gap = 3.6, x0 = -(n - 1) * gap / 2, lanes = {};
  players.forEach((p, i) => {
    const col = p.user_id === meId ? LIME : PLAYER_COLORS[1 + (i % (PLAYER_COLORS.length - 1))], x = x0 + i * gap;
    const ped = pedestal(st, p, col); ped.g.position.set(x, 0, 0);
    const tube = new THREE.Group(); tube.position.set(x, 0, -1.9); st.scene.add(tube);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 5, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: '#8fa6bd', transparent: true, opacity: .07, roughness: .05, metalness: 0, envMapIntensity: .4, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.y = 2.75; tube.add(glass);
    const capMat = new THREE.MeshStandardMaterial({ color: '#1b1e24', metalness: .85, roughness: .3 });
    [[.25, 0], [5.3, 1]].forEach(([y]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .26, 40), capMat); c.position.y = y; c.castShadow = true; tube.add(c); });
    const fillMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, roughness: .3, transparent: true, opacity: .92 });
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, 1, 32), fillMat); fill.position.y = .38; fill.scale.y = .001; tube.add(fill);
    for (let k = 1; k <= 4; k++) { const tick = new THREE.Mesh(new THREE.TorusGeometry(.44, .012, 6, 40), new THREE.MeshBasicMaterial({ color: '#3a3f48' })); tick.rotation.x = Math.PI / 2; tick.position.y = .38 + k * 1; tube.add(tick); }
    const light = new THREE.PointLight(col, 0, 6, 2); light.position.set(0, 1, .6); tube.add(light);
    lanes[p.user_id] = { p, ped, fill, light, x, shown: 0 };
  });
  return lanes;
}

export async function start(stage, ctx) {
  let running = false;   // declared first: progress from other players can arrive before we start
  const DUR = 10000, counts = Object.fromEntries(ctx.all.map(p => [p.user_id, 0])), final = {};
  const st = studio(stage, { fov: 38 }), me = ctx.me.user_id, lanes = buildSet(st, ctx.all, me);
  const span = (ctx.all.length - 1) * 3.6, myX = lanes[me].x;
  st.setCam([myX * .3, 4.4, 11.5 + span * .45], [myX * .15, 2.7, -1]);
  const tags = {};
  Object.values(lanes).forEach(L => { const T = tags[L.p.user_id] = st.label('', L.p.user_id === me ? 'me' : ''); T.pos.set(L.x, 5.9, -1.9); });
  const paintTags = () => Object.values(lanes).forEach(L => tags[L.p.user_id].set(`<b>${counts[L.p.user_id] || 0}</b>${nameTag(L.p)}${L.p.bot ? '<small>bot</small>' : ''}`));
  paintTags();
  st.onFrame((dt, t) => {
    Object.values(lanes).forEach(L => {
      const target = Math.min(1, (counts[L.p.user_id] || 0) / FULL) * 4.8; L.shown += (target - L.shown) * Math.min(1, dt * 10);
      L.fill.scale.y = Math.max(.001, L.shown); L.fill.position.y = .38 + L.shown / 2; L.light.position.y = .4 + L.shown; L.light.intensity = 2 + L.shown;
      L.ped.tick(dt, t);
    });
  });
  st.start();
  const info = () => hud(stage, `<div class="hud-row">${pill('Your clicks', counts[me] || 0, '', 'big')}${pill('CPS', running ? ((counts[me] || 0) / Math.max(.25, (performance.now() - t0) / 1000)).toFixed(1) : '—')}</div>${pill('Time', running ? Math.max(0, (DUR - (performance.now() - t0)) / 1000).toFixed(2) : '10.00', '', 'hot')}`);
  let t0 = 0; info();
  const msg = document.createElement('div'); msg.className = 'hud-msg'; msg.innerHTML = 'Left click as fast as you can<small>The timer starts after the countdown</small>'; stage.appendChild(msg);
  ctx.listen('p', d => { Object.assign(counts, d.c); });
  ctx.listen('done', d => { Object.assign(final, d.f); });
  await ctx.sync('go');
  await countdown(stage);
  msg.remove(); running = true; t0 = performance.now(); let mine = 0, lastClick = 0;
  onPress(stage, (t, b) => {
    if (!running || b !== 0 || t - t0 > DUR) return;
    mine++; counts[me] = mine;
    const L = lanes[me]; pressMouse(L.ped.mouse, 0); L.ped.flash(.6);
    if (mine % 3 === 0) st.burst(new THREE.Vector3(L.x, .6 + L.shown, -1.9), LIME, 8, 2.4);
    if (t - lastClick < 70) st.shake(.05); lastClick = t;
  });
  const botRate = Object.fromEntries(ctx.bots.map(b => [b.user_id, (7.2 + ctx.rand() * 3.4) * b.skill])), prevBot = {};
  const tick = setInterval(() => {
    const el = performance.now() - t0, c = { [me]: mine };
    if (ctx.isHost) ctx.bots.forEach(b => { counts[b.user_id] = Math.floor(botRate[b.user_id] * Math.min(el, DUR) / 1000 * (.92 + .08 * Math.sin(el / 700 + b.user_id.length))); c[b.user_id] = counts[b.user_id]; });
    ctx.emit('p', { c });
    Object.values(lanes).forEach(L => { const id = L.p.user_id; if (id !== me && (counts[id] || 0) > (prevBot[id] || 0)) { pressMouse(L.ped.mouse, 0); L.ped.flash(.4); prevBot[id] = counts[id]; } });
    paintTags(); info();
  }, 100);
  await sleep(DUR);
  running = false; clearInterval(tick);
  const f = { [me]: mine / (DUR / 1000) };
  if (ctx.isHost) ctx.bots.forEach(b => { f[b.user_id] = Math.round(botRate[b.user_id] * 100) / 100; });
  ctx.emit('done', { f });
  for (let i = 0; i < 20 && ctx.all.some(p => final[p.user_id] == null); i++) await sleep(150);
  const standings = ctx.all.map(p => ({ ...p, score: Math.round((final[p.user_id] ?? (counts[p.user_id] || 0) / 10) * 100) / 100 })).sort((a, b) => b.score - a.score).map(s => ({ ...s, label: s.score.toFixed(2) + ' CPS' }));
  const winner = lanes[standings[0].user_id]; winner.ped.flash(2); st.burst(new THREE.Vector3(winner.x, 5.4, -1.9), '#ffffff', 40, 4);
  await sleep(700);
  const rank = standings.findIndex(s => s.user_id === me) + 1, my = f[me];
  results(stage, ctx, { score: Math.round(my * 100) / 100, unit: 'CPS', won: rank === 1 && standings.length > 1, title: rank === 1 ? 'You win' : `#${rank} of ${standings.length}`, sub: `${mine} clicks in 10 seconds.`, standings });
}
