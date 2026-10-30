/* Click Royale: 5-second rounds, the lowest clicker is knocked out. Last one standing wins. */
import { onPress, results, sleep, avatar, nameTag, esc } from './common.js';

export async function start(stage, ctx) {
  const RD = 5000, alive = new Set(ctx.all.map(p => p.user_id)), outRound = {};
  let round = 0, counts = {}, running = false, mine = 0, t0 = 0;
  stage.innerHTML = `<div style="display:grid;grid-template-rows:auto 1fr auto;gap:12px;padding:16px;min-height:inherit">
    <div class="row between"><span class="pill" id="rnd">Round 1</span><span class="pill" id="left"></span><span class="pill" id="clock">5.00</span></div>
    <div id="tiles" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;align-content:start"></div>
    <button type="button" id="pad" style="border-radius:20px;min-height:170px;display:grid;place-items:center;background:linear-gradient(135deg,var(--g1),var(--g2));cursor:pointer"><div style="text-align:center;pointer-events:none"><div class="gbig" id="big" style="font-size:3.4rem">Get ready</div><div id="sub" style="font-weight:700">Click to survive</div></div></button></div>`;
  const pad = stage.querySelector('#pad'), big = stage.querySelector('#big'), sub = stage.querySelector('#sub');
  const tiles = () => {
    stage.querySelector('#tiles').innerHTML = ctx.all.map(p => { const out = !alive.has(p.user_id); return `<div class="panel" style="padding:12px;display:grid;gap:6px;justify-items:center;${out ? 'opacity:.35;filter:grayscale(1)' : ''}${p.user_id === ctx.me.user_id ? ';box-shadow:inset 0 0 0 1px rgba(168,85,247,.6)' : ''}">${avatar(p, 40)}${nameTag(p)}<b style="font-size:1.4rem">${out ? 'OUT' : counts[p.user_id] || 0}</b></div>`; }).join('');
    stage.querySelector('#left').textContent = `${alive.size} left`;
  };
  tiles();
  onPress(pad, (t, b) => { if (!running || b !== 0 || !alive.has(ctx.me.user_id) || t - t0 > RD) return; mine++; counts[ctx.me.user_id] = mine; big.textContent = mine; });
  ctx.listen('p', d => { if (d.r === round) Object.assign(counts, d.c); });
  ctx.listen('rs', async d => {
    round = d.r; counts = {}; mine = 0; stage.querySelector('#rnd').textContent = `Round ${round}`;
    const in_ = alive.has(ctx.me.user_id);
    big.textContent = in_ ? '3' : 'Spectating'; sub.textContent = in_ ? `Round ${round}: the slowest is out` : 'You’re out. Watch the rest!';
    for (let i = 2; i > 0 && in_; i--) { await sleep(700); big.textContent = i; }
    await sleep(700); running = true; t0 = performance.now(); if (in_) { big.textContent = '0'; sub.textContent = 'CLICK!'; }
    const rate = Object.fromEntries(ctx.bots.map(b => [b.user_id, (6.5 + ctx.rand() * 3.5 + round * .25) * b.skill]));
    const tick = setInterval(() => {
      const el = Math.min(RD, performance.now() - t0), c = {};
      if (alive.has(ctx.me.user_id)) c[ctx.me.user_id] = mine;
      if (ctx.isHost) ctx.bots.forEach(b => { if (alive.has(b.user_id)) c[b.user_id] = Math.floor(rate[b.user_id] * el / 1000); });
      ctx.emit('p', { r: round, c }); tiles(); stage.querySelector('#clock').textContent = ((RD - el) / 1000).toFixed(2);
    }, 150);
    await sleep(RD); running = false; clearInterval(tick);
    const c = {}; if (alive.has(ctx.me.user_id)) c[ctx.me.user_id] = mine; if (ctx.isHost) ctx.bots.forEach(b => { if (alive.has(b.user_id)) c[b.user_id] = Math.floor(rate[b.user_id] * RD / 1000); });
    ctx.emit('p', { r: round, c });
  });
  ctx.listen('out', d => {
    alive.delete(d.id); outRound[d.id] = d.r; tiles();
    const who = ctx.all.find(p => p.user_id === d.id);
    big.textContent = d.id === ctx.me.user_id ? 'Knocked out!' : `${who ? who.display_name : 'Someone'} is out`; sub.textContent = `${d.n} clicks was the lowest`;
  });
  const finP = new Promise(res => ctx.listen('fin', res));   // subscribe before the host can emit it
  await ctx.sync('go');
  if (ctx.isHost) {
    for (let r = 1; alive.size > 1 && r <= 12; r++) {
      ctx.emit('rs', { r }); await sleep(2100 + RD + 900);
      const live = [...alive].map(id => [id, counts[id] ?? 0]).sort((a, b) => a[1] - b[1] || ctx.rand() - .5);
      ctx.emit('out', { id: live[0][0], n: live[0][1], r }); await sleep(1800);
    }
    ctx.emit('fin', { winner: [...alive][0], outRound });
  }
  const fin = await finP;
  const total = Math.max(...Object.values(fin.outRound), 0), survived = id => id === fin.winner ? total : (fin.outRound[id] || 1) - 1;
  const standings = ctx.all.map(p => ({ ...p, score: survived(p.user_id), out: p.user_id !== fin.winner })).sort((a, b) => b.score - a.score).map(s => ({ ...s, label: s.out ? `out in round ${s.score + 1}` : 'Winner' }));
  const won = fin.winner === ctx.me.user_id;
  results(stage, ctx, { score: survived(ctx.me.user_id), unit: 'rounds', won, title: won ? 'Last one standing!' : 'Knocked out', sub: `${ctx.all.length} players started.`, standings });
}
