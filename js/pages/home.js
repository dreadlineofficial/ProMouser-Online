import { boot, state, $, esc, num, icon, avatar, nameTag, badges, toast, errText, refresh, ago, api, itemById, levelOf, xpForLevel } from '../ui.js';
import { GAMES, gameById, BP_TIER_XP, BP_TIERS, PROMOUSER_URL } from '../data.js';

const gameCard = g => `<a class="gcard" href="game.html?g=${g.id}" style="--g1:${g.grad[0]};--g2:${g.grad[1]}">
  <div class="gart">${icon(g.icon)}</div><span class="chip gtag">${esc(g.tag)}</span><h3>${esc(g.name)}</h3><p>${esc(g.blurb)}</p></a>`;

function landing(view) {
  view.innerHTML = `<div class="land">
    <section class="land-hero">
      <div><span class="kicker">ProMouser Online · new</span>
        <h1>Play. Duel.<br><span class="grad-text">Collect.</span></h1>
        <p>The social side of ProMouser. Add friends, chat, create lobbies, duel people in CPS and reactions, drop into a 3D arena shooter, and collect insane 3D digital mice and profile borders.</p>
        <div class="row"><button class="btn primary lg" type="button" data-auth="signup">Create free account</button><button class="btn ghost lg" type="button" data-auth="signin">Sign in</button></div>
        <p class="small muted" style="margin-top:1rem">Already have a <a class="grad-text" href="${PROMOUSER_URL}" target="_blank" rel="noopener"><b>ProMouser</b></a> account? Sign in with it. It’s the same account.</p></div>
      <div class="land-3d" id="heroMouse"></div>
    </section>
    <div class="feat-grid">
      <div class="feat">${icon('crosshair')}<h3>8 games</h3><p>Neon Arena 3D FPS, CPS and reaction duels, Click Royale, Aim Rush and more. Solo, vs bots or with friends.</p></div>
      <div class="feat">${icon('lobby')}<h3>Lobbies</h3><p>Make a public or private lobby, share the code and start when everyone is ready.</p></div>
      <div class="feat">${icon('friends')}<h3>Friends &amp; chat</h3><p>Add players, see who’s online, chat and invite them straight into your lobby.</p></div>
      <div class="feat">${icon('mouse')}<h3>3D digital mice</h3><p>Grind coins or buy mythic mice and animated profile borders. Show them off on your profile.</p></div>
      <div class="feat">${icon('turbo')}<h3>Turbo</h3><p>Gradient username, profile gradients, a Turbo battle pass track and an exclusive mouse. ProMouser Ultra includes a month.</p></div>
    </div></div>`;
  import('../mouse3d.js').then(m => { const h = $('#heroMouse'); if (h) m.viewer(h, 'm-prism', { bloom: .7 }); }).catch(() => {});
}

