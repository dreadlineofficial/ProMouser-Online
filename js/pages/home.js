import { boot, state, $, esc, num, icon, avatar, nameTag, badges, toast, errText, refresh, ago, api, itemById, xpForLevel } from '../ui.js';
import { GAMES, gameById, BP_TIER_XP, BP_TIERS, PROMOUSER_URL, ITEMS } from '../data.js';

export const poster = g => `assets/posters/${g.id}.jpg`;
export const gameCard = (g, { big = false, href = `game.html?g=${g.id}`, extra = '' } = {}) => `<a class="gcard${big ? ' big' : ''}" href="${href}">
  <div class="gart"><img src="${poster(g)}" alt="" loading="lazy"><span class="chip gtag">${esc(g.tag)}${g.mp ? ' · MP' : ''}</span></div>
  <div class="gbody"><h3>${esc(g.name)}</h3><p>${esc(g.blurb)}</p>${extra}</div></a>`;

function landing(view) {
  const mice = ITEMS.filter(i => i.kind === 'mouse').length;
  view.innerHTML = `<div class="land">
    <section class="land-hero">
      <div class="land-3d" id="heroMouse"></div>
      <div class="land-copy"><span class="kicker">ProMouser Online · Season 1</span>
        <h1>Play. Duel.<br><span>Collect.</span></h1>
        <p>The social side of ProMouser. Squad up with friends, duel in CPS and reaction, drop into a 3D arena shooter, and build a collection of 3D digital mice.</p>
        <div class="row"><button class="btn primary lg" type="button" data-auth="signup">Create free account</button><button class="btn ghost lg" type="button" data-auth="signin">Sign in</button></div>
        <div class="land-stats"><div><b>${GAMES.length}</b><span>Games</span></div><div><b>12</b><span>Per lobby</span></div><div><b>${mice}</b><span>3D mice</span></div><div><b>1</b><span>Account with ProMouser</span></div></div>
      </div>
    </section>
    <div class="section-h"><div><span class="kicker">Games</span><h2>Eight ways to play</h2></div></div>
    <div class="cards games">${gameCard(GAMES[0], { big: true, href: '#' })}${GAMES.slice(1).map(g => gameCard(g, { href: '#' })).join('')}</div>
    <div class="section-h"><div><span class="kicker">Everything else</span><h2>Built for the grind</h2></div></div>
    <div class="feat-grid">
      <div class="feat">${icon('lobby')}<h3>Lobbies</h3><p>Public or private rooms with a join code. Start when everyone is ready.</p></div>
      <div class="feat">${icon('friends')}<h3>Friends &amp; chat</h3><p>See who’s online, chat, and invite people straight into your lobby.</p></div>
      <div class="feat">${icon('mouse')}<h3>3D digital mice</h3><p>Earn coins in every game, or buy mythic mice and animated profile borders.</p></div>
      <div class="feat">${icon('turbo')}<h3>Turbo</h3><p>Gradient name, custom profile gradients, the premium pass track and an exclusive mouse.</p></div>
    </div>
    <p class="small muted" style="margin-top:22px">Already on <a href="${PROMOUSER_URL}" target="_blank" rel="noopener"><b>ProMouser</b></a>? Sign in with the same account and your CPS bests and plan come with you.</p></div>`;
  view.querySelectorAll('.cards a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); document.querySelector('[data-auth="signup"]').click(); }));
  import('../mouse3d.js').then(m => { const h = $('#heroMouse'); if (h) m.viewer(h, 'm-prism', { bloom: .4, shift: .2, far: 1.7 }); }).catch(() => {});
}

async function dashboard(view, me) {
  const lvl = me.level, lo = xpForLevel(lvl), hi = xpForLevel(lvl + 1), pct = Math.round((me.xp - lo) / (hi - lo) * 100);
  const bpTier = Math.min(BP_TIERS, Math.floor(me.bp_xp / BP_TIER_XP)), bpPct = bpTier >= BP_TIERS ? 100 : Math.round((me.bp_xp % BP_TIER_XP) / BP_TIER_XP * 100);
  const played = Object.values(me.stats || {}).reduce((a, s) => a + (s.played || 0), 0), wins = Object.values(me.stats || {}).reduce((a, s) => a + (s.wins || 0), 0);
  const show = me.showcase && itemById[me.showcase] ? itemById[me.showcase] : itemById['m-starter'];
  const pm = me.promouser || {}, cps = Object.entries(pm.cps_best || {}).sort((a, b) => b[1] - a[1])[0];
  const best = g => { const s = (me.stats || {})[g.id]; return `<span class="gbest">${s && s.best != null ? 'Best ' + +s.best + (g.low ? ' ms' : '') : 'Not played yet'}</span>`; };
  view.innerHTML = `
    <section class="hello">
      <div class="hello-copy"><span class="kicker">Welcome back</span>
        <h2>${avatar(me, 56)}${nameTag(me)}</h2>
        <div class="row small muted">${badges(me)} <span>${num(me.xp)} XP · ${pct}% to level ${lvl + 1}</span></div><div class="xpbar"><i style="width:${pct}%"></i></div>
        <div class="daily">${icon('coin')}<div><b>${me.daily_claimed ? 'Daily bonus claimed' : 'Daily bonus ready'}</b><small>${me.daily_claimed ? 'Come back tomorrow' : 'Streak ' + (me.daily_streak || 0) + ' · up to 110 coins'}</small></div>
          ${me.daily_claimed ? '' : '<button class="btn primary sm" type="button" id="claimDaily">Claim</button>'}</div>
        <div class="row"><a class="btn primary" href="game.html?g=arena&mode=bots">${icon('play')}Quick match</a><a class="btn ghost" href="lobbies.html">${icon('lobby')}Browse lobbies</a></div>
      </div>
      <div class="hello-3d" id="showcase"><div class="cap"><span class="kicker">Showcase</span><b>${esc(show.name)}</b><small class="muted">${esc(show.rarity)} · drag to spin · <a href="settings.html#looks">change</a></small></div></div>
    </section>
    <div class="dash">
      <div>
        <div class="section-h"><div><span class="kicker">Jump in</span><h2>Quick play</h2></div><a href="play.html">All games →</a></div>
        <div class="cards games">${gameCard(GAMES[0], { big: true, extra: best(GAMES[0]) })}${GAMES.slice(1, 5).map(g => gameCard(g, { extra: best(g) })).join('')}</div>
        <div class="section-h"><div><span class="kicker">Career</span><h2>Your stats</h2></div><a href="profile.html?u=${encodeURIComponent(me.username)}">Profile →</a></div>
        <div class="stat-grid">
          <div class="stat"><span>Games played</span><b>${num(played)}</b></div><div class="stat"><span>Wins</span><b>${num(wins)}</b></div>
          <div class="stat"><span>Coins today</span><b>${num(me.coins_today)}</b><small>Daily cap 2,000</small></div>
          <div class="stat"><span>Collection</span><b>${me.inventory.length}</b><small>items owned</small></div>
          <div class="stat"><span>ProMouser plan</span><b>${esc((pm.plan || 'free').replace(/^./, c => c.toUpperCase()))}</b><small>${pm.member_since ? 'since ' + new Date(pm.member_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''}</small></div>
          <div class="stat"><span>Best CPS · ProMouser</span><b>${cps ? cps[1] : '—'}</b><small>${cps ? cps[0] + ' s test' : '<a href="' + PROMOUSER_URL + 'cps-test.html" target="_blank" rel="noopener">Take the CPS test</a>'}</small></div>
        </div>
      </div>
      <div class="grid">
        <a class="panel" href="pass.html"><div class="panel-h"><h3>Season 1 pass</h3><span class="chip">Tier ${bpTier}/${BP_TIERS}</span></div>
          <div class="xpbar"><i style="width:${bpPct}%"></i></div><p class="small muted" style="margin-top:.5rem">${bpTier >= BP_TIERS ? 'Maxed out. Legend.' : `${num(me.bp_xp % BP_TIER_XP)} / ${BP_TIER_XP} XP to tier ${bpTier + 1}`}${me.turbo ? '' : ' · Turbo unlocks the second track'}</p></a>
        <div class="panel"><div class="panel-h"><h3>Recent games</h3></div><div id="recent" class="small muted">Loading…</div></div>
        <a class="panel" href="shop.html"><div class="panel-h"><h3>Store</h3><span class="chip">${icon('coin')} ${num(me.coins)}</span></div><p class="small muted">New mice and borders every season. Spend what you earn in games.</p></a>
      </div>
    </div>`;
  $('#claimDaily') && $('#claimDaily').addEventListener('click', async e => {
    e.target.disabled = true;
    try { const r = await api.daily(); toast(`${icon('coin')} +${r.coins} coins · ${r.streak}-day streak`, { kind: 'ok' }); await refresh(); dashboard(view, state.me); } catch (x) { toast(errText(x), { kind: 'bad' }); e.target.disabled = false; }
  });
  import('../mouse3d.js').then(m => { const h = $('#showcase'); if (h) m.viewer(h, show.id, { bloom: .35 }); }).catch(() => {});
  try {
    const p = await api.profile(me.username), r = p.recent || [];
    $('#recent').innerHTML = r.length ? `<ul class="lb">${r.map(x => `<li><span class="pos">${x.won ? 'W' : '·'}</span><span></span><span>${esc((gameById[x.game] || {}).name || x.game)}<small class="muted"> · ${ago(x.created_at)}</small></span><b>${+x.score}</b></li>`).join('')}</ul>` : 'No games yet. <a href="play.html"><b>Play one!</b></a>';
  } catch (e) { $('#recent').textContent = ''; }
}

boot({ page: 'index.html', title: 'Home', gated: false, render: (view, me) => (me ? dashboard(view, me) : landing(view)) });
