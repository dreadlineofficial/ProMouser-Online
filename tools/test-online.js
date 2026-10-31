// ProMouser Online end-to-end check (demo backend). Serve the repo root on :8766 first:
//   python3 -m http.server 8766 --bind 127.0.0.1    then    node tools/test-online.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8766/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const errs = [];
const watch = p => { p.on('pageerror', e => errs.push(p.url().replace(BASE, '') + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|AudioContext/.test(m.text())) errs.push(p.url().replace(BASE, '') + ' ' + m.text().slice(0, 200)); }); };
async function signUp(p, name) {
  await p.goto(BASE + 'index.html'); await p.waitForFunction(() => window.PMO);
  await p.evaluate(n => PMO.api.signUp({ name: n, email: n.toLowerCase() + Date.now() + '@x.com', password: 'longenough' }), name); await p.waitForTimeout(300);
}
async function clickStage(p, n, gap = 60) { const r = await (await p.$('#stage')).boundingBox(); await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); for (let i = 0; i < n; i++) { await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(gap); } }
(async () => {
  const b = await chromium.launch({ args: ARGS });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } }); const p = await ctx.newPage(); watch(p);
  await p.goto(BASE + 'index.html'); await p.evaluate(() => localStorage.clear());
  await signUp(p, 'Tester');
  // pages
  for (const pg of ['index.html', 'play.html', 'lobbies.html', 'friends.html', 'shop.html', 'pass.html', 'turbo.html', 'settings.html']) { await p.goto(BASE + pg); await p.waitForTimeout(900); }
  await p.goto(BASE + 'play.html'); await p.waitForTimeout(800);
  ok(await p.$$eval('.cards.games .gcard img', a => a.filter(i => i.complete && i.naturalWidth > 0).length) === 8, 'play page shows 8 game posters');
  // quick games to the results screen
  const runs = [['cps-duel', 'bots', async () => clickStage(p, 60, 120)], ['reaction-duel', 'bots', async () => {}], ['simon', 'solo', async () => { for (let i = 0; i < 25 && !(await p.$('.result-card')); i++) { await p.waitForTimeout(1200); if (/Your turn/.test(await p.textContent('.hud-msg').catch(() => ''))) await clickStage(p, 1); } }],
    ['royale', 'bots', async () => clickStage(p, 150, 150)], ['aim-rush', 'solo', async () => clickStage(p, 20, 400)], ['tracking', 'solo', async () => {}]];
  for (const [g, mode, act] of runs) {
    await p.goto(`${BASE}game.html?g=${g}&mode=${mode}`); await p.waitForTimeout(2500);
    await act();
    const done = await p.waitForSelector('.result-card', { timeout: 150000 }).then(() => true).catch(() => false);
    const reward = done ? (await p.textContent('.result-card')).replace(/\s+/g, ' ').slice(0, 90) : '';
    ok(done, `${g} (${mode}) reaches results: ${reward}`);
  }
  // FPS games start and shoot
  await p.goto(`${BASE}game.html?g=arena&mode=bots`); await p.waitForTimeout(2500); await p.click('#lockBtn'); await p.waitForTimeout(5000);
  const ar = await p.evaluate(() => { const A = document.querySelector('#stage').__arena; const before = A.P.ammo; A.shoot(); return { bots: Object.keys(A.ents).length, ammo: before - A.P.ammo }; });
  ok(ar.bots >= 4 && ar.ammo === 1, 'arena starts with bots and fires ' + JSON.stringify(ar));
  await p.goto(`${BASE}game.html?g=gallery&mode=solo`); await p.waitForTimeout(2500); await p.click('#go'); await p.waitForTimeout(6000);
  ok(await p.evaluate(() => document.querySelector('#stage').__gallery.targets.length) > 0, 'gallery spawns targets');
  // two-player lobby (two tabs, same browser: demo realtime is a BroadcastChannel)
  const q = await ctx.newPage(); watch(q);
  await p.goto(BASE + 'index.html'); await p.waitForFunction(() => window.PMO);
  const L = await p.evaluate(() => PMO.api.lobbyCreate({ game: 'cps-duel', name: 'Test lobby', isPublic: true, max: 4 }));
  await p.goto(BASE + 'lobby.html?id=' + L.id);
  await signUp(q, 'Second'); await q.evaluate(c => PMO.api.lobbyJoin(c), L.code); await q.goto(BASE + 'lobby.html?id=' + L.id);
  await q.waitForTimeout(2500); await q.click('#readyBtn'); await p.waitForTimeout(1500);
  ok(!(await p.$eval('#startBtn', e => e.disabled)), 'host sees the second player and can start');
  await p.click('#startBtn');
  await Promise.all([p.waitForURL(/game\.html/, { timeout: 15000 }), q.waitForURL(/game\.html/, { timeout: 15000 })]);
  await p.waitForTimeout(6000);
  await Promise.all([clickStage(p, 50, 100), clickStage(q, 30, 160)]);
  const both = await Promise.all([p, q].map(x => x.waitForSelector('.standings li', { timeout: 60000 }).then(() => x.$$eval('.standings li', a => a.length)).catch(() => 0)));
  ok(both[0] === 2 && both[1] === 2, 'lobby CPS duel: both players see 2-player standings ' + both);
  ok(errs.length === 0, 'no console errors' + (errs.length ? ':\n  ' + errs.slice(0, 10).join('\n  ') : ''));
  await b.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
