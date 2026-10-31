import { boot, $, esc, icon, setStatus, toast, errText } from '../ui.js';
import { gameById } from '../data.js';
import { match } from '../games/common.js';

const q = new URLSearchParams(location.search), g = gameById[q.get('g')];
boot({
  page: 'game.html', title: g ? g.name : 'Game', wide: true,
  async render(view) {
    if (!g) { view.innerHTML = `<div class="empty">${icon('play')}<h2>Unknown game</h2><a class="btn primary" href="play.html">Pick a game</a></div>`; return; }
    document.title = `${g.name} — ProMouser Online`;
    const exit = document.createElement('a'); exit.className = 'btn sm ghost'; exit.href = q.get('lobby') ? `lobby.html?id=${q.get('lobby')}` : 'play.html'; exit.innerHTML = `${icon('door')}Exit`; $('.bar-right').prepend(exit);
    view.innerHTML = `<div class="gstage" id="stage" style="--g1:${g.grad[0]};--g2:${g.grad[1]}"><div class="gover"><div class="gover-card"><span class="spin"></span><p class="muted">${q.get('lobby') ? 'Waiting for players…' : 'Loading…'}</p></div></div></div>`;
    const stage = $('#stage');
    try {
      const ctx = await match({ game: g.id, mode: q.get('mode') || (g.bots ? 'bots' : 'solo'), lobbyId: q.get('lobby'), round: q.get('round'), seed: +q.get('seed') || 0 });
      setStatus(`Playing ${g.name}`);
      stage.innerHTML = '';
      const mod = await import(`../games/${g.id}.js`);
      await mod.start(stage, ctx);
    } catch (e) { console.error(e); stage.innerHTML = `<div class="gover"><div class="gover-card"><h2>Couldn’t start the game</h2><p class="muted">${esc(errText(e))}</p><a class="btn primary" href="play.html">Back</a></div></div>`; }
  }
});
