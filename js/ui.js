/* =====================================================================
   ProMouser Online: app shell + shared UI
   ===================================================================== */
import { api } from './api.js';
import { presence, listen, onOnline, onlineIds, statusOf, ping } from './net.js';
import { itemById, RARITY, TURBO_PRODUCT, itemProduct, PROMOUSER_URL, levelOf, xpForLevel } from './data.js';

export const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = n => Number(n || 0).toLocaleString('en-IN');
export const inr = n => '₹' + Number(n).toLocaleString('en-IN');
export const ago = t => { const s = (Date.now() - new Date(t)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; };
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- icons ---------- */
const P = {
  home: '<path d="m3 11 9-8 9 8M5 10v10h14V10"/>', play: '<path d="M6 4l14 8-14 8z"/>', lobby: '<rect x="3" y="4" width="18" height="14" rx="3"/><path d="M8 21h8M9 9h6M9 13h3"/>',
  friends: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5c2.3.3 3.9 2 4.5 4.5"/>',
  shop: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', pass: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 4.3-6.5 8-6.5s6.8 2.3 8 6.5"/>', coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.8c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.8-2.5 2.2-2.5 1-2.5 2.2 1.1 2 2.5 2 2.5-.8 2.5-2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>', crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>', cursor: '<path d="m5 3 14 7-6 2-2 6z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-25 12 12)"/>', gallery: '<path d="M3 20h18M5 20V9l7-5 7 5v11"/><circle cx="12" cy="13" r="3"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12 5 5 9-10"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  send: '<path d="m4 12 16-8-6 16-2-7z"/>', turbo: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', door: '<path d="M14 4h5v16h-5M4 12h11M11 8l4 4-4 4"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.8.7 3 2.4 3.5 5.2"/>'
};
export const icon = (k, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || P.star}</svg>`;

/* ---------- people ---------- */
const hue = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;
const DECO = {
  'b-crown': '<i class="deco crown"><svg viewBox="0 0 24 16"><path d="M2 14 4 3l5 5 3-7 3 7 5-5 2 11z" fill="url(#gcrown)" stroke="#fff6" stroke-width=".6"/><defs><linearGradient id="gcrown" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff3b0"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs></svg></i>',
  'b-sakura': '<i class="deco petal p1"></i><i class="deco petal p2"></i><i class="deco petal p3"></i>',
  'b-fire': '<i class="deco flame f1"></i><i class="deco flame f2"></i><i class="deco flame f3"></i>',
  'b-ember': '<i class="deco spark s1"></i><i class="deco spark s2"></i><i class="deco spark s3"></i>',
  'b-volt': '<i class="deco bolt"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#fde047"/></svg></i>',
  'b-galaxy': '<i class="deco stars"></i>', 'b-void': '<i class="deco stars"></i>', 'b-frost': '<i class="deco flake k1">❄</i><i class="deco flake k2">❄</i>'
};
export function avatar(u, size = 40, opts = {}) {
  u = u || {}; const b = opts.border !== undefined ? opts.border : u.border, n = (u.display_name || u.username || '?').trim();
  const inner = u.avatar_url ? `<img src="${esc(u.avatar_url)}" alt="" loading="lazy" draggable="false">` : `<b style="background:hsl(${hue(u.username || n)} 55% 32%)">${esc(n[0].toUpperCase())}</b>`;
  const dot = opts.status ? `<i class="av-dot ${opts.status}"></i>` : '';
  return `<span class="av ${b ? 'bd ' + esc(b) : ''}" style="--s:${size}px"><span class="av-img">${inner}</span>${b ? '<span class="av-ring"></span>' + (DECO[b] || '') : ''}${dot}</span>`;
}
export function gradCss(g) { return g && g.colors ? `linear-gradient(${g.angle ?? 90}deg, ${g.colors.join(', ')})` : ''; }
export function nameTag(u, cls = '') {
  const g = u && u.turbo && u.name_grad;
  return `<span class="nm ${g ? 'grad' : ''} ${cls}"${g ? ` style="--g:${gradCss(g)}"` : ''}>${esc(u ? (u.display_name || u.username) : '')}</span>`;
}
export function badges(u, opts = {}) {
  const out = [];
  if (u.turbo) out.push(`<span class="badge turbo" title="ProMouser Turbo">${icon('turbo')}Turbo</span>`);
  if (u.plan === 'ultra') out.push('<span class="badge ultra" title="ProMouser Ultra">Ultra</span>'); else if (u.plan === 'lite') out.push('<span class="badge lite" title="ProMouser Lite">Lite</span>');
  if (opts.level !== false && u.level) out.push(`<span class="badge lvl">Lv ${u.level}</span>`);
  return out.join('');
}
export const personLink = u => `profile.html?u=${encodeURIComponent(u.username)}`;
export function rarityTag(it) { const r = RARITY[it.rarity]; return `<span class="rar ${it.rarity}" style="--rc:${r.color}">${r.name}</span>`; }

/* ---------- toast, modal ---------- */
export function toast(html, opts = {}) {
  let host = $('#toasts'); if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  const t = document.createElement('div'); t.className = 'toast ' + (opts.kind || ''); t.innerHTML = html; host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  const kill = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); };
  t.addEventListener('click', e => { if (!e.target.closest('a,button')) kill(); });
  setTimeout(kill, opts.ms || 4200);
  return t;
}
let lastFocus = null;
export function modal(html, opts = {}) {
  closeModal(true);
  lastFocus = document.activeElement;
  const o = document.createElement('div'); o.className = 'modal-wrap'; o.id = 'modal';
  o.innerHTML = `<div class="modal ${opts.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.label || 'Dialog')}"><button class="modal-x" type="button" aria-label="Close">${icon('x')}</button><div class="modal-body">${html}</div></div>`;
  document.body.appendChild(o); requestAnimationFrame(() => o.classList.add('in'));
  o.addEventListener('mousedown', e => { if (e.target === o && !opts.sticky) closeModal(); });
  $('.modal-x', o).addEventListener('click', () => closeModal());
  const f = $('input,button:not(.modal-x),a', $('.modal-body', o)); f && f.focus();
  opts.onClose && (o._onClose = opts.onClose);
  return $('.modal-body', o);
}
export function closeModal(silent) {
  const o = $('#modal'); if (!o) return;
  o.id = ''; o.classList.remove('in'); setTimeout(() => o.remove(), 200);
  if (!silent && o._onClose) o._onClose();
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal')) closeModal(); });

/* ---------- errors people understand ---------- */
const ERR = {
  NOT_SIGNED_IN: 'Please sign in first.', BAD_LOGIN: 'That email and password don’t match.', EMAIL_TAKEN: 'There’s already an account with that email. Sign in instead.',
  WEAK_PASSWORD: 'Use at least 8 characters for your password.', BAD_EMAIL: 'That email doesn’t look right.', BAD_NAME: 'Names are 1–32 characters.',
  EMAIL_NOT_CONFIRMED: 'Confirm your email first: check your inbox for the link.', BAD_USERNAME: 'Usernames are 3–20 letters, numbers or underscores.',
  USERNAME_TAKEN: 'That username is taken.', NOT_OWNED: 'You don’t own that item yet.', TURBO_REQUIRED: 'That needs ProMouser Turbo.', BAD_GRADIENT: 'Pick 2 or 3 colours.',
  ALREADY_CLAIMED: 'Already claimed.', NO_SUCH_USER: 'No player with that username.', CANNOT_ADD_SELF: 'That’s you!', SLOW_DOWN: 'Slow down a little and try again.',
  NOT_FRIENDS: 'You can only message friends.', BAD_MESSAGE: 'Messages are 1–500 characters.', LOBBY_NOT_FOUND: 'That lobby doesn’t exist or has closed.',
  LOBBY_FULL: 'That lobby is full.', NOT_HOST: 'Only the host can do that.', BAD_SCORE: 'That score couldn’t be saved.', NOT_ENOUGH_COINS: 'Not enough coins yet. Play a few games!',
  ALREADY_OWNED: 'You already own that.', TIER_LOCKED: 'Reach that tier first.', NETWORK: 'Can’t reach the server. Check your connection.', IMAGE_TOO_BIG: 'That image is too big.',
  PAYMENTS_NOT_LIVE: 'Payments aren’t switched on yet.', STORAGE_FULL: 'Your browser storage is full.', BAD_INPUT: 'Please check what you entered.'
};
export const errText = e => ERR[e && (e.code || e.message)] || (e && e.message) || 'Something went wrong.';

/* ---------- state ---------- */
export const state = { me: null, page: '' };
const meFns = new Set();
export const onMe = fn => { meFns.add(fn); return () => meFns.delete(fn); };
let refreshing = null;
export function refresh() {
  if (refreshing) return refreshing;
  let done; const run = refreshing = new Promise(r => { done = r; });   // claim the slot before any work, so re-entrant calls share this run
  (async () => {
    try { state.me = api.signedIn() ? await api.me() : null; } catch (e) { if ((e.code || e.message) === 'NOT_SIGNED_IN') state.me = null; else console.warn(e); }
    if (refreshing === run) refreshing = null;
    paintTop(); meFns.forEach(f => f(state.me));
    done(state.me);
  })();
  return run;
}

/* ---------- auth ---------- */
export function authModal(mode = 'signin') {
  const body = modal(`<div class="auth">
    <div class="auth-logo">${logo()}</div>
    <div class="tabs" role="tablist"><button type="button" data-m="signin" role="tab">Sign in</button><button type="button" data-m="signup" role="tab">Create account</button></div>
    <form class="auth-form" novalidate>
      <label class="f su">Name<input name="name" autocomplete="nickname" maxlength="32" required></label>
      <label class="f">Email<input name="email" type="email" autocomplete="email" required></label>
      <label class="f">Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
      <p class="f-err" role="alert"></p>
      <button class="btn primary wide" type="submit">Sign in</button>
    </form>
    <p class="auth-note">${icon('users')}<span><b>One account, two sites.</b> Your ProMouser Online account is also a <a href="${PROMOUSER_URL}" target="_blank" rel="noopener">ProMouser</a> account. Already have one? Just sign in with it and your ProMouser stats come with you.</span></p>
    ${api.mode === 'demo' ? '<p class="auth-demo">Demo mode: accounts live in this browser only. Each tab can be signed in as a different player, so you can try friends, chat and lobbies with yourself.</p>' : ''}
  </div>`, { label: 'Sign in', cls: 'narrow' });
  const form = $('.auth-form', body);
  const set = m => {
    mode = m; $$('.tabs button', body).forEach(b => b.setAttribute('aria-selected', String(b.dataset.m === m)));
    $('.su', body).hidden = m !== 'signup'; $('[type=submit]', body).textContent = m === 'signup' ? 'Create account' : 'Sign in';
    $('[name=password]', body).autocomplete = m === 'signup' ? 'new-password' : 'current-password'; $('.f-err', body).textContent = '';
  };
  $$('.tabs button', body).forEach(b => b.addEventListener('click', () => set(b.dataset.m))); set(mode);
  form.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(form), btn = $('[type=submit]', form); btn.disabled = true; $('.f-err', body).textContent = '';
    try {
      if (mode === 'signup') { const r = await api.signUp({ name: f.get('name'), email: f.get('email'), password: f.get('password') }); if (r && r.confirm) { body.innerHTML = `<div class="auth center"><h2>Check your email</h2><p>We sent a confirmation link to <b>${esc(f.get('email'))}</b>. Click it, then come back and sign in.</p></div>`; return; } }
      else await api.signIn({ email: f.get('email'), password: f.get('password') });
      closeModal(true); await refresh(); toast(`${icon('check')} Welcome${state.me ? ', ' + esc(state.me.display_name) : ''}!`, { kind: 'ok' });
      document.dispatchEvent(new CustomEvent('pmo:auth'));
    } catch (x) { $('.f-err', body).textContent = errText(x); btn.disabled = false; }
  });
}
export const logo = () => `<span class="logo"><img src="assets/logo.svg" alt="" width="30" height="30"><span>ProMouser <b>Online</b></span></span>`;

/* ---------- checkout (₹ items and Turbo) ---------- */
export function checkout(products, onDone) {
  const total = products.reduce((a, p) => a + p.price, 0);
  const body = modal(`<div class="co"><h2>Checkout</h2>
    <ul class="co-lines">${products.map(p => `<li><span>${esc(p.name)}</span><b>${inr(p.price)}</b></li>`).join('')}<li class="tot"><span>Total</span><b>${inr(total)}</b></li></ul>
    <p class="muted small">${api.mode === 'demo' ? 'Demo checkout: nothing is charged. Purchases are saved in this browser.' : 'Test payments: nothing is charged until Razorpay is connected. Purchases go to your shared ProMouser account.'}</p>
    <div class="row end"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="coPay">Pay ${inr(total)}</button></div></div>`, { label: 'Checkout', cls: 'narrow' });
  $('[data-close]', body).addEventListener('click', () => closeModal());
  $('#coPay', body).addEventListener('click', async e => {
    e.target.disabled = true; e.target.textContent = 'Processing…';
    try { await api.checkout(products); await refresh(); closeModal(true); toast(`${icon('check')} Payment complete. Enjoy!`, { kind: 'ok' }); onDone && onDone(); }
    catch (x) { e.target.disabled = false; e.target.textContent = 'Try again'; toast(errText(x), { kind: 'bad' }); }
  });
}
export const buyTurbo = done => checkout([TURBO_PRODUCT], done);
export const buyItem = (it, done) => checkout([itemProduct(it)], done);

/* ---------- shell ---------- */
const NAV = [['index.html', 'home', 'Home'], ['play.html', 'play', 'Play'], ['lobbies.html', 'lobby', 'Lobbies'], ['friends.html', 'friends', 'Friends'], ['shop.html', 'shop', 'Shop'], ['pass.html', 'pass', 'Pass']];
function paintTop() {
  const me = state.me, slot = $('#topUser'); if (!slot) return;
  if (!me) { slot.innerHTML = `<button class="btn primary sm" type="button" data-auth="signin">Sign in</button>`; $$('.nav-badge').forEach(b => { b.hidden = true; }); return; }
  slot.innerHTML = `
    <a class="pill coins" href="shop.html" title="Your coins">${icon('coin')}<b id="coinCount">${num(me.coins)}</b></a>
    ${me.turbo ? `<a class="pill turbo on" href="turbo.html" title="Turbo active">${icon('turbo')}Turbo</a>` : `<a class="pill turbo" href="turbo.html">${icon('turbo')}Get Turbo</a>`}
    <div class="me-menu"><button class="me-btn" type="button" aria-haspopup="true" aria-expanded="false" id="meBtn">${avatar(me, 34)}</button>
      <div class="me-dd" id="meDd" hidden>
        <div class="me-head">${avatar(me, 44)}<div>${nameTag(me)}<small>@${esc(me.username)}</small></div></div>
        <a href="${personLink(me)}">${icon('user')}My profile</a><a href="settings.html">${icon('gear')}Settings</a><a href="${PROMOUSER_URL}account.html" target="_blank" rel="noopener">${icon('external')}ProMouser account</a>
        <button type="button" data-auth="signout">${icon('out')}Sign out</button></div></div>`;
  const fb = $('[data-nav="friends.html"] .nav-badge'); if (fb) { const n = (me.unread || 0) + (me.requests || 0); fb.hidden = !n; fb.textContent = n > 9 ? '9+' : n; }
  const btn = $('#meBtn'), dd = $('#meDd');
  btn.addEventListener('click', e => { e.stopPropagation(); dd.hidden = !dd.hidden; btn.setAttribute('aria-expanded', String(!dd.hidden)); });
}
document.addEventListener('click', e => {
  const dd = $('#meDd'); if (dd && !dd.hidden && !e.target.closest('.me-menu')) { dd.hidden = true; $('#meBtn').setAttribute('aria-expanded', 'false'); }
  const a = e.target.closest('[data-auth]'); if (!a) return;
  e.preventDefault();
  if (a.dataset.auth === 'signout') { api.signOut().then(() => { location.href = 'index.html'; }); return; }
  authModal(a.dataset.auth === 'signup' ? 'signup' : 'signin');
});

function friendsPanel() {
  const host = $('#sideFriends'); if (!host) return;
  let list = [];
  const paint = () => {
    if (!state.me) { host.innerHTML = '<p class="muted small">Sign in to see your friends here.</p>'; return; }
    const on = onlineIds(), fr = list.filter(f => f.status === 'friends').sort((a, b) => on.has(b.user_id) - on.has(a.user_id));
    host.innerHTML = fr.length ? fr.map(f => `<a class="side-friend" href="friends.html?with=${f.user_id}">${avatar(f, 34, { status: on.has(f.user_id) ? 'on' : 'off' })}<span>${nameTag(f)}<small>${on.has(f.user_id) ? esc(statusOf(f.user_id) || 'Online') : 'Offline'}</small></span>${f.unread ? `<i class="unread">${f.unread}</i>` : ''}</a>`).join('')
      : `<p class="muted small">No friends yet. <a href="friends.html">Find players</a>.</p>`;
  };
  const load = async () => { if (state.me) { try { list = await api.friends(); } catch (e) { /* offline */ } } paint(); };
  onOnline(paint); onMe(load); document.addEventListener('pmo:friends', load); load();
}

const STATUS = { 'game.html': 'In a game', 'lobby.html': 'In a lobby' };
/* boot a page: draws the shell, signs in, then calls render(view, me) */
export async function boot({ page, title, gated = true, render, wide = false }) {
  if (document.querySelector('.app')) return;   // one page shell per document
  state.page = page;
  document.body.insertAdjacentHTML('afterbegin', `
    <a class="skip" href="#view">Skip to content</a>
    <div class="app ${wide ? 'wide' : ''}">
      <nav class="rail" aria-label="Main">
        <a class="rail-logo" href="index.html" aria-label="ProMouser Online home"><img src="assets/logo.svg" alt="" width="36" height="36"></a>
        ${NAV.map(([h, i, t]) => `<a class="rail-link ${page === h ? 'on' : ''}" href="${h}" data-nav="${h}" ${page === h ? 'aria-current="page"' : ''}>${icon(i)}<span>${t}</span>${h === 'friends.html' ? '<i class="nav-badge" hidden></i>' : ''}</a>`).join('')}
        <div class="rail-foot"><a class="rail-link" href="${PROMOUSER_URL}" target="_blank" rel="noopener" title="Back to ProMouser">${icon('mouse')}<span>ProMouser</span></a></div>
      </nav>
      <div class="main">
        <header class="top"><h1 class="top-title">${esc(title)}</h1>
          <form class="top-search" role="search" action="friends.html"><label class="sr" for="topQ">Find players</label>${icon('search')}<input id="topQ" name="q" placeholder="Find players" autocomplete="off" maxlength="20"></form>
          <div class="top-user" id="topUser"></div></header>
        <main id="view" class="view" tabindex="-1"><div class="loading"><span class="spin"></span></div></main>
      </div>
      <aside class="side" aria-label="Friends"><h2>Friends</h2><div id="sideFriends"></div></aside>
    </div>`);
  try { await api.ready; } catch (e) { $('#view').innerHTML = `<div class="empty"><h2>Can’t connect</h2><p>${esc(e.message)}</p></div>`; return; }
  await refresh();
  friendsPanel();
  const go = async () => {
    const view = $('#view');
    if (gated && !state.me) { view.innerHTML = signInWall(); return; }
    try { await render(view, state.me); } catch (e) { console.error(e); view.innerHTML = `<div class="empty"><h2>Something went wrong</h2><p>${esc(errText(e))}</p></div>`; }
  };
  await go();
  document.addEventListener('pmo:auth', go);
  if (state.me) live();
  api.on(() => { if (!!state.me !== api.signedIn()) refresh().then(go); });
}
const signInWall = () => `<div class="wall"><div class="wall-card">${icon('lock')}<h2>Sign in to play</h2><p>Use your ProMouser account, or create one in seconds. It works on both sites.</p>
  <div class="row center"><button class="btn primary" type="button" data-auth="signup">Create account</button><button class="btn ghost" type="button" data-auth="signin">Sign in</button></div></div></div>`;

/* presence + inbox: DMs, friend requests and invites arrive while you browse */
let lived = false;
function live() {
  if (lived) return; lived = true;
  presence({ status: STATUS[state.page] || 'Online', username: state.me.username });
  listen({
    dm: async d => { await refresh(); document.dispatchEvent(new CustomEvent('pmo:dm', { detail: d })); if (!(state.page === 'friends.html' && new URLSearchParams(location.search).get('with') === d.from)) toast(`${icon('chat')} New message from <b>${esc(d.name || 'a friend')}</b> · <a href="friends.html?with=${esc(d.from)}">Open</a>`); },
    friend: async d => { await refresh(); document.dispatchEvent(new CustomEvent('pmo:friends')); toast(d.accepted ? `${icon('check')} <b>${esc(d.name)}</b> accepted your friend request` : `${icon('friends')} <b>${esc(d.name)}</b> sent you a friend request · <a href="friends.html">View</a>`); },
    invite: d => toast(`${icon('lobby')} <b>${esc(d.name)}</b> invited you to <b>${esc(d.lobby)}</b> <button class="btn primary xs" type="button" data-join="${esc(d.code)}">Join</button>`, { ms: 12000 })
  });
}
export function setStatus(status) { if (state.me) presence({ status, username: state.me.username }); }
document.addEventListener('click', async e => {
  const j = e.target.closest('[data-join]'); if (!j) return;
  try { const l = await api.lobbyJoin(j.dataset.join); location.href = 'lobby.html?id=' + l.id; } catch (x) { toast(errText(x), { kind: 'bad' }); }
});
export { ping, api, itemById, levelOf, xpForLevel };
window.PMO = { api, state, refresh };   // handy in the console and for automated tests
