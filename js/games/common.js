/* =====================================================================
   ProMouser Online: shared game toolkit
   ===================================================================== */
import { api } from '../api.js';
import { channel } from '../net.js';
import { avatar, nameTag, esc, icon, num, toast, errText, refresh, state } from '../ui.js';
import { gameById } from '../data.js';

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const stamp = e => { const p = performance.now(), t = e.timeStamp; return t > 0 && t <= p + 1 && p - t < 1000 ? t : p; };

// one call per press (mouse, touch, pen), no menus / selection / back-forward inside el
export function onPress(el, fn) {
  el.addEventListener('contextmenu', e => e.preventDefault());
  ['selectstart', 'dragstart', 'dblclick', 'auxclick'].forEach(t => el.addEventListener(t, e => e.preventDefault()));
  el.addEventListener('mouseup', e => { if (e.button > 2) e.preventDefault(); });
  el.addEventListener('mousedown', e => { e.preventDefault(); fn(stamp(e), e.button, e); });
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; e.preventDefault(); fn(stamp(e), 0, e); });
}

export async function countdown(stage, n = 3) {
  const o = document.createElement('div'); o.className = 'gover'; stage.appendChild(o);
  for (let i = n; i > 0; i--) { o.innerHTML = `<div class="count">${i}</div>`; await sleep(800); }
  o.innerHTML = '<div class="count">GO!</div>'; await sleep(350); o.remove();
}

/* ---------- bots ---------- */
const BOT_NAMES = ['Nova', 'Glitch', 'Turbo', 'Pixel', 'Viper', 'Echo', 'Blaze', 'Frost', 'Orbit', 'Rogue', 'Zen', 'Volt'];
const BOT_BORDERS = ['b-neon', 'b-frost', 'b-crimson', 'b-pixel', 'b-volt', 'b-galaxy'];
export const SKILL = { easy: .7, normal: 1, hard: 1.3 };
export function makeBots(n, difficulty = 'normal', r = Math.random) {
  const names = [...BOT_NAMES].sort(() => r() - .5);
  return Array.from({ length: n }, (_, i) => ({ user_id: 'bot-' + i, display_name: 'Bot ' + names[i % names.length], username: 'bot' + i, bot: true, level: { easy: 3, normal: 12, hard: 30 }[difficulty] || 12, border: BOT_BORDERS[i % BOT_BORDERS.length], skill: SKILL[difficulty] || 1 }));
}

/* ---------- match context: solo, vs bots, or a lobby round ---------- */
export async function match({ game, mode, lobbyId, round, seed }) {
  const me = state.me, g = gameById[game];
  const card = { user_id: me.user_id, display_name: me.display_name, username: me.username, avatar_url: me.avatar_url, border: me.border, turbo: me.turbo, name_grad: me.name_grad, level: me.level };
  const ctx = { game, g, me, card, mode, seed: seed || Math.floor(Math.random() * 1e9), lobbyId: lobbyId || null, players: [card], bots: [], isHost: true, net: null, lobby: null };
  ctx.rand = rng(ctx.seed);
  if (mode === 'bots') ctx.bots = makeBots(game === 'arena' ? 3 : game === 'royale' ? 5 : 1, 'normal', ctx.rand);
  if (lobbyId) {
    ctx.mode = 'lobby';
    const L = ctx.lobby = await api.lobby(lobbyId);
    const ch = ctx.net = channel(`game:${lobbyId}:${round}`, { key: me.user_id });
    const here = new Set([me.user_id]);
    ch.onPresence(list => { list.forEach(p => here.add(p.key)); });
    await ch.join({ name: me.display_name });
    // wait (briefly) for everyone in the lobby to load the game
    const want = L.members.map(m => m.user_id), t0 = Date.now();
    while (Date.now() - t0 < 5000 && !want.every(id => here.has(id))) await sleep(150);
    ctx.players = L.members.filter(m => here.has(m.user_id));
    if (!ctx.players.some(p => p.user_id === me.user_id)) ctx.players.push(card);
    const hostId = here.has(L.host) ? L.host : ctx.players.map(p => p.user_id).sort()[0];
    ctx.isHost = hostId === me.user_id; ctx.hostId = hostId;
    if (g.bots) ctx.bots = makeBots(+(L.settings.bots || 0), L.settings.difficulty || 'normal', rng(ctx.seed + 7));
  }
  ctx.all = [...ctx.players, ...ctx.bots];
  ctx.send = (e, d) => ctx.net && ctx.net.send(e, d);
  ctx.on = (e, f) => ctx.net && ctx.net.on(e, f);
  // emit/listen: same code path for solo, vs bots and lobby matches (local handlers + the network)
  const local = {};
  ctx.emit = (e, d) => { (local[e] || []).forEach(f => f(d)); ctx.send(e, d); };
  ctx.listen = (e, f) => { (local[e] = local[e] || []).push(f); ctx.on(e, f); };
  // a shared "start" so lobby players begin together
  ctx.sync = async (name = 'go', payload = {}) => {
    if (!ctx.net) return payload;
    if (ctx.isHost) {   // keep calling "go" until every player has confirmed it (or ~8 s pass)
      const heard = new Set([ctx.me.user_id]); ctx.on(name + ':ack', d => heard.add(d.id));
      await sleep(250);
      for (let i = 0; i < 20 && ctx.players.some(p => !heard.has(p.user_id)); i++) { ctx.send(name, payload); await sleep(400); }
      return payload;
    }
    return new Promise(res => {
      let done = false;
      ctx.on(name, d => { ctx.send(name + ':ack', { id: ctx.me.user_id }); if (!done) { done = true; res(d); } });
      setTimeout(() => { if (!done) { done = true; res(payload); } }, 12000);
    });
  };
  ctx.leave = () => { ctx.net && ctx.net.leave(); };
  return ctx;
}

