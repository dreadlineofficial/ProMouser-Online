/* =====================================================================
   ProMouser Online: demo backend (no Supabase keys)
   The same API as api-sb.js, stored in this browser's localStorage and
   following the same rules as supabase/online.sql.
   Each browser TAB can be signed in as a different player, and tabs talk
   to each other (net.js), so lobbies, chat and duels can be tried locally.
   ===================================================================== */
import { ITEMS, itemById, FREE_ITEMS, TURBO_ITEMS, BP_REWARDS, BP_TIER_XP, SCORE_LIMIT, START_COINS, DAILY_COIN_CAP, gameById, coinsFor, xpFor, levelOf, TURBO_PRODUCT } from './data.js';

const DB_KEY = 'pmo_db', TAB_KEY = 'pmo_uid', LAST_KEY = 'pmo_last_uid', DAY = 864e5;
const bus = 'BroadcastChannel' in window ? new BroadcastChannel('pmo_db') : null;
const listeners = new Set();
const fail = code => { const e = new Error(code); e.code = code; throw e; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const today = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);   // India date, like o_today()
const sleep = ms => new Promise(r => setTimeout(r, ms));

function load() {
  try { return Object.assign({ users: {}, profiles: {}, inv: {}, friends: [], messages: [], lobbies: {}, members: [], results: [], seq: 1 }, JSON.parse(localStorage.getItem(DB_KEY) || '{}')); }
  catch (e) { return { users: {}, profiles: {}, inv: {}, friends: [], messages: [], lobbies: {}, members: [], results: [], seq: 1 }; }
}
function tx(fn, silent) {
  const db = load(), r = fn(db);
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { fail('STORAGE_FULL'); }
  if (!silent) { bus && bus.postMessage('db'); notify(); }
  return r;
}
const read = fn => fn(load());
const notify = () => listeners.forEach(f => { try { f(); } catch (e) { /* listener error */ } });
bus && (bus.onmessage = () => notify());
addEventListener('storage', e => { if (e.key === DB_KEY) notify(); });

let me = sessionStorage.getItem(TAB_KEY) || localStorage.getItem(LAST_KEY) || null;
if (me && !read(db => db.users[me])) me = null;
const setMe = id => { me = id; if (id) { sessionStorage.setItem(TAB_KEY, id); localStorage.setItem(LAST_KEY, id); } else { sessionStorage.removeItem(TAB_KEY); localStorage.removeItem(LAST_KEY); } notify(); };
const need = () => me || fail('NOT_SIGNED_IN');

