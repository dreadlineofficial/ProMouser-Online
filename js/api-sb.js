/* =====================================================================
   ProMouser Online: Supabase backend
   Same project as ProMouser, so accounts are shared: an Online sign-up IS a
   ProMouser account, and a ProMouser account signs straight in here.
   Every change goes through the o_* functions in supabase/online.sql.
   ===================================================================== */
const cfg = window.PMO_SUPABASE || {};
const listeners = new Set();
const notify = () => listeners.forEach(f => { try { f(); } catch (e) { /* listener error */ } });
let client = null, session = null;

const CODES = /\b(NOT_SIGNED_IN|NO_PROFILE|BAD_USERNAME|USERNAME_TAKEN|BAD_NAME|NOT_OWNED|TURBO_REQUIRED|BAD_GRADIENT|ALREADY_CLAIMED|NO_SUCH_USER|CANNOT_ADD_SELF|SLOW_DOWN|NOT_FRIENDS|BAD_MESSAGE|BAD_GAME|LOBBY_NOT_FOUND|LOBBY_FULL|NOT_HOST|BAD_STATUS|CANNOT_KICK_SELF|BAD_SCORE|NOT_FOR_COINS|ALREADY_OWNED|NOT_ENOUGH_COINS|NO_REWARD|TIER_LOCKED|UNKNOWN_PRODUCT)\b/;
function fail(error) {
  const msg = (error && (error.message || error.msg)) || String(error), m = CODES.exec(msg);
  const e = new Error(m ? m[1] : /check constraint/.test(msg) ? 'BAD_INPUT' : /fetch|network/i.test(msg) ? 'NETWORK' : msg);
  e.code = e.message; throw e;
}
async function rpc(name, args) {
  await api.ready;
  const { data, error } = await client.rpc(name, args || {});
  if (error) fail(error);
  return data;
}
const mut = async (name, args) => { const r = await rpc(name, args); notify(); return r; };

export const api = {
  mode: 'supabase',
  ready: (async () => {
    if (!window.supabase) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = new URL('../vendor/supabase-2.117.3.js', import.meta.url).href; sc.onload = res; sc.onerror = () => rej(new Error('Could not load the Supabase library')); document.head.appendChild(sc); });
    client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pm-sb-auth' } });
    session = (await client.auth.getSession()).data.session;
    client.auth.onAuthStateChange((_e, s) => { const was = session && session.user.id; session = s; if ((s && s.user.id) !== was) notify(); });
  })(),
  get client() { return client; },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  userId: () => (session ? session.user.id : null),
  signedIn: () => !!session,

  async signUp({ name, email, password }) {
    await this.ready;
    const { data, error } = await client.auth.signUp({ email: String(email).trim(), password, options: { data: { name: String(name).trim() }, emailRedirectTo: location.href.split('#')[0] } });
    if (error) { if (/already|registered|exists/i.test(error.message)) fail('EMAIL_TAKEN'); if (/password/i.test(error.message)) fail('WEAK_PASSWORD'); fail(error); }
    session = data.session; notify();
    return { confirm: !data.session };
  },
  async signIn({ email, password }) {
    await this.ready;
    const { data, error } = await client.auth.signInWithPassword({ email: String(email).trim(), password });
    if (error) { if (/confirm/i.test(error.message)) fail('EMAIL_NOT_CONFIRMED'); fail('BAD_LOGIN'); }
    session = data.session; notify();
  },
  async signOut() { await this.ready; await client.auth.signOut(); session = null; notify(); },

  async me() { if (!session) return null; return rpc('o_me'); },
  setProfile: p => mut('o_set_profile', { p }),
  async uploadAvatar(blob) {
    await this.ready; if (!session) fail('NOT_SIGNED_IN');
    const path = `${session.user.id}/avatar.webp`;
    const { error } = await client.storage.from('avatars').upload(path, blob, { upsert: true, contentType: blob.type || 'image/webp', cacheControl: '3600' });
    if (error) fail(error);
    return client.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
  },
  daily: () => mut('o_daily'),
  profile: username => rpc('o_profile', { p_username: username }),
  search: q => rpc('o_search', { p_q: q }),
  friends: () => rpc('o_friends'),
  friendAdd: id => mut('o_friend_add', { p_user: id }),
  friendRemove: id => mut('o_friend_remove', { p_user: id }),
  dmList: id => rpc('o_dm_list', { p_user: id }),
  dmSend: (id, body) => rpc('o_dm_send', { p_user: id, p_body: body }),
  lobbies: () => rpc('o_lobbies'),
  lobbyCreate: ({ game, name, isPublic = true, max = 8, settings = {} }) => rpc('o_lobby_create', { p_game: game, p_name: name, p_public: isPublic, p_max: max, p_settings: settings }),
  lobbyJoin: code => rpc('o_lobby_join', { p_code: code }),
  lobbyLeave: id => rpc('o_lobby_leave', { p_id: id }),
  lobby: id => rpc('o_lobby', { p_id: id }),
  lobbyUpdate: (id, p) => rpc('o_lobby_update', { p_id: id, p }),
  lobbyKick: (id, user) => rpc('o_lobby_kick', { p_id: id, p_user: user }),
  submit: (game, score, won = false, lobby = null) => mut('o_submit', { p_game: game, p_score: score, p_won: !!won, p_lobby: lobby }),
  leaderboard: game => rpc('o_leaderboard', { p_game: game }),
  buy: item => mut('o_buy', { p_item: item }),
  claimTier: (track, tier) => mut('o_claim_tier', { p_track: track, p_tier: tier }),
  // checkout: test payments until Razorpay is connected (same flow as ProMouser's shop)
  async checkout(products) {
    if (!cfg.testPayments) fail('PAYMENTS_NOT_LIVE');
    await rpc('test_grant_order', { p_order: 'PMO-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(), p_products: products.map(p => p.id) });
    notify(); return rpc('o_me');
  },
  dev: null
};
