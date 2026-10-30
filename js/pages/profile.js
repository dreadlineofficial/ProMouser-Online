import { boot, $, esc, num, icon, avatar, nameTag, badges, gradCss, toast, errText, ago, refresh, ping, api } from '../ui.js';
import { GAMES, gameById, itemById, RARITY, PROMOUSER_URL } from '../data.js';
import { hydrateThumbs, openItem } from '../items-ui.js';

boot({
  page: 'profile.html', title: 'Profile',
  async render(view, me) {
    const u = new URLSearchParams(location.search).get('u') || me.username;
    let p;
    try { p = await api.profile(u); } catch (e) { view.innerHTML = `<div class="empty">${icon('user')}<h2>${esc(errText(e))}</h2><a class="btn" href="friends.html">Find players</a></div>`; return; }
    document.title = `${p.display_name} (@${p.username}) — ProMouser Online`;
    const show = itemById[p.showcase] || itemById['m-starter'];
    const mice = p.items.map(i => itemById[i]).filter(i => i && i.kind === 'mouse'), borders = p.items.map(i => itemById[i]).filter(i => i && i.kind === 'border');
    const played = Object.values(p.stats || {}).reduce((a, s) => a + (s.played || 0), 0), wins = Object.values(p.stats || {}).reduce((a, s) => a + (s.wins || 0), 0);
    const cps = Object.entries(p.cps_best || {}).sort((a, b) => +a[0] - +b[0]);
    const friendBtn = () => p.me ? `<a class="btn" href="settings.html">${icon('gear')}Edit profile</a>`
      : p.friend === 'friends' ? `<a class="btn primary" href="friends.html?with=${p.user_id}">${icon('chat')}Message</a><button class="btn ghost" type="button" id="unf">Unfriend</button>`
      : p.friend === 'outgoing' ? '<span class="chip">Request sent</span>' : p.friend === 'incoming' ? `<button class="btn primary" type="button" id="addF">${icon('check')}Accept request</button>`
      : `<button class="btn primary" type="button" id="addF">${icon('plus')}Add friend</button>`;
    view.innerHTML = `<article class="prof-card">
      <div class="prof-banner" style="${p.theme ? `--pt:${gradCss(p.theme)}` : ''}"></div>
      <div class="prof-top">${avatar(p, 112)}
        <div class="prof-name">${nameTag(p)}<span class="handle">@${esc(p.username)} · joined ${new Date(p.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span><div class="row">${badges(p)}</div></div>
        <div class="row" id="pActs">${friendBtn()}</div></div>
      ${p.bio ? `<p style="padding:0 24px 22px;max-width:70ch">${esc(p.bio)}</p>` : ''}
    </article>
    <div class="prof-body">
      <div class="grid" style="align-content:start">
        <section class="panel"><div class="panel-h"><h3>Game stats</h3><span class="chip">${num(played)} played · ${num(wins)} wins</span></div>
          <div class="stat-grid">${GAMES.map(g => { const s = (p.stats || {})[g.id]; return `<div class="stat"><span>${esc(g.name)}</span><b>${s && s.best != null ? +s.best + (g.low ? ' ms' : '') : '—'}</b><small>${s ? `${s.played} played · ${s.wins} wins` : 'Not played'}</small></div>`; }).join('')}</div></section>
        <section class="panel"><div class="panel-h"><h3>ProMouser stats</h3><a class="small grad-text" href="${PROMOUSER_URL}" target="_blank" rel="noopener"><b>ProMouser ↗</b></a></div>
          <div class="stat-grid"><div class="stat"><span>Plan</span><b>${esc((p.plan || 'free').replace(/^./, c => c.toUpperCase()))}</b><small>${p.plan === 'free' ? 'Free account' : 'Lifetime'}</small></div>
          <div class="stat"><span>Member since</span><b>${new Date(p.member_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</b></div>
          ${cps.length ? cps.map(([s, v]) => `<div class="stat"><span>CPS test · ${s}s</span><b>${v}</b><small>personal best</small></div>`).join('') : `<div class="stat"><span>CPS test</span><b>—</b><small>${p.me ? `<a href="${PROMOUSER_URL}cps-test.html" target="_blank" rel="noopener">Take it on ProMouser</a>` : 'No scores yet'}</small></div>`}</div></section>
        <section class="panel"><div class="panel-h"><h3>Recent games</h3></div>${(p.recent || []).length ? `<ul class="lb">${p.recent.map(x => `<li><span class="pos">${x.won ? '🏆' : '·'}</span><span></span><span>${esc((gameById[x.game] || {}).name || x.game)} <small class="muted">· ${ago(x.created_at)}</small></span><b>${+x.score}</b></li>`).join('')}</ul>` : '<p class="muted small">No games yet.</p>'}</section>
      </div>
      <div class="grid" style="align-content:start">
        <section class="panel"><div class="panel-h"><h3>Showcase</h3><span class="rar ${show.rarity}" style="--rc:${RARITY[show.rarity].color}">${RARITY[show.rarity].name}</span></div>
          <div class="showcase" id="pShow"><div class="showcase-cap"><b>${esc(show.name)}</b><small class="muted">drag to spin</small></div></div></section>
        <section class="panel"><div class="panel-h"><h3>Collection</h3><span class="chip">${p.items.length} items</span></div>
          <p class="small muted" style="margin-bottom:8px">Mice</p><div class="mini-items">${mice.map(i => `<button type="button" class="mi" data-it="${i.id}" title="${esc(i.name)}" style="--rc:${RARITY[i.rarity].color}"><img data-thumb="${i.id}" alt="${esc(i.name)}" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></button>`).join('')}</div>
          <p class="small muted" style="margin:12px 0 8px">Borders</p><div class="mini-items">${borders.map(i => `<button type="button" class="mi" data-it="${i.id}" title="${esc(i.name)}" style="--rc:${RARITY[i.rarity].color}">${avatar(p, 40, { border: i.id })}</button>`).join('')}</div></section>
      </div></div>`;
    import('../mouse3d.js').then(m => { const h = $('#pShow'); if (h) m.viewer(h, show.id); });
    hydrateThumbs(view);
    view.addEventListener('click', async e => {
      const it = e.target.closest('[data-it]'); if (it && p.me) openItem(itemById[it.dataset.it], () => location.reload());
      if (e.target.closest('#addF')) { try { const st = await api.friendAdd(p.user_id); ping(p.user_id, 'friend', { name: me.display_name, accepted: st === 'friends' }); toast(st === 'friends' ? 'You’re now friends!' : 'Friend request sent', { kind: 'ok' }); p.friend = st; $('#pActs').innerHTML = friendBtn(); refresh(); } catch (x) { toast(errText(x), { kind: 'bad' }); } }
      if (e.target.closest('#unf') && confirm(`Remove ${p.display_name} from your friends?`)) { await api.friendRemove(p.user_id); p.friend = 'none'; $('#pActs').innerHTML = friendBtn(); }
    });
  }
});
