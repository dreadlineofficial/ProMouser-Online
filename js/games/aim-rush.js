/* Aim Rush: 30 seconds of shrinking targets. Fast hits and streaks score more; misses cost points.
   In a lobby everyone gets the same targets (shared seed) and sees live scores. */
import { onPress, countdown, results, sleep, avatar, nameTag, hud, pill } from './common.js';

export async function start(stage, ctx) {
  const DUR = 30000, LIFE = 1700, live = {};
  stage.style.cursor = 'crosshair';
  stage.innerHTML = '<div id="field" style="position:absolute;inset:60px 0 0"></div>';
  const field = stage.querySelector('#field');
  const others = ctx.players.filter(p => p.user_id !== ctx.me.user_id);
  const draw = (score, streak, left) => hud(stage, `<div class="row">${pill('Score', score, 'sc')}${pill('Streak', 'x' + (1 + Math.min(streak, 10) * .1).toFixed(1))}</div>
    <div class="row">${others.map(p => `<span class="pill">${avatar(p, 20)}${nameTag(p)} <b>${live[p.user_id] || 0}</b></span>`).join('')}</div>${pill('Time', (left / 1000).toFixed(1))}`);
  ctx.listen('s', d => { live[d.id] = d.s; });
  draw(0, 0, DUR);
  await ctx.sync('go');
  await countdown(stage);
  let score = 0, streak = 0, hits = 0, shots = 0, t0 = performance.now(), targets = [], i = 0, done = false;
  const spawn = () => {
    const r = ctx.rand, size = 46 + r() * 30, el = document.createElement('div');
    const t = { x: .06 + r() * .88, y: .08 + r() * .84, size, born: performance.now(), el, id: i++ };
    el.style.cssText = `position:absolute;left:${t.x * 100}%;top:${t.y * 100}%;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;pointer-events:none;
      background:radial-gradient(circle,#fff 0 14%,var(--g1) 15% 36%,#fff 37% 50%,var(--g2) 51%);box-shadow:0 0 24px var(--g1);transition:transform ${LIFE}ms linear;`;
    field.appendChild(el); requestAnimationFrame(() => { el.style.transform = 'scale(.25)'; }); targets.push(t);
  };
  for (let k = 0; k < 3; k++) spawn();
  onPress(stage, (t, b, e) => {
    if (done || b !== 0) return;
    const rect = field.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top; shots++;
    const now = performance.now();
    const hit = targets.find(tg => { const k = 1 - .75 * Math.min(1, (now - tg.born) / LIFE); return Math.hypot(x - tg.x * rect.width, y - tg.y * rect.height) <= tg.size * k / 2 + 3; });
    if (hit) {
      hits++; streak++; const speed = Math.max(0, 1 - (now - hit.born) / LIFE);
      score += Math.round((60 + 90 * speed) * (1 + Math.min(streak, 10) * .1));
      hit.el.style.transition = 'transform .12s, opacity .12s'; hit.el.style.transform = 'scale(1.6)'; hit.el.style.opacity = '0'; setTimeout(() => hit.el.remove(), 130);
      targets = targets.filter(tg => tg !== hit); spawn();
    } else { score = Math.max(0, score - 40); streak = 0; }
  });
  while (!done) {
    const now = performance.now(), left = DUR - (now - t0);
    targets.filter(tg => now - tg.born > LIFE).forEach(tg => { tg.el.remove(); streak = 0; targets = targets.filter(x => x !== tg); spawn(); });
    draw(score, streak, Math.max(0, left));
    if (Math.floor(now / 400) !== Math.floor((now - 120) / 400)) ctx.emit('s', { id: ctx.me.user_id, s: score });
    if (left <= 0) done = true;
    await sleep(100);
  }
  targets.forEach(tg => tg.el.remove());
  ctx.emit('s', { id: ctx.me.user_id, s: score, done: true }); live[ctx.me.user_id] = score;
  await sleep(ctx.mode === 'lobby' ? 1500 : 0);
  const standings = ctx.players.length > 1 ? ctx.players.map(p => ({ ...p, score: live[p.user_id] || 0 })).sort((a, b) => b.score - a.score) : null;
  const rank = standings ? standings.findIndex(s => s.user_id === ctx.me.user_id) + 1 : 1;
  results(stage, ctx, { score, unit: 'pts', won: !!standings && rank === 1, title: standings ? (rank === 1 ? 'You win!' : `#${rank} of ${standings.length}`) : 'Time!', sub: `${hits} hits · ${shots ? Math.round(hits / shots * 100) : 0}% accuracy`, standings });
}
