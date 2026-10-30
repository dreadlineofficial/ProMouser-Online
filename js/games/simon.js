/* Pattern Recall: watch the pattern light up, click it back. One step longer every level. */
import { onPress, results, sleep, hud, pill } from './common.js';

export async function start(stage, ctx) {
  const COLORS = ['#22d3ee', '#a855f7', '#f472b6', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6', '#eab308', '#14b8a6'];
  stage.innerHTML = `<div style="display:grid;place-items:center;min-height:inherit;padding:70px 16px 24px"><div id="grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:min(420px,88vw)">
    ${COLORS.map((c, i) => `<button type="button" data-i="${i}" aria-label="Pad ${i + 1}" style="aspect-ratio:1;border-radius:20px;background:${c};opacity:.28;transition:opacity .12s,transform .12s;box-shadow:0 0 0 0 ${c}"></button>`).join('')}</div></div>`;
  const pads = [...stage.querySelectorAll('[data-i]')];
  let ac = null; const beep = i => { try { ac = ac || new AudioContext(); const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.value = 262 * Math.pow(2, i / 6); o.type = 'triangle'; gn.gain.setValueAtTime(.12, ac.currentTime); gn.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .28); o.connect(gn).connect(ac.destination); o.start(); o.stop(ac.currentTime + .3); } catch (e) { /* no audio */ } };
  const flash = async (i, ms = 380) => { const p = pads[i]; p.style.opacity = '1'; p.style.transform = 'scale(1.06)'; p.style.boxShadow = `0 0 40px ${COLORS[i]}`; beep(i); await sleep(ms); p.style.opacity = '.28'; p.style.transform = ''; p.style.boxShadow = 'none'; };
  const seq = []; let level = 0, input = 0, accepting = false, over = null;
  const status = msg => hud(stage, `${pill('Level', level)}<span class="pill">${msg}</span>${pill('Best', (ctx.me.stats.simon || {}).best ?? '—')}`);
  onPress(stage.querySelector('#grid'), async (t, b, e) => {
    const p = e.target.closest('[data-i]'); if (!p || !accepting || b !== 0) return;
    const i = +p.dataset.i; flash(i, 160);
    if (i !== seq[input]) { accepting = false; over && over(); return; }
    input++; if (input === seq.length) { accepting = false; next(); }
  });
  const next = async () => {
    level = seq.length; seq.push(Math.floor(Math.random() * 9)); input = 0; status('Watch…'); await sleep(650);
    const speed = Math.max(170, 420 - seq.length * 14);
    for (const i of seq) { await flash(i, speed); await sleep(110); }
    status('Your turn'); accepting = true;
  };
  status('Get ready'); await sleep(900);
  await new Promise(res => { over = res; next(); });
  pads.forEach(p => { p.style.opacity = '.12'; });
  results(stage, ctx, { score: level, unit: 'levels', won: false, title: level >= 10 ? 'Big brain!' : 'Pattern broken', sub: `You repeated a ${level}-step pattern.` });
}
