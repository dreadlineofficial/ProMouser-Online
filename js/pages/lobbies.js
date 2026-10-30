import { boot, $, esc, icon, avatar, nameTag, toast, errText, api } from '../ui.js';
import { GAMES, gameById } from '../data.js';

boot({
  page: 'lobbies.html', title: 'Lobbies',
  async render(view, me) {
    const mp = GAMES.filter(g => g.mp), pre = new URLSearchParams(location.search).get('game');
    view.innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr);align-items:start" id="lobGrid">
      <section><div class="section-h"><div><span class="kicker">Live now</span><h2>Public lobbies</h2></div><button class="btn sm ghost" type="button" id="reload">Refresh</button></div>
        <div class="lob-list" id="lobList"><div class="loading" style="min-height:120px"><span class="spin"></span></div></div></section>
      <aside class="grid">
        <form class="panel" id="joinF"><h3 style="margin-bottom:10px">Join with a code</h3><div class="row" style="flex-wrap:nowrap"><label class="sr" for="code">Lobby code</label><input class="input" id="code" maxlength="6" placeholder="ABC123" autocomplete="off" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800"><button class="btn primary" type="submit">Join</button></div></form>
        <form class="panel" id="mkF"><h3 style="margin-bottom:12px">Create a lobby</h3><div style="display:grid;gap:12px">
          <label class="f">Game<select name="game">${mp.map(g => `<option value="${g.id}" ${g.id === pre ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
          <label class="f">Lobby name<input name="name" maxlength="40" value="${esc(me.display_name)}’s lobby"></label>
          <div class="row"><label class="f" style="flex:1">Max players<select name="max">${[2, 4, 6, 8, 12, 16].map(n => `<option ${n === 8 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="f" style="flex:1">Who can join<select name="pub"><option value="1">Anyone (public)</option><option value="0">Invite / code only</option></select></label></div>
          <button class="btn primary" type="submit">${icon('plus')}Create lobby</button></div></form>
      </aside></div>`;
    if (innerWidth < 1000) $('#lobGrid').style.gridTemplateColumns = '1fr';
    async function load() {
      try {
        const ls = await api.lobbies(), host = $('#lobList'); if (!host) return;
        host.innerHTML = ls.length ? ls.map(l => { const g = gameById[l.game] || GAMES[0]; return `<div class="lob" style="--g1:${g.grad[0]};--g2:${g.grad[1]}"><span class="lob-icon">${icon(g.icon)}</span>
          <div style="min-width:0"><b>${esc(l.name)}</b><div class="row small"><span class="chip">${esc(g.name)}</span><small>${l.players}/${l.max_players} players</small>${l.status === 'playing' ? '<span class="chip" style="color:var(--warn)">In game</span>' : ''}</div>
          <small class="row" style="gap:.4rem;margin-top:.3rem">${avatar(l.host, 20)} hosted by ${nameTag(l.host)}</small></div>
          <button class="btn sm ${l.status === 'playing' || l.players >= l.max_players ? '' : 'primary'}" type="button" data-join="${l.code}" ${l.players >= l.max_players ? 'disabled' : ''}>${l.players >= l.max_players ? 'Full' : 'Join'}</button></div>`; }).join('')
          : `<div class="empty">${icon('lobby')}<h3>No public lobbies right now</h3><p>Create one and share the code with your friends.</p></div>`;
      } catch (e) { $('#lobList').innerHTML = `<p class="muted">${esc(errText(e))}</p>`; }
    }
    $('#reload').addEventListener('click', load);
    $('#joinF').addEventListener('submit', async e => {
      e.preventDefault(); const c = $('#code').value.trim(); if (c.length < 6) return toast('Codes are 6 characters.', { kind: 'bad' });
      try { const l = await api.lobbyJoin(c); location.href = 'lobby.html?id=' + l.id; } catch (x) { toast(errText(x), { kind: 'bad' }); }
    });
    $('#mkF').addEventListener('submit', async e => {
      e.preventDefault(); const f = new FormData(e.target), btn = $('[type=submit]', e.target); btn.disabled = true;
      try { const g = gameById[f.get('game')]; const l = await api.lobbyCreate({ game: g.id, name: f.get('name'), isPublic: f.get('pub') === '1', max: Math.min(+f.get('max'), g.max), settings: g.bots ? { bots: g.id === 'arena' ? 3 : 2, difficulty: 'normal' } : {} }); location.href = 'lobby.html?id=' + l.id; }
      catch (x) { toast(errText(x), { kind: 'bad' }); btn.disabled = false; }
    });
    await load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 6000);
    addEventListener('pagehide', () => clearInterval(t));
  }
});