/* ---------- the results screen (submits the score) ---------- */
export async function results(stage, ctx, { score, won, title, sub, standings, unit = '' }) {
  const g = ctx.g, o = document.createElement('div'); o.className = 'gover'; stage.appendChild(o);
  o.innerHTML = `<div class="result-card"><span class="kicker">${esc(g.name)}</span><h2 style="margin:0">${esc(title)}</h2>
    <div class="gbig grad-text">${score}${unit ? `<small style="font-size:.35em"> ${esc(unit)}</small>` : ''}</div>${sub ? `<p class="muted">${sub}</p>` : ''}
    ${standings ? `<ol class="standings">${standings.map((s, i) => `<li class="${s.user_id === ctx.me.user_id ? 'me' : ''} ${s.out ? 'out' : ''}"><span class="pos">${i + 1}</span>${avatar(s, 30)}<span>${nameTag(s)}${s.bot ? ' <small class="muted">bot</small>' : ''}</span><b>${esc(String(s.label ?? s.score))}</b></li>`).join('')}</ol>` : ''}
    <div class="reward" id="rew"><span class="muted">Saving…</span></div>
    <div class="row center">${ctx.lobbyId ? `<a class="btn primary" href="lobby.html?id=${ctx.lobbyId}">${icon('lobby')}Back to lobby</a>` : `<button class="btn primary" type="button" id="again">${icon('play')}Play again</button>`}<a class="btn ghost" href="play.html?g=${g.id}">${icon('trophy')}Leaderboard</a></div></div>`;
  const again = o.querySelector('#again'); again && again.addEventListener('click', () => location.reload());
  ctx.leave();
  try {
    const r = await api.submit(g.id, Math.max(0, Math.round(score * 100) / 100), !!won, ctx.lobbyId);
    o.querySelector('#rew').innerHTML = `<span>${icon('coin')}+${num(r.coins)} coins</span><span>${icon('star')}+${r.xp} XP</span>${r.new_best ? `<span>${icon('trophy')}New best!</span>` : ''}${r.level_up ? `<span>${icon('bolt')}Level ${r.level}!</span>` : ''}${r.capped ? '<span class="muted">Daily coin cap reached</span>' : ''}`;
    refresh();
  } catch (e) { o.querySelector('#rew').innerHTML = `<span class="muted">${esc(errText(e))}</span>`; }
}

export function hud(stage, html) { let h = stage.querySelector('.ghud'); if (!h) { h = document.createElement('div'); h.className = 'ghud'; stage.appendChild(h); } h.innerHTML = html; return h; }
export const pill = (label, value, id) => `<span class="pill"${id ? ` id="${id}"` : ''}>${label} <b>${value}</b></span>`;
export { avatar, nameTag, esc, icon, num, toast };
