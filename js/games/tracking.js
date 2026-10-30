/* Orb Tracking: keep the cursor on a dodging orb for 30 s. Score = % of time on target. Same orb path for everyone in a lobby. */
import { countdown, results, sleep, avatar, nameTag, hud, pill } from './common.js';

export async function start(stage, ctx) {
  const DUR = 30000, R = 34, live = {};
  stage.style.cursor = 'crosshair';
  stage.innerHTML = '<canvas id="cv" style="position:absolute;inset:0;width:100%;height:100%"></canvas>';
  const cv = stage.querySelector('#cv'), g = cv.getContext('2d');
  const fit = () => { cv.width = stage.clientWidth * devicePixelRatio; cv.height = stage.clientHeight * devicePixelRatio; }; fit(); addEventListener('resize', fit);
  const r = ctx.rand, ph = Array.from({ length: 6 }, () => r() * 6.28), sp = Array.from({ length: 6 }, () => .25 + r() * .6);
  const pos = t => {   // smooth Lissajous-style path with sudden dashes
    const s = t / 1000, dash = Math.sin(s * 1.7 + ph[5]) > .92 ? 1.8 : 1;
    return [.5 + .36 * Math.sin(s * sp[0] * dash + ph[0]) + .08 * Math.sin(s * sp[1] * 3 + ph[1]), .5 + .34 * Math.cos(s * sp[2] * dash + ph[2]) + .08 * Math.sin(s * sp[3] * 2.4 + ph[3])];
  };
  let mx = -1, my = -1; stage.addEventListener('pointermove', e => { const b = cv.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; });
  stage.addEventListener('contextmenu', e => e.preventDefault());
  const others = ctx.players.filter(p => p.user_id !== ctx.me.user_id);
  ctx.listen('s', d => { live[d.id] = d.s; });
  hud(stage, pill('On target', '0%'));
  await ctx.sync('go');
  await countdown(stage);
  let on = 0, total = 0, t0 = performance.now(), last = t0, done = false;
  await new Promise(res => {
    const frame = now => {
      const t = now - t0, dt = now - last; last = now;
      const W = cv.width / devicePixelRatio, H = cv.height / devicePixelRatio, [px, py] = pos(t), x = px * W, y = py * H, hit = Math.hypot(mx - x, my - y) <= R;
      total += dt; if (hit) on += dt;
      g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.04)'; for (let k = 0; k < W; k += 48) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, H); g.stroke(); } for (let k = 0; k < H; k += 48) { g.beginPath(); g.moveTo(0, k); g.lineTo(W, k); g.stroke(); }
      const grd = g.createRadialGradient(x, y, 0, x, y, R * 2.2); grd.addColorStop(0, hit ? 'rgba(52,211,153,.55)' : 'rgba(168,85,247,.5)'); grd.addColorStop(1, 'transparent');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, R * 2.2, 0, 7); g.fill();
      g.fillStyle = hit ? '#34d399' : '#a855f7'; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      const pct = Math.round(on / Math.max(1, total) * 100);
      hud(stage, `${pill('On target', pct + '%')}<div class="row">${others.map(p => `<span class="pill">${avatar(p, 20)}${nameTag(p)} <b>${live[p.user_id] ?? 0}%</b></span>`).join('')}</div>${pill('Time', Math.max(0, (DUR - t) / 1000).toFixed(1))}`);
      if (Math.floor(now / 500) !== Math.floor((now - dt) / 500)) ctx.emit('s', { id: ctx.me.user_id, s: pct });
      if (t >= DUR) { done = true; res(); } else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  const pct = Math.round(on / Math.max(1, total) * 1000) / 10;
  ctx.emit('s', { id: ctx.me.user_id, s: pct }); live[ctx.me.user_id] = pct;
  await sleep(ctx.mode === 'lobby' ? 1500 : 0);
  const standings = ctx.players.length > 1 ? ctx.players.map(p => ({ ...p, score: live[p.user_id] || 0 })).sort((a, b) => b.score - a.score).map(s => ({ ...s, label: s.score + '%' })) : null;
  const rank = standings ? standings.findIndex(s => s.user_id === ctx.me.user_id) + 1 : 1;
  results(stage, ctx, { score: pct, unit: '% on target', won: !!standings && rank === 1, title: standings ? (rank === 1 ? 'You win!' : `#${rank} of ${standings.length}`) : pct >= 70 ? 'Locked on!' : 'Nice tracking', standings });
}
