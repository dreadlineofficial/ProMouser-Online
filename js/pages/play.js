import { boot, $, $$, esc, num, icon, avatar, nameTag, modal, closeModal, toast, errText, personLink, api } from '../ui.js';
import { GAMES, gameById } from '../data.js';

export function leaderboardHtml(rows, g, me) {
  return rows.length ? `<ol class="lb">${rows.map((r, i) => `<li class="${r.user_id === me ? 'me' : ''}"><span class="pos">${i + 1}</span>${avatar(r, 30)}<a href="${personLink(r)}">${nameTag(r)}</a><b>${+r.score}${g.low ? ' ms' : ''}</b></li>`).join('')}</ol>`
    : '<p class="muted small">No scores yet. Be the first!</p>';
}

async function openGame(g, me) {
  const best = (me.stats[g.id] || {}).best;
  const body = modal(`<div class="grid g2" style="align-items:start">
    <div style="display:grid;gap:12px"><div class="gart" style="--g1:${g.grad[0]};--g2:${g.grad[1]};margin:0;border-radius:16px;height:140px">${icon(g.icon)}</div>
      <span class="kicker">${esc(g.tag)}</span><h2 style="margin:0">${esc(g.name)}</h2><p class="muted">${esc(g.blurb)}</p>
      ${best != null ? `<p class="small">Your best: <b class="grad-text">${+best}${g.low ? ' ms' : ''}</b> · played ${num((me.stats[g.id] || {}).played)}×</p>` : ''}
      <div style="display:grid;gap:8px">
        ${g.bots ? `<a class="btn primary" href="game.html?g=${g.id}&mode=bots">${icon('play')}Play vs bots</a>` : `<a class="btn primary" href="game.html?g=${g.id}&mode=solo">${icon('play')}Play solo</a>`}
        ${g.mp ? `<button class="btn" type="button" id="mkLobby">${icon('lobby')}Create a lobby</button>` : '<p class="small muted">Solo only: compete on the leaderboard.</p>'}
      </div></div>
    <div><h3 style="margin-bottom:10px">${icon('trophy')} Leaderboard</h3><div id="lbHost" class="small muted">Loading…</div></div></div>`, { cls: 'wide', label: g.name });
  const mk = $('#mkLobby', body);
  mk && mk.addEventListener('click', async () => {
    mk.disabled = true;
    try { const l = await api.lobbyCreate({ game: g.id, name: `${me.display_name}’s ${g.name}`, isPublic: true, max: g.max }); location.href = 'lobby.html?id=' + l.id; }
    catch (e) { toast(errText(e), { kind: 'bad' }); mk.disabled = false; }
  });
  try { $('#lbHost', body).innerHTML = leaderboardHtml(await api.leaderboard(g.id), g, me.user_id); } catch (e) { $('#lbHost', body).textContent = errText(e); }
}

boot({
  page: 'play.html', title: 'Play',
  render(view, me) {
    view.innerHTML = `<div class="section-h"><div><span class="kicker">8 games</span><h2>Pick a game</h2></div><span class="muted small">Coins today: <b>${num(me.coins_today)}</b> / 2,000</span></div>
      <div class="cards">${GAMES.map(g => {
        const s = me.stats[g.id];
        return `<button class="gcard" type="button" data-game="${g.id}" style="--g1:${g.grad[0]};--g2:${g.grad[1]};text-align:left">
          <div class="gart">${icon(g.icon)}</div><span class="chip gtag">${esc(g.tag)}${g.mp ? ' · Multiplayer' : ''}</span>
          <h3>${esc(g.name)}</h3><p>${esc(g.blurb)}</p>
          <div class="row between"><span class="gbest">${s && s.best != null ? 'Best ' + +s.best + (g.low ? ' ms' : '') : 'Not played yet'}</span><span class="chip">${esc(g.score)}</span></div></button>`;
      }).join('')}</div>`;
    $$('[data-game]', view).forEach(b => b.addEventListener('click', () => openGame(gameById[b.dataset.game], me)));
    const q = new URLSearchParams(location.search).get('g'); if (q && gameById[q]) openGame(gameById[q], me);
  }
});
