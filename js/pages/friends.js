import { boot, state, $, $$, esc, icon, avatar, nameTag, badges, toast, errText, personLink, refresh, ping, api } from '../ui.js';
import { onOnline, onlineIds, statusOf } from '../net.js';

boot({
  page: 'friends.html', title: 'Friends',
  async render(view, me) {
    const qs = new URLSearchParams(location.search);
    let list = [], withId = qs.get('with'), timer = 0, current = null;   // current: the open chat { id, reload }
    view.innerHTML = `<div class="fr" id="fr">
      <div class="fr-list">
        <div class="panel"><h3 style="margin-bottom:10px">Add friends</h3>
          <form id="findF" class="row" style="flex-wrap:nowrap"><input class="input" id="findQ" placeholder="Search by username" maxlength="20" autocomplete="off" value="${esc(qs.get('q') || '')}"><button class="btn sm" type="submit">${icon('search')}</button></form>
          <div id="found" style="display:grid;gap:4px;margin-top:8px"></div></div>
        <div class="panel"><div class="panel-h"><h3>Requests</h3></div><div id="reqs" style="display:grid;gap:4px"></div></div>
        <div class="panel"><div class="panel-h"><h3>Friends</h3><span class="chip" id="onCount"></span></div><div id="flist" style="display:grid;gap:2px"></div></div>
      </div>
      <section class="fr-chat" id="chatPane" aria-label="Chat"></section>
    </div>`;

    const person = (p, actions = '', on) => `<div class="person ${p.user_id === withId ? 'on' : ''}" data-id="${p.user_id}">${avatar(p, 40, on === undefined ? {} : { status: on ? 'on' : 'off' })}
      <span><a href="${personLink(p)}">${nameTag(p)}</a><small>@${esc(p.username)}${on ? ' · ' + esc(statusOf(p.user_id) || 'Online') : ''}</small></span>${actions}</div>`;

    async function load() {
      try { list = await api.friends(); } catch (e) { toast(errText(e), { kind: 'bad' }); return; }
      paint();
    }
    function paint() {
      const on = onlineIds(), fr = list.filter(f => f.status === 'friends').sort((a, b) => on.has(b.user_id) - on.has(a.user_id) || (b.last_msg || '').localeCompare(a.last_msg || ''));
      const inc = list.filter(f => f.status === 'incoming'), out = list.filter(f => f.status === 'outgoing');
      $('#reqs').innerHTML = inc.map(p => person(p, `<button class="btn xs primary" data-acc="${p.user_id}">${icon('check')}</button><button class="btn xs ghost" data-rm="${p.user_id}" aria-label="Decline">${icon('x')}</button>`)).join('')
        + out.map(p => person(p, `<small class="muted">Sent</small><button class="btn xs ghost" data-rm="${p.user_id}" aria-label="Cancel request">${icon('x')}</button>`)).join('') || '<p class="muted small">No requests.</p>';
      $('#flist').innerHTML = fr.map(p => `<a class="person ${p.user_id === withId ? 'on' : ''}" href="?with=${p.user_id}" data-chat="${p.user_id}">${avatar(p, 40, { status: on.has(p.user_id) ? 'on' : 'off' })}<span>${nameTag(p)}<small>${on.has(p.user_id) ? esc(statusOf(p.user_id) || 'Online') : '@' + esc(p.username)}</small></span>${p.unread ? `<i class="unread">${p.unread}</i>` : ''}</a>`).join('')
        || '<p class="muted small">No friends yet. Search for players above.</p>';
      $('#onCount').textContent = fr.filter(p => on.has(p.user_id)).length + ' online';
      if (withId && !$('#chatLog')) openChat(withId);
      if (!withId) { $('#chatPane').innerHTML = `<div class="empty">${icon('chat')}<h3>Your chats</h3><p>Pick a friend to start chatting, or invite them to a lobby.</p></div>`; $('#fr').classList.remove('chatting'); }
    }
    view.addEventListener('click', async e => {
      const acc = e.target.closest('[data-acc]'), rm = e.target.closest('[data-rm]'), add = e.target.closest('[data-add]'), chat = e.target.closest('[data-chat]');
      try {
        if (acc) { await api.friendAdd(acc.dataset.acc); ping(acc.dataset.acc, 'friend', { name: me.display_name, accepted: true }); toast(`${icon('check')} You’re now friends`, { kind: 'ok' }); await load(); refresh(); }
        if (rm) { await api.friendRemove(rm.dataset.rm); await load(); refresh(); }
        if (add) { const st = await api.friendAdd(add.dataset.add); ping(add.dataset.add, 'friend', { name: me.display_name, accepted: st === 'friends' }); add.outerHTML = `<small class="muted">${st === 'friends' ? 'Friends ✓' : 'Request sent'}</small>`; await load(); }
        if (chat) { e.preventDefault(); withId = chat.dataset.chat; history.replaceState({}, '', '?with=' + withId); paint(); openChat(withId); }
      } catch (x) { toast(errText(x), { kind: 'bad' }); }
    });

    async function search(q) {
      const host = $('#found'); if (String(q).trim().length < 2) { host.innerHTML = ''; return; }
      try {
        const r = await api.search(q);
        host.innerHTML = r.map(p => person(p, p.friend === 'none' ? `<button class="btn xs primary" data-add="${p.user_id}">${icon('plus')}Add</button>` : `<small class="muted">${{ friends: 'Friends', outgoing: 'Sent', incoming: 'Wants to be friends' }[p.friend]}</small>${p.friend === 'incoming' ? `<button class="btn xs primary" data-acc="${p.user_id}">${icon('check')}</button>` : ''}`)).join('') || '<p class="muted small">No players found.</p>';
      } catch (x) { host.innerHTML = `<p class="muted small">${esc(errText(x))}</p>`; }
    }
    $('#findF').addEventListener('submit', e => { e.preventDefault(); search($('#findQ').value); });
    $('#findQ').addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => search(e.target.value), 250); });
    if (qs.get('q')) search(qs.get('q'));

    async function openChat(id) {
      const f = list.find(x => x.user_id === id && x.status === 'friends'), pane = $('#chatPane');
      if (!f) { pane.innerHTML = `<div class="empty">${icon('lock')}<h3>Not friends yet</h3><p>You can chat once you’re both friends.</p></div>`; return; }
      $('#fr').classList.add('chatting');
      pane.innerHTML = `<div class="fr-head"><a class="btn xs ghost" href="friends.html" aria-label="Back">←</a>${avatar(f, 40, { status: onlineIds().has(id) ? 'on' : 'off' })}<div style="min-width:0;flex:1"><a href="${personLink(f)}">${nameTag(f)}</a><div>${badges(f)}</div></div>
        <button class="btn sm" type="button" id="invite">${icon('lobby')}Challenge</button></div>
        <div class="chat"><div class="chat-log" id="chatLog" aria-live="polite"></div>
        <form class="chat-in" id="chatF"><label class="sr" for="chatIn">Message</label><input id="chatIn" maxlength="500" autocomplete="off" placeholder="Message ${esc(f.display_name)}"><button class="btn primary sm" type="submit" aria-label="Send">${icon('send')}</button></form></div>`;
      const draw = msgs => {
        const log = $('#chatLog'); if (!log) return;
        log.innerHTML = msgs.length ? msgs.map(m => { const mine = m.sender === me.user_id; return `<div class="msg ${mine ? 'mine' : ''}">${mine ? '' : avatar(f, 26)}<div class="bubble">${esc(m.body)}<small>${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div></div>`; }).join('')
          : `<div class="msg sys">Say hi to ${esc(f.display_name)} 👋</div>`;
        log.scrollTop = log.scrollHeight;
      };
      const reload = async () => { try { draw(await api.dmList(id)); f.unread = 0; refresh(); } catch (x) { toast(errText(x), { kind: 'bad' }); } };
      await reload();
      $('#chatF').addEventListener('submit', async e => {
        e.preventDefault(); const inp = $('#chatIn'), body = inp.value.trim(); if (!body) return;
        inp.value = '';
        try { await api.dmSend(id, body); ping(id, 'dm', { name: me.display_name }); await reload(); } catch (x) { inp.value = body; toast(errText(x), { kind: 'bad' }); }
      });
      $('#invite').addEventListener('click', async () => {
        try { const l = await api.lobbyCreate({ game: 'cps-duel', name: `${me.display_name} vs ${f.display_name}`, isPublic: false, max: 2 }); ping(id, 'invite', { name: me.display_name, lobby: l.name, code: l.code }); location.href = 'lobby.html?id=' + l.id; }
        catch (x) { toast(errText(x), { kind: 'bad' }); }
      });
      $('#chatIn').focus();
      current = { id, reload };
    }
    document.addEventListener('pmo:friends', load);
    document.addEventListener('pmo:dm', ev => { if (current && ev.detail.from === current.id) current.reload(); load(); });
    onOnline(() => paint());
    await load();
  }
});
