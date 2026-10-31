import { boot, $, $$, esc, icon, avatar, nameTag, badges, toast, errText, personLink, setStatus, ping, api } from '../ui.js';
import { channel, onlineIds } from '../net.js';
import { GAMES, gameById } from '../data.js';

boot({
  page: 'lobby.html', title: 'Lobby',
  async render(view, me) {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { location.href = 'lobbies.html'; return; }
    let L;
    try { L = await api.lobby(id); if (!L.members.some(m => m.user_id === me.user_id)) L = await api.lobbyJoin(id); }
    catch (e) { view.innerHTML = `<div class="empty">${icon('lobby')}<h2>${esc(errText(e))}</h2><a class="btn primary" href="lobbies.html">Back to lobbies</a></div>`; return; }
    setStatus('In a lobby');
    let here = new Map(), ready = false, chatLog = [], leaving = false;
    const isHost = () => L.host === me.user_id;
    const ch = channel('lobby:' + id, { key: me.user_id });
    const myState = () => ({ ready, name: me.display_name });

    view.innerHTML = `<div class="room">
      <section class="grid" style="align-content:start">
        <div class="panel" id="head"></div>
        <div class="panel"><div class="panel-h"><h3>Players</h3><span class="chip" id="count"></span></div><div class="members" id="members"></div>
          <div class="row" style="margin-top:14px"><button class="btn" type="button" id="readyBtn">${icon('check')}Ready</button><button class="btn primary" type="button" id="startBtn" hidden>${icon('play')}Start game</button><span class="small muted" id="startNote"></span></div></div>
      </section>
      <aside class="grid" style="align-content:start">
        <div class="chat"><div class="chat-log" id="log" aria-live="polite"></div><form class="chat-in" id="chatF"><label class="sr" for="chatIn">Message the lobby</label><input id="chatIn" maxlength="200" autocomplete="off" placeholder="Message the lobby"><button class="btn primary sm" type="submit" aria-label="Send">${icon('send')}</button></form></div>
        <div class="panel"><h3 style="margin-bottom:10px">Invite friends</h3><div id="inv" style="display:grid;gap:4px"><p class="muted small">Loading…</p></div></div>
      </aside></div>`;

    function head() {
      const g = gameById[L.game] || GAMES[0];
      $('#head').innerHTML = `<div class="row between"><div><span class="kicker">${L.is_public ? 'Public lobby' : 'Private lobby'}</span><h2 style="margin:.2rem 0">${esc(L.name)}</h2>
          <div class="row small"><span class="chip">${esc(g.name)}</span><span class="muted">${esc(g.blurb)}</span></div></div>
        <div style="display:grid;gap:6px;justify-items:end"><span class="small muted">Join code</span><button class="code" type="button" id="copyCode" title="Copy code">${esc(L.code)}</button></div></div>
        ${isHost() ? `<form class="row" id="hostF" style="margin-top:14px;align-items:end">
          <label class="f">Game<select name="game">${GAMES.filter(x => x.mp).map(x => `<option value="${x.id}" ${x.id === L.game ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <label class="f">Players<select name="max_players">${[2, 4, 6, 8, 12, 16].map(n => `<option ${n === L.max_players ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="f">Visibility<select name="is_public"><option value="1" ${L.is_public ? 'selected' : ''}>Public</option><option value="0" ${L.is_public ? '' : 'selected'}>Private</option></select></label>
          ${g.bots ? `<label class="f">Bots<select name="bots">${[0, 1, 2, 3, 4, 5].map(n => `<option ${n === (L.settings.bots ?? 0) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="f">Bot skill<select name="difficulty">${['easy', 'normal', 'hard'].map(d => `<option ${d === (L.settings.difficulty || 'normal') ? 'selected' : ''}>${d}</option>`).join('')}</select></label>` : ''}
        </form>` : `<p class="small muted" style="margin-top:12px">${avatar(L.members.find(m => m.user_id === L.host) || {}, 22)} The host picks the game and starts the match.</p>`}`;
      $('#copyCode').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(L.code).then(() => toast(`${icon('copy')} Code copied`)).catch(() => {}); });
      const hf = $('#hostF');
      hf && hf.addEventListener('change', async () => {
        const f = new FormData(hf), g2 = gameById[f.get('game')];
        try { L = await api.lobbyUpdate(id, { game: g2.id, max_players: +f.get('max_players'), is_public: f.get('is_public') === '1', settings: g2.bots ? { bots: +(f.get('bots') ?? 2), difficulty: f.get('difficulty') || 'normal' } : {} }); ch.send('refresh', {}); head(); members(); }
        catch (x) { toast(errText(x), { kind: 'bad' }); }
      });
    }
    function members() {
      const list = L.members, pres = here;
      $('#count').textContent = `${list.length}/${L.max_players}`;
      $('#members').innerHTML = list.map(m => { const p = pres.get(m.user_id), on = !!p; return `<div class="member ${on ? '' : 'away'}">${avatar(m, 40, { status: on ? 'on' : 'off' })}
        <div style="min-width:0"><a href="${personLink(m)}" target="_blank" rel="noopener">${nameTag(m)}</a><div class="row small">${m.user_id === L.host ? `<span class="host">${icon('crown')}</span>` : ''}${badges(m)}</div></div>
        <span class="ready">${on ? (p.ready || m.user_id === L.host ? '<span class="chip" style="color:var(--ok)">Ready</span>' : '<span class="chip">Not ready</span>') : '<span class="chip">Away</span>'}</span>
        ${isHost() && m.user_id !== me.user_id ? `<button class="btn xs ghost" type="button" data-kick="${m.user_id}" aria-label="Kick ${esc(m.display_name)}">${icon('x')}</button>` : ''}</div>`; }).join('');
      const present = list.filter(m => here.has(m.user_id)), allReady = present.every(m => m.user_id === L.host || (here.get(m.user_id) || {}).ready);
      const g = gameById[L.game], needs = g.bots ? 1 : 2;
      $('#startBtn').hidden = !isHost(); $('#readyBtn').hidden = isHost();
      $('#startBtn').disabled = present.length < needs;
      $('#startNote').textContent = isHost() ? (present.length < needs ? 'Waiting for another player…' : allReady ? 'Everyone is ready.' : 'Not everyone is ready (you can still start).') : (ready ? 'Waiting for the host…' : '');
      $('#readyBtn').innerHTML = ready ? `${icon('check')}Ready ✓` : `${icon('check')}Ready up`; $('#readyBtn').classList.toggle('primary', ready);
    }
    const addChat = (who, text, sys) => { chatLog.push({ who, text, sys }); chatLog = chatLog.slice(-80); const log = $('#log'); log.innerHTML = chatLog.map(c => c.sys ? `<div class="msg sys">${esc(c.text)}</div>` : `<div class="msg ${c.who.user_id === me.user_id ? 'mine' : ''}">${c.who.user_id === me.user_id ? '' : avatar(c.who, 26)}<div class="bubble"><small>${esc(c.who.display_name)}</small>${esc(c.text)}</div></div>`).join(''); log.scrollTop = log.scrollHeight; };
    const reload = async () => { try { L = await api.lobby(id); if (!L.members.some(m => m.user_id === me.user_id)) { toast('You were removed from the lobby.'); location.href = 'lobbies.html'; return; } head(); members(); } catch (e) { if (!leaving) { toast(errText(e), { kind: 'bad' }); location.href = 'lobbies.html'; } } };

    ch.onPresence(list => { const before = new Set(here.keys()); here = new Map(list.map(p => [p.key, p])); const joined = list.filter(p => !before.has(p.key) && p.key !== me.user_id); if (joined.length) reload(); members(); });
    ch.on('chat', d => addChat(d.who, d.text));
    ch.on('refresh', () => reload());
    ch.on('kick', d => { if (d.user === me.user_id) { toast('The host removed you from the lobby.'); location.href = 'lobbies.html'; } else reload(); });
    ch.on('start', d => { location.href = `game.html?g=${d.game}&lobby=${id}&round=${d.round}&seed=${d.seed}`; });
    await ch.join(myState());
    head(); members(); addChat(null, `You joined ${L.name}. Share the code ${L.code} with friends.`, true);
    ch.send('refresh', {});

    $('#readyBtn').addEventListener('click', () => { ready = !ready; ch.track(myState()); members(); });
    $('#chatF').addEventListener('submit', e => { e.preventDefault(); const t = $('#chatIn').value.trim(); if (!t) return; $('#chatIn').value = ''; const who = { user_id: me.user_id, display_name: me.display_name, username: me.username, avatar_url: me.avatar_url, border: me.border }; ch.send('chat', { who, text: t }); addChat(who, t); });
    $('#members').addEventListener('click', async e => {
      const k = e.target.closest('[data-kick]'); if (!k) return;
      try { L = await api.lobbyKick(id, k.dataset.kick); ch.send('kick', { user: k.dataset.kick }); members(); } catch (x) { toast(errText(x), { kind: 'bad' }); }
    });
    $('#startBtn').addEventListener('click', async () => {
      $('#startBtn').disabled = true;
      try {
        L = await api.lobbyUpdate(id, { status: 'playing' });
        const seed = Math.floor(Math.random() * 1e9);
        ch.send('start', { game: L.game, round: L.round, seed });
        setTimeout(() => { location.href = `game.html?g=${L.game}&lobby=${id}&round=${L.round}&seed=${seed}`; }, 250);
      } catch (x) { toast(errText(x), { kind: 'bad' }); $('#startBtn').disabled = false; }
    });
    // back from a game: the host re-opens the lobby
    if (isHost() && L.status === 'playing') { try { L = await api.lobbyUpdate(id, { status: 'open' }); ch.send('refresh', {}); } catch (e) { /* fine */ } }

    // friends to invite
    try {
      const fr = (await api.friends()).filter(f => f.status === 'friends'), on = onlineIds(), inLobby = new Set(L.members.map(m => m.user_id));
      $('#inv').innerHTML = fr.filter(f => !inLobby.has(f.user_id)).sort((a, b) => on.has(b.user_id) - on.has(a.user_id)).slice(0, 8)
        .map(f => `<div class="person">${avatar(f, 34, { status: on.has(f.user_id) ? 'on' : 'off' })}<span>${nameTag(f)}<small>${on.has(f.user_id) ? 'Online' : 'Offline'}</small></span><button class="btn xs" type="button" data-inv="${f.user_id}">Invite</button></div>`).join('')
        || '<p class="muted small">Friends you add show up here. You can also share the join code.</p>';
      $('#inv').addEventListener('click', e => { const b = e.target.closest('[data-inv]'); if (!b) return; ping(b.dataset.inv, 'invite', { name: me.display_name, lobby: L.name, code: L.code }); b.textContent = 'Sent ✓'; b.disabled = true; });
    } catch (e) { $('#inv').innerHTML = ''; }

    const leaveBtn = document.createElement('button'); leaveBtn.className = 'btn sm danger'; leaveBtn.type = 'button'; leaveBtn.innerHTML = `${icon('door')}Leave`;
    $('.bar-right').prepend(leaveBtn);
    leaveBtn.addEventListener('click', async () => { leaving = true; try { await api.lobbyLeave(id); ch.send('refresh', {}); } catch (e) { /* closing anyway */ } ch.leave(); location.href = 'lobbies.html'; });
    const poll = setInterval(() => { if (!document.hidden) reload(); }, 8000);
    addEventListener('pagehide', () => { clearInterval(poll); ch.leave(); });
  }
});