async function hash(pw, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 60000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- the same rules as the SQL helpers ---------- */
const turboOn = (db, id) => (db.users[id] && db.users[id].turboUntil || 0) > Date.now();
const owns = (db, id, item) => (db.inv[id] || []).some(x => x.item === item);
const give = (db, id, item, source) => { db.inv[id] = db.inv[id] || []; if (!owns(db, id, item)) db.inv[id].push({ item, source, at: Date.now() }); };
function ensure(db, id) {
  if (db.profiles[id]) return db.profiles[id];
  const u = db.users[id] || fail('NO_PROFILE');
  let base = u.name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14); if (base.length < 3) base = 'player';
  let un; do { un = base + (1000 + Math.floor(Math.random() * 9000)); } while (Object.values(db.profiles).some(p => p.username.toLowerCase() === un));
  db.profiles[id] = { user_id: id, username: un, display_name: u.name.slice(0, 32), bio: '', avatar_url: null, border: 'b-clean', showcase: 'm-starter', name_grad: null, theme: null,
    coins: START_COINS, xp: 0, bp_season: 1, bp_xp: 0, bp_claims: { free: [], turbo: [] }, stats: {}, coins_day: null, coins_today: 0, daily_day: null, daily_streak: 0, created_at: new Date().toISOString(), last_seen: Date.now() };
  FREE_ITEMS.forEach(it => give(db, id, it, 'free'));
  return db.profiles[id];
}
function card(db, id) {
  const o = db.profiles[id], u = db.users[id]; if (!o) return null; const t = turboOn(db, id);
  return { user_id: id, username: o.username, display_name: o.display_name, avatar_url: o.avatar_url, border: o.border, level: levelOf(o.xp), turbo: t, name_grad: t ? o.name_grad : null, plan: u.plan || 'free', last_seen: new Date(o.last_seen).toISOString(), showcase: o.showcase };
}
function friendStatus(db, a, b) {
  const f = db.friends.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  return !f ? 'none' : f.status === 'accepted' ? 'friends' : f.a === a ? 'outgoing' : 'incoming';
}
const validGrad = g => g == null || (typeof g === 'object' && Array.isArray(g.colors) && g.colors.length >= 2 && g.colors.length <= 3 && g.colors.every(c => /^#[0-9a-fA-F]{6}$/.test(c)) && (g.angle == null || (g.angle >= 0 && g.angle <= 360)));
function meJson(db, id) {
  const o = ensure(db, id), u = db.users[id], t = turboOn(db, id);
  if (t) TURBO_ITEMS.forEach(it => give(db, id, it, 'turbo'));
  return { user_id: id, email: u.email, username: o.username, display_name: o.display_name, bio: o.bio, avatar_url: o.avatar_url, border: o.border, showcase: o.showcase,
    name_grad: o.name_grad, theme: o.theme, coins: o.coins, xp: o.xp, level: levelOf(o.xp), bp_season: o.bp_season, bp_xp: o.bp_xp, bp_claims: o.bp_claims,
    stats: o.stats, created_at: o.created_at, coins_today: o.coins_day === today() ? o.coins_today : 0, daily_claimed: o.daily_day === today(), daily_streak: o.daily_streak,
    turbo: t, turbo_until: u.turboUntil ? new Date(u.turboUntil).toISOString() : null, inventory: (db.inv[id] || []).map(x => x.item),
    promouser: { name: u.name, plan: u.plan || 'free', member_since: new Date(u.createdAt).toISOString(), cps_best: u.cpsBest || {}, recommendations: 0 },
    unread: db.messages.filter(m => m.recipient === id && !m.read).length, requests: db.friends.filter(f => f.b === id && f.status === 'pending').length };
}
const lobbyJson = (db, lid) => { const l = db.lobbies[lid]; return l && { ...l, members: db.members.filter(m => m.lobby === lid).sort((a, b) => a.at - b.at).map(m => card(db, m.user)) }; };
function leaveAll(db, id, except) {
  db.members.filter(m => m.user === id && m.lobby !== except).forEach(m => {
    db.members = db.members.filter(x => !(x.lobby === m.lobby && x.user === id));
    const l = db.lobbies[m.lobby], rest = db.members.filter(x => x.lobby === m.lobby).sort((a, b) => a.at - b.at);
    if (!rest.length) l.status = 'closed'; else if (l.host === id) l.host = rest[0].user;
    l.updated_at = new Date().toISOString();
  });
}
const MP = ['arena', 'cps-duel', 'reaction-duel', 'aim-rush', 'tracking', 'royale'];

/* ---------- the API ---------- */
export const api = {
  mode: 'demo',
  ready: Promise.resolve(),
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  userId: () => me,
  signedIn: () => !!me,

  async signUp({ name, email, password }) {
    email = String(email || '').trim().toLowerCase(); name = String(name || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) fail('BAD_EMAIL'); if (String(password || '').length < 8) fail('WEAK_PASSWORD'); if (!name) fail('BAD_NAME');
    if (read(db => Object.values(db.users).some(u => u.email === email))) fail('EMAIL_TAKEN');
    const id = uid(), salt = uid(), pwHash = await hash(password, salt);
    tx(db => { db.users[id] = { id, email, name: name.slice(0, 60), salt, pwHash, createdAt: Date.now(), plan: 'free' }; ensure(db, id); });
    setMe(id); return { confirm: false };
  },
  async signIn({ email, password }) {
    email = String(email || '').trim().toLowerCase();
    const u = read(db => Object.values(db.users).find(x => x.email === email));
    await sleep(150);
    if (!u || (await hash(password, u.salt)) !== u.pwHash) fail('BAD_LOGIN');
    setMe(u.id);
  },
  async signOut() { setMe(null); },

  async me() { if (!me) return null; return tx(db => { const o = ensure(db, me); o.last_seen = Date.now(); return meJson(db, me); }, true); },   // silent: reading yourself isn't a change
  async setProfile(p) {
    const id = need();
    return tx(db => {
      const o = ensure(db, id), t = turboOn(db, id);
      if ('username' in p) {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(p.username)) fail('BAD_USERNAME');
        if (Object.values(db.profiles).some(x => x.user_id !== id && x.username.toLowerCase() === p.username.toLowerCase())) fail('USERNAME_TAKEN');
        o.username = p.username;
      }
      if ('display_name' in p) { const n = String(p.display_name || '').trim(); if (!n || n.length > 32) fail('BAD_NAME'); o.display_name = n; }
      if ('bio' in p) o.bio = String(p.bio || '').slice(0, 160);
      if ('avatar_url' in p) { if (p.avatar_url && !/^(https?:|data:image\/)/.test(p.avatar_url)) fail('BAD_AVATAR'); o.avatar_url = p.avatar_url || null; }
      if ('border' in p) { if (p.border && !(owns(db, id, p.border) && itemById[p.border].kind === 'border')) fail('NOT_OWNED'); o.border = p.border || null; }
      if ('showcase' in p) { if (p.showcase && !(owns(db, id, p.showcase) && itemById[p.showcase].kind === 'mouse')) fail('NOT_OWNED'); o.showcase = p.showcase || null; }
      if ('name_grad' in p || 'theme' in p) {
        if (!t && (p.name_grad || p.theme)) fail('TURBO_REQUIRED');
        if (!validGrad(p.name_grad) || !validGrad(p.theme)) fail('BAD_GRADIENT');
        if ('name_grad' in p) o.name_grad = p.name_grad || null; if ('theme' in p) o.theme = p.theme || null;
      }
      return meJson(db, id);
    });
  },
  // demo: the picture is stored as a small data URL (Supabase mode uploads to Storage)
  async uploadAvatar(blob) {
    need();
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
    if (url.length > 400000) fail('IMAGE_TOO_BIG');
    return url;
  },
  async daily() {
    const id = need();
    return tx(db => {
      const o = ensure(db, id); if (o.daily_day === today()) fail('ALREADY_CLAIMED');
      const y = new Date(Date.now() + 5.5 * 36e5 - DAY).toISOString().slice(0, 10);
      o.daily_streak = o.daily_day === y ? Math.min(o.daily_streak + 1, 7) : 1;
      const bonus = 40 + o.daily_streak * 10; o.coins += bonus; o.daily_day = today();
      return { coins: bonus, streak: o.daily_streak };
    });
  },

  async profile(username) {
    const id = need();
    return read(db => {
      const o = Object.values(db.profiles).find(x => x.username.toLowerCase() === String(username).toLowerCase()) || fail('NO_SUCH_USER');
      const u = db.users[o.user_id], t = turboOn(db, o.user_id);
      return { ...card(db, o.user_id), bio: o.bio, showcase: o.showcase, theme: t ? o.theme : null, stats: o.stats, xp: o.xp, created_at: o.created_at,
        cps_best: u.cpsBest || {}, member_since: new Date(u.createdAt).toISOString(), friend: friendStatus(db, id, o.user_id), me: o.user_id === id,
        items: (db.inv[o.user_id] || []).map(x => x.item),
        recent: db.results.filter(r => r.user === o.user_id).slice(-8).reverse().map(r => ({ game: r.game, score: r.score, won: r.won, created_at: new Date(r.at).toISOString() })) };
    });
  },
  async search(q) {
    const id = need(); q = String(q || '').replace(/[^A-Za-z0-9_]/g, '').toLowerCase(); if (q.length < 2) return [];
    return read(db => Object.values(db.profiles).filter(p => p.user_id !== id && p.username.toLowerCase().startsWith(q)).sort((a, b) => a.username.length - b.username.length).slice(0, 10)
      .map(p => ({ ...card(db, p.user_id), friend: friendStatus(db, id, p.user_id) })));
  },
  async friends() {
    const id = need();
    return tx(db => { ensure(db, id); return db.friends.filter(f => f.a === id || f.b === id).map(f => {
      const other = f.a === id ? f.b : f.a, msgs = db.messages.filter(m => (m.sender === other && m.recipient === id) || (m.sender === id && m.recipient === other));
      return { ...card(db, other), status: f.status === 'accepted' ? 'friends' : f.a === id ? 'outgoing' : 'incoming', unread: msgs.filter(m => m.recipient === id && !m.read).length,
        last_msg: msgs.length ? new Date(msgs[msgs.length - 1].at).toISOString() : null };
    }).filter(x => x.username).sort((a, b) => (a.status !== 'incoming') - (b.status !== 'incoming') || (b.last_msg || '').localeCompare(a.last_msg || '') || a.username.localeCompare(b.username)); });
  },
  async friendAdd(other) {
    const id = need(); if (other === id) fail('CANNOT_ADD_SELF');
    return tx(db => {
      if (!db.profiles[other]) fail('NO_SUCH_USER');
      const st = friendStatus(db, id, other);
      if (st === 'incoming') { db.friends.find(f => f.a === other && f.b === id).status = 'accepted'; return 'friends'; }
      if (st === 'none') { db.friends.push({ a: id, b: other, status: 'pending', at: Date.now() }); return 'outgoing'; }
      return st;
    });
  },
  async friendRemove(other) { const id = need(); tx(db => { db.friends = db.friends.filter(f => !((f.a === id && f.b === other) || (f.a === other && f.b === id))); }); },
  async dmList(other) {
    const id = need();
    return tx(db => {
      db.messages.forEach(m => { if (m.sender === other && m.recipient === id) m.read = true; });
      return db.messages.filter(m => (m.sender === id && m.recipient === other) || (m.sender === other && m.recipient === id)).slice(-60)
        .map(m => ({ id: m.id, sender: m.sender, recipient: m.recipient, body: m.body, created_at: new Date(m.at).toISOString(), read_at: m.read ? 1 : null }));
    });
  },
  async dmSend(other, body) {
    const id = need(), b = String(body || '').trim();
    return tx(db => {
      if (friendStatus(db, id, other) !== 'friends') fail('NOT_FRIENDS');
      if (!b || b.length > 500) fail('BAD_MESSAGE');
      if (db.messages.filter(m => m.sender === id && m.at > Date.now() - 10000).length >= 8) fail('SLOW_DOWN');
      const m = { id: db.seq++, sender: id, recipient: other, body: b, at: Date.now(), read: false }; db.messages.push(m);
      if (db.messages.length > 3000) db.messages = db.messages.slice(-2500);
      return { id: m.id, sender: id, recipient: other, body: b, created_at: new Date(m.at).toISOString(), read_at: null };
    });
  },

  async lobbies() {
    need();
    return read(db => Object.values(db.lobbies).filter(l => l.is_public && l.status !== 'closed' && Date.parse(l.updated_at) > Date.now() - 3 * 36e5 && db.members.some(m => m.lobby === l.id))
      .sort((a, b) => (a.status === 'playing') - (b.status === 'playing') || b.updated_at.localeCompare(a.updated_at)).slice(0, 50)
      .map(l => ({ id: l.id, code: l.code, game: l.game, name: l.name, status: l.status, max_players: l.max_players, players: db.members.filter(m => m.lobby === l.id).length, host: card(db, l.host), updated_at: l.updated_at })));
  },
  async lobbyCreate({ game, name, isPublic = true, max = 8, settings = {} }) {
    const id = need(); if (!MP.includes(game)) fail('BAD_GAME');
    return tx(db => {
      ensure(db, id); leaveAll(db, id);
      let code; do { code = Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join(''); } while (Object.values(db.lobbies).some(l => l.code === code));
      const lid = uid(), now = new Date().toISOString();
      db.lobbies[lid] = { id: lid, code, host: id, game, name: String(name || '').trim().slice(0, 40) || 'Lobby', is_public: !!isPublic, max_players: Math.min(16, Math.max(2, +max || 8)), status: 'open', settings, round: 0, created_at: now, updated_at: now };
      db.members.push({ lobby: lid, user: id, at: Date.now() });
      return lobbyJson(db, lid);
    });
  },
  async lobbyJoin(code) {
    const id = need();
    return tx(db => {
      ensure(db, id);
      const l = Object.values(db.lobbies).find(x => x.code === String(code).trim().toUpperCase() || x.id === code);
      if (!l || l.status === 'closed') fail('LOBBY_NOT_FOUND');
      if (db.members.some(m => m.lobby === l.id && m.user === id)) return lobbyJson(db, l.id);
      if (db.members.filter(m => m.lobby === l.id).length >= l.max_players) fail('LOBBY_FULL');
      leaveAll(db, id, l.id); db.members.push({ lobby: l.id, user: id, at: Date.now() }); l.updated_at = new Date().toISOString();
      return lobbyJson(db, l.id);
    });
  },
  async lobbyLeave(lid) {
    const id = need();
    tx(db => {
      const l = db.lobbies[lid]; if (!l) return;
      db.members = db.members.filter(m => !(m.lobby === lid && m.user === id));
      const rest = db.members.filter(m => m.lobby === lid).sort((a, b) => a.at - b.at);
      if (!rest.length) l.status = 'closed'; else if (l.host === id) l.host = rest[0].user;
      l.updated_at = new Date().toISOString();
    });
  },
  async lobby(lid) {
    const id = need();
    return read(db => { const l = db.lobbies[lid]; if (!l || (!l.is_public && !db.members.some(m => m.lobby === lid && m.user === id))) fail('LOBBY_NOT_FOUND'); return lobbyJson(db, lid); });
  },
  async lobbyUpdate(lid, p) {
    const id = need();
    return tx(db => {
      const l = db.lobbies[lid]; if (!l || l.host !== id) fail('NOT_HOST');
      if (p.game && !MP.includes(p.game)) fail('BAD_GAME'); if (p.status && !['open', 'playing'].includes(p.status)) fail('BAD_STATUS');
      if (p.status === 'playing' && l.status !== 'playing') l.round++;
      const n = db.members.filter(m => m.lobby === lid).length;
      Object.assign(l, { game: p.game || l.game, name: (p.name || '').trim().slice(0, 40) || l.name, is_public: p.is_public ?? l.is_public,
        max_players: Math.max(Math.min(p.max_players ?? l.max_players, 16), 2, n), settings: p.settings || l.settings, status: p.status || l.status, updated_at: new Date().toISOString() });
      return lobbyJson(db, lid);
    });
  },
  async lobbyKick(lid, other) {
    const id = need();
    return tx(db => { const l = db.lobbies[lid]; if (!l || l.host !== id) fail('NOT_HOST'); if (other === id) fail('CANNOT_KICK_SELF'); db.members = db.members.filter(m => !(m.lobby === lid && m.user === other)); return lobbyJson(db, lid); });
  },

  async submit(game, score, won = false, lobby = null) {
    const id = need(), lim = SCORE_LIMIT[game], low = !!(gameById[game] || {}).low;
    if (lim == null) fail('BAD_GAME'); if (!(score >= 0 && score <= lim) || (low && score < 80)) fail('BAD_SCORE');
    return tx(db => {
      const o = ensure(db, id);
      if (db.results.some(r => r.user === id && r.game === game && r.at > Date.now() - 5000)) fail('SLOW_DOWN');
      if (o.coins_day !== today()) { o.coins_day = today(); o.coins_today = 0; }
      const c = Math.max(0, Math.min(coinsFor(game, score, won), DAILY_COIN_CAP - o.coins_today)), x = xpFor(c, won), lvl = levelOf(o.xp);
      const st = o.stats[game] || {}, best = st.best;
      o.stats[game] = { played: (st.played || 0) + 1, wins: (st.wins || 0) + (won ? 1 : 0), best: best == null ? score : low ? Math.min(best, score) : Math.max(best, score) };
      o.coins += c; o.coins_today += c; o.xp += x; o.bp_xp += x;
      db.results.push({ user: id, game, score, won: !!won, lobby, coins: c, at: Date.now() }); if (db.results.length > 4000) db.results = db.results.slice(-3000);
      return { coins: c, xp: x, capped: o.coins_today >= DAILY_COIN_CAP, level: levelOf(o.xp), level_up: levelOf(o.xp) > lvl, best: o.stats[game].best,
        new_best: best == null || (low ? score < best : score > best), bp_tier: Math.min(30, Math.floor(o.bp_xp / BP_TIER_XP)) };
    });
  },
  async leaderboard(game) {
    need(); const low = !!(gameById[game] || {}).low;
    return read(db => {
      const best = {}; db.results.filter(r => r.game === game).forEach(r => { if (best[r.user] == null || (low ? r.score < best[r.user] : r.score > best[r.user])) best[r.user] = r.score; });
      return Object.entries(best).sort((a, b) => (low ? a[1] - b[1] : b[1] - a[1])).slice(0, 20).map(([u, s]) => ({ ...card(db, u), score: s })).filter(x => x.username);
    });
  },
  async buy(item) {
    const id = need();
    return tx(db => {
      const it = itemById[item]; if (!it || it.coins == null) fail('NOT_FOR_COINS'); if (owns(db, id, item)) fail('ALREADY_OWNED');
      const o = ensure(db, id); if (o.coins < it.coins) fail('NOT_ENOUGH_COINS');
      o.coins -= it.coins; give(db, id, item, 'coins'); return meJson(db, id);
    });
  },
  async claimTier(track, tier) {
    const id = need();
    return tx(db => {
      const o = ensure(db, id), r = BP_REWARDS.find(x => x.track === track && x.tier === tier) || fail('NO_REWARD');
      if (Math.floor(o.bp_xp / BP_TIER_XP) < tier) fail('TIER_LOCKED'); if (track === 'turbo' && !turboOn(db, id)) fail('TURBO_REQUIRED');
      if (o.bp_claims[track].includes(tier)) fail('ALREADY_CLAIMED');
      o.coins += r.coins; o.bp_claims[track].push(tier); if (r.item) give(db, id, r.item, 'pass'); return meJson(db, id);
    });
  },
  // demo checkout: grants the products straight away (Supabase mode uses test_grant_order / Razorpay)
  async checkout(products) {
    const id = need(); await sleep(700);
    return tx(db => {
      const u = db.users[id];
      products.forEach(p => {
        if (p.type === 'turbo') u.turboUntil = Math.max(u.turboUntil || 0, Date.now()) + (p.days || TURBO_PRODUCT.days) * DAY;
        if (p.type === 'item') give(db, id, p.item, 'purchase');
      });
      return meJson(db, id);
    });
  },
  // developer helpers for local testing (dev panel / tests)
  dev: {
    setTurbo(days) { const id = need(); tx(db => { db.users[id].turboUntil = days > 0 ? Date.now() + days * DAY : null; }); },
    setCoins(n) { const id = need(); tx(db => { ensure(db, id).coins = Math.max(0, n | 0); }); },
    setBpXp(n) { const id = need(); tx(db => { ensure(db, id).bp_xp = Math.max(0, n | 0); }); },
    reset() { localStorage.removeItem(DB_KEY); setMe(null); }
  }
};