async function dashboard(view, me) {
  const lvl = me.level, lo = xpForLevel(lvl), hi = xpForLevel(lvl + 1), pct = Math.round((me.xp - lo) / (hi - lo) * 100);
  const bpTier = Math.min(BP_TIERS, Math.floor(me.bp_xp / BP_TIER_XP)), bpPct = bpTier >= BP_TIERS ? 100 : Math.round((me.bp_xp % BP_TIER_XP) / BP_TIER_XP * 100);
  const played = Object.values(me.stats || {}).reduce((a, s) => a + (s.played || 0), 0), wins = Object.values(me.stats || {}).reduce((a, s) => a + (s.wins || 0), 0);
  const show = me.showcase && itemById[me.showcase] ? itemById[me.showcase] : itemById['m-starter'];
  const pm = me.promouser || {}, cps = Object.entries(pm.cps_best || {}).sort((a, b) => b[1] - a[1])[0];
  view.innerHTML = `
    <section class="hello">${avatar(me, 72)}
      <div><span class="kicker">Welcome back</span><h2>${nameTag(me)}</h2>
        <div class="row small muted">${badges(me)} <span>${num(me.xp)} XP · ${pct}% to level ${lvl + 1}</span></div><div class="xpbar"><i style="width:${pct}%"></i></div></div>
      <div class="daily">${icon('coin')}<b>${me.daily_claimed ? 'Daily bonus claimed' : 'Daily bonus ready'}</b><small class="muted">${me.daily_claimed ? 'Come back tomorrow' : 'Streak ' + (me.daily_streak || 0) + ' · up to 110 coins'}</small>
        ${me.daily_claimed ? '' : '<button class="btn primary sm" type="button" id="claimDaily">Claim</button>'}</div>
    </section>
    <div class="dash">
      <div>
        <div class="section-h"><h2>Quick play</h2><a href="play.html">All games →</a></div>
        <div class="cards">${GAMES.slice(0, 4).map(gameCard).join('')}</div>
        <div class="section-h"><h2>Your stats</h2><a href="profile.html?u=${encodeURIComponent(me.username)}">Profile →</a></div>
        <div class="stat-grid">
          <div class="stat"><span>Games played</span><b>${num(played)}</b></div><div class="stat"><span>Wins</span><b>${num(wins)}</b></div>
          <div class="stat"><span>Coins earned today</span><b>${num(me.coins_today)}</b><small>Daily cap 2,000</small></div>
          <div class="stat"><span>Collection</span><b>${me.inventory.length}</b><small>items owned</small></div>
          <div class="stat"><span>ProMouser plan</span><b>${esc((pm.plan || 'free').replace(/^./, c => c.toUpperCase()))}</b><small>${pm.member_since ? 'since ' + new Date(pm.member_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''}</small></div>
          <div class="stat"><span>Best CPS (ProMouser)</span><b>${cps ? cps[1] : '—'}</b><small>${cps ? cps[0] + ' s test' : '<a href="' + PROMOUSER_URL + 'cps-test.html" target="_blank" rel="noopener">Take the CPS test</a>'}</small></div>
        </div>
      </div>
      <div class="grid">
        <div class="panel"><div class="panel-h"><h3>Showcase mouse</h3><a class="btn xs ghost" href="settings.html#looks">Change</a></div>
          <div class="showcase" id="showcase" style="--rc:var(--violet)"><div class="showcase-cap"><b>${esc(show.name)}</b><small class="muted">${esc(show.rarity)} · drag to spin</small></div></div></div>
        <a class="panel" href="pass.html"><div class="panel-h"><h3>Season 1 battle pass</h3><span class="chip">Tier ${bpTier}/${BP_TIERS}</span></div>
          <div class="xpbar"><i style="width:${bpPct}%"></i></div><p class="small muted" style="margin-top:.5rem">${bpTier >= BP_TIERS ? 'Maxed out. Legend.' : `${num(me.bp_xp % BP_TIER_XP)} / ${BP_TIER_XP} XP to tier ${bpTier + 1}`}${me.turbo ? '' : ' · Turbo unlocks the second track'}</p></a>
        <div class="panel"><div class="panel-h"><h3>Recent games</h3></div><div id="recent" class="small muted">Loading…</div></div>
      </div>
    </div>`;
  $('#claimDaily') && $('#claimDaily').addEventListener('click', async e => {
    e.target.disabled = true;
    try { const r = await api.daily(); toast(`${icon('coin')} +${r.coins} coins · ${r.streak}-day streak`, { kind: 'ok' }); await refresh(); dashboard(view, state.me); } catch (x) { toast(errText(x), { kind: 'bad' }); e.target.disabled = false; }
  });
  import('../mouse3d.js').then(m => { const h = $('#showcase'); if (h) m.viewer(h, show.id); }).catch(() => {});
  try {
    const p = await api.profile(me.username), r = p.recent || [];
    $('#recent').innerHTML = r.length ? `<ul class="lb">${r.map(x => `<li><span class="pos">${x.won ? '🏆' : '·'}</span><span></span><span>${esc((gameById[x.game] || {}).name || x.game)}<small class="muted"> · ${ago(x.created_at)}</small></span><b>${+x.score}</b></li>`).join('')}</ul>` : 'No games yet. <a class="grad-text" href="play.html"><b>Play one!</b></a>';
  } catch (e) { $('#recent').textContent = ''; }
}

boot({ page: 'index.html', title: 'Home', gated: false, render: (view, me) => (me ? dashboard(view, me) : landing(view)) });
