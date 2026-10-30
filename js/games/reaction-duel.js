/* Reaction Duel: best of 5. Wait for green, click first. Clicking early loses the round. */
import { onPress, results, sleep, avatar, nameTag, esc } from './common.js';

export async function start(stage, ctx) {
  const ROUNDS = 5, wins = Object.fromEntries(ctx.all.map(p => [p.user_id, 0])), times = Object.fromEntries(ctx.all.map(p => [p.user_id, []]));
  stage.innerHTML = `<div style="display:grid;grid-template-rows:auto 1fr;gap:12px;padding:16px;min-height:inherit">
    <div class="row between"><div class="row" id="score"></div><span class="pill" id="rnd">Round 0 / ${ROUNDS}</span></div>
    <button type="button" id="pad" style="border-radius:22px;display:grid;place-items:center;min-height:380px;background:#1d1d2e;transition:background .05s;cursor:pointer">
      <div style="text-align:center;pointer-events:none"><div class="gbig" id="big">Get ready</div><div id="sub" style="font-weight:700;opacity:.85">Click when it turns green</div></div></button></div>`;
  const pad = stage.querySelector('#pad'), big = stage.querySelector('#big'), sub = stage.querySelector('#sub');
  const score = () => { stage.querySelector('#score').innerHTML = ctx.all.map(p => `<span class="pill">${avatar(p, 22)}${nameTag(p)} <b>${wins[p.user_id]}</b></span>`).join(''); };
  const set = (bg, b, s) => { pad.style.background = bg; big.textContent = b; sub.textContent = s; };
  score();
  let round = 0, state = 'idle', goAt = 0, hits = {}, timer = 0;
  const report = (id, ms, early) => { if (hits[id]) return; hits[id] = { ms, early }; ctx.emit('hit', { id, r: round, ms, early }); };
  ctx.listen('hit', d => { if (d.r === round && !hits[d.id]) hits[d.id] = { ms: d.ms, early: d.early }; });
  ctx.listen('round', d => {
    round = d.r; hits = {}; state = 'wait'; stage.querySelector('#rnd').textContent = `Round ${round} / ${ROUNDS}`;
    set('#3a0d14', 'Wait…', 'Don’t click yet');
    clearTimeout(timer); timer = setTimeout(() => { state = 'go'; set('#0d8f4a', 'CLICK!', ''); goAt = performance.now(); requestAnimationFrame(t => { if (state === 'go') goAt = Math.max(goAt, t); }); }, d.delay);
    if (ctx.isHost) ctx.bots.forEach(b => {   // bots: ~240 ms at normal, with misses and the odd jump-start
      const early = ctx.rand() < .04, ms = Math.round((260 + ctx.rand() * 90 - 40) / b.skill);
      setTimeout(() => report(b.user_id, early ? null : ms, early), early ? d.delay * ctx.rand() : d.delay + ms);
    });
  });
  ctx.listen('end', d => {
    state = 'shown'; clearTimeout(timer);
    d.winner && wins[d.winner] != null && wins[d.winner]++; Object.entries(d.hits).forEach(([id, h]) => { if (!h.early && h.ms != null) times[id].push(h.ms); });
    const w = ctx.all.find(p => p.user_id === d.winner), mine = d.hits[ctx.me.user_id];
    set('#1d1d2e', mine ? (mine.early ? 'Too soon!' : mine.ms + ' ms') : 'Too slow', w ? `${w.user_id === ctx.me.user_id ? 'You take' : w.display_name + ' takes'} round ${d.r}` : 'Nobody scored');
    score();
  });
  onPress(pad, (t, b) => {
    if (b !== 0) return;
    if (state === 'wait') { report(ctx.me.user_id, null, true); set('#4a3205', 'Too soon!', 'You jumped the gun'); state = 'shown'; }
    else if (state === 'go') { const ms = Math.max(0, Math.round(t - goAt)); report(ctx.me.user_id, ms, false); set('#1d1d2e', ms + ' ms', 'Waiting for the others…'); state = 'shown'; }
  });
  await ctx.sync('go');
  if (ctx.isHost) {
    for (let r = 1; r <= ROUNDS; r++) {
      ctx.emit('round', { r, delay: 1400 + Math.floor(ctx.rand() * 2400) });
      const t0 = Date.now();
      while (Date.now() - t0 < 9000 && ctx.all.some(p => !hits[p.user_id])) await sleep(60);
      const valid = Object.entries(hits).filter(([, h]) => !h.early && h.ms != null).sort((a, b) => a[1].ms - b[1].ms);
      ctx.emit('end', { r, winner: valid.length ? valid[0][0] : null, hits });
      await sleep(1800);
    }
    ctx.emit('final', {});
  } else await new Promise(res => ctx.listen('final', res));
  await sleep(200);
  const avg = id => times[id].length ? Math.round(times[id].reduce((a, b) => a + b, 0) / times[id].length) : 999;
  const standings = ctx.all.map(p => ({ ...p, score: wins[p.user_id], avg: avg(p.user_id) })).sort((a, b) => b.score - a.score || a.avg - b.avg).map(s => ({ ...s, label: `${s.score} won · ${s.avg === 999 ? '—' : s.avg + ' ms'}` }));
  const rank = standings.findIndex(s => s.user_id === ctx.me.user_id) + 1, myAvg = avg(ctx.me.user_id);
  results(stage, ctx, { score: myAvg, unit: 'ms avg', won: rank === 1 && standings.length > 1, title: rank === 1 ? 'You win!' : `#${rank} of ${standings.length}`, sub: `You won ${wins[ctx.me.user_id]} of ${ROUNDS} rounds.`, standings });
}
