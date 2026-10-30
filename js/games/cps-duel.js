/* CPS Duel: 10 seconds, highest clicks-per-second wins. 1v1 vs a bot, or 2–8 players in a lobby. */
import { onPress, countdown, results, sleep, avatar, nameTag, esc } from './common.js';

export async function start(stage, ctx) {
  let running = false;   // declared first: progress from other players can arrive before we start
  const DUR = 10000, counts = Object.fromEntries(ctx.all.map(p => [p.user_id, 0])), final = {};
  stage.innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,1fr);gap:16px;padding:16px;min-height:inherit" class="cpsd">
    <button type="button" id="pad" style="position:relative;border-radius:22px;background:linear-gradient(135deg,var(--g1),var(--g2));display:grid;place-items:center;min-height:360px;cursor:pointer;box-shadow:0 30px 80px -30px var(--g1)">
      <div style="text-align:center;pointer-events:none"><div class="gbig" id="big">Get ready</div><div id="sub" style="font-weight:700;opacity:.9">Left click as fast as you can</div></div></button>
    <div class="panel" style="display:grid;gap:10px;align-content:start"><div class="row between"><h3>Live</h3><span class="pill" id="clock">10.00</span></div><div id="bars" style="display:grid;gap:10px"></div></div></div>`;
  if (innerWidth < 800) stage.firstElementChild.style.gridTemplateColumns = '1fr';
  const pad = stage.querySelector('#pad'), max = () => Math.max(20, ...Object.values(counts));
  const bars = () => { stage.querySelector('#bars').innerHTML = ctx.all.map(p => `<div><div class="row between small">${avatar(p, 26)}<span style="flex:1;min-width:0">${nameTag(p)}</span><b>${counts[p.user_id] || 0}</b></div>
    <div class="xpbar" style="height:10px"><i style="width:${(counts[p.user_id] || 0) / max() * 100}%;${p.user_id === ctx.me.user_id ? '' : 'background:rgba(255,255,255,.35)'}"></i></div></div>`).join(''); };
  bars();
  ctx.listen('p', d => { Object.assign(counts, d.c); if (!running) bars(); });
  ctx.listen('done', d => { Object.assign(final, d.f); });
  await ctx.sync('go');
  await countdown(stage);
  running = true; let t0 = performance.now(), mine = 0;
  stage.querySelector('#big').textContent = '0'; stage.querySelector('#sub').textContent = 'clicks';
  onPress(pad, (t, b) => { if (!running || b !== 0 || t - t0 > DUR) return; mine++; counts[ctx.me.user_id] = mine; stage.querySelector('#big').textContent = mine; pad.style.transform = 'scale(.985)'; setTimeout(() => { pad.style.transform = ''; }, 40); });
  // bots (run by the host): each has a target CPS with a little wobble
  const botRate = Object.fromEntries(ctx.bots.map(b => [b.user_id, (7.2 + ctx.rand() * 3.4) * b.skill]));
  const tick = setInterval(() => {
    const el = performance.now() - t0, c = { [ctx.me.user_id]: mine };
    if (ctx.isHost) ctx.bots.forEach(b => { counts[b.user_id] = Math.floor(botRate[b.user_id] * Math.min(el, DUR) / 1000 * (0.92 + 0.08 * Math.sin(el / 700 + b.user_id.length))); c[b.user_id] = counts[b.user_id]; });
    ctx.emit('p', { c }); bars();
    stage.querySelector('#clock').textContent = (Math.max(0, DUR - el) / 1000).toFixed(2);
  }, 150);
  await sleep(DUR);
  running = false; clearInterval(tick);
  const f = { [ctx.me.user_id]: mine / (DUR / 1000) };
  if (ctx.isHost) ctx.bots.forEach(b => { f[b.user_id] = Math.round(botRate[b.user_id] * 100) / 100; });
  ctx.emit('done', { f });
  for (let i = 0; i < 20 && ctx.all.some(p => final[p.user_id] == null); i++) await sleep(150);   // wait for everyone's final score
  const standings = ctx.all.map(p => ({ ...p, score: Math.round((final[p.user_id] ?? (counts[p.user_id] || 0) / 10) * 100) / 100 })).sort((a, b) => b.score - a.score).map(s => ({ ...s, label: s.score.toFixed(2) + ' CPS' }));
  const rank = standings.findIndex(s => s.user_id === ctx.me.user_id) + 1, my = f[ctx.me.user_id];
  results(stage, ctx, { score: Math.round(my * 100) / 100, unit: 'CPS', won: rank === 1 && standings.length > 1, title: rank === 1 ? 'You win!' : `#${rank} of ${standings.length}`, sub: `${mine} clicks in 10 seconds.`, standings });
}
