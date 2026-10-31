import { boot, state, $, $$, esc, icon, avatar, nameTag, gradCss, toast, errText, refresh, buyTurbo, api } from '../ui.js';
import { ITEMS, itemById, RARITY, GRAD_PRESETS, PROMOUSER_URL } from '../data.js';
import { hydrateThumbs } from '../items-ui.js';

// crop to a centred square and shrink to 256 px before uploading
async function prepAvatar(file) {
  if (!/^image\//.test(file.type)) throw Object.assign(new Error('Pick an image file.'), { code: 'X' });
  if (file.size > 12e6) throw Object.assign(new Error('That image is over 12 MB.'), { code: 'X' });
  const bmp = await createImageBitmap(file), s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas'); c.width = c.height = 256;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 256, 256);
  const blob = await new Promise(r => c.toBlob(r, 'image/webp', .86)) || await new Promise(r => c.toBlob(r, 'image/jpeg', .88));
  return blob;
}

function gradEditor(host, label, value, onSave, sample) {
  let g = value ? JSON.parse(JSON.stringify(value)) : { colors: ['#22d3ee', '#a855f7', '#f472b6'], angle: 90 };
  const draw = () => {
    host.innerHTML = `<div class="grad-ed"><div class="grad-prev" style="${sample === 'banner' ? `background:${gradCss(g)};height:90px` : ''}">${sample === 'banner' ? '' : `<span class="nm grad" style="--g:${gradCss(g)}">${esc(state.me.display_name)}</span>`}</div>
      <div class="swatches">${GRAD_PRESETS.map((p, i) => `<button type="button" data-pre="${i}" title="${p.name}" style="background:${gradCss(p)}"></button>`).join('')}</div>
      <div class="colors">${g.colors.map((c, i) => `<input type="color" value="${c}" data-c="${i}" aria-label="Colour ${i + 1}">`).join('')}
        ${g.colors.length < 3 ? '<button class="btn xs" type="button" data-add>+ colour</button>' : '<button class="btn xs ghost" type="button" data-del>− colour</button>'}
        <label class="small muted" style="display:flex;gap:8px;align-items:center;flex:1">Angle<input type="range" min="0" max="360" value="${g.angle}" data-angle></label></div>
      <div class="row"><button class="btn primary sm" type="button" data-save>Save ${label}</button>${value ? '<button class="btn ghost sm" type="button" data-clear>Remove</button>' : ''}</div></div>`;
  };
  draw();
  host.addEventListener('input', e => { if (e.target.dataset.c != null) g.colors[+e.target.dataset.c] = e.target.value; if (e.target.dataset.angle != null) g.angle = +e.target.value; const pv = $('.grad-prev', host); if (sample === 'banner') pv.style.background = gradCss(g); else $('.nm', pv).style.setProperty('--g', gradCss(g)); });
  host.addEventListener('click', e => {
    const pre = e.target.closest('[data-pre]'); if (pre) { g = JSON.parse(JSON.stringify(GRAD_PRESETS[+pre.dataset.pre])); draw(); }
    if (e.target.closest('[data-add]')) { g.colors.push('#ffffff'); draw(); } if (e.target.closest('[data-del]')) { g.colors.pop(); draw(); }
    if (e.target.closest('[data-save]')) onSave(g); if (e.target.closest('[data-clear]')) onSave(null);
  });
}

boot({
  page: 'settings.html', title: 'Settings',
  render(view) {
    const draw = () => {
      const me = state.me, mice = ITEMS.filter(i => i.kind === 'mouse' && me.inventory.includes(i.id)), borders = ITEMS.filter(i => i.kind === 'border' && me.inventory.includes(i.id));
      view.innerHTML = `<div class="set">
        <section class="panel" id="profile"><h2 style="margin-bottom:14px">Profile</h2>
          <div class="av-edit">${avatar(me, 96)}<div style="display:grid;gap:8px"><label class="btn sm" for="avFile">${icon('user')}Upload picture</label><input id="avFile" type="file" accept="image/*" hidden>
            ${me.avatar_url ? '<button class="btn sm ghost" type="button" id="avDel">Remove picture</button>' : ''}<small class="muted">Square crop, 256 px. Keep it friendly.</small></div></div>
          <form id="pf" style="display:grid;gap:12px;margin-top:18px">
            <div class="grid g2"><label class="f">Display name<input name="display_name" maxlength="32" value="${esc(me.display_name)}" required></label>
            <label class="f">Username<input name="username" maxlength="20" value="${esc(me.username)}" pattern="[A-Za-z0-9_]{3,20}" required></label></div>
            <label class="f">Bio<textarea name="bio" maxlength="160" placeholder="Main game, mouse, rank…">${esc(me.bio)}</textarea></label>
            <div class="row"><button class="btn primary" type="submit">Save profile</button><a class="btn ghost" href="profile.html?u=${encodeURIComponent(me.username)}">View profile</a></div></form></section>
        <section class="panel" id="looks"><h2 style="margin-bottom:6px">Looks</h2><p class="muted small" style="margin-bottom:14px">Pick from what you own. Get more in the <a class="grad-text" href="shop.html"><b>shop</b></a> or the <a class="grad-text" href="pass.html"><b>battle pass</b></a>.</p>
          <h3 style="margin-bottom:10px">Profile border</h3><div class="pick">${borders.map(b => `<button type="button" data-border="${b.id}" aria-pressed="${me.border === b.id}">${avatar(me, 50, { border: b.id })}<span>${esc(b.name)}</span></button>`).join('')}<button type="button" data-border="" aria-pressed="${!me.border}">${avatar(me, 50, { border: null })}<span>None</span></button></div>
          <h3 style="margin:20px 0 10px">Showcase mouse</h3><div class="pick">${mice.map(m => `<button type="button" data-show="${m.id}" aria-pressed="${me.showcase === m.id}" style="--rc:${RARITY[m.rarity].color}"><img data-thumb="${m.id}" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><span>${esc(m.name)}</span></button>`).join('')}</div></section>
        <section class="panel" id="turbo"><div class="panel-h"><h2>Turbo style</h2>${me.turbo ? `<span class="badge turbo">${icon('turbo')}Active until ${new Date(me.turbo_until).toLocaleDateString('en-IN')}</span>` : ''}</div>
          ${me.turbo ? '' : `<div class="locked-note">${icon('lock')}<span>Gradient names and profile gradients are part of <b>ProMouser Turbo</b> (₹199/month, or included for a year with ProMouser Ultra). Anything you set stays saved if Turbo ends.</span><button class="btn primary sm" type="button" id="gTurbo">Get Turbo</button></div>`}
          <div class="grid g2" style="margin-top:14px;${me.turbo ? '' : 'opacity:.45;pointer-events:none'}"><div><h3 style="margin-bottom:10px">Gradient username</h3><div id="ge1"></div></div><div><h3 style="margin-bottom:10px">Profile banner gradient</h3><div id="ge2"></div></div></div></section>
        <section class="panel" id="account"><h2 style="margin-bottom:12px">Account</h2>
          <div class="stat-grid"><div class="stat"><span>Email</span><b style="font-size:1rem;overflow-wrap:anywhere">${esc(me.email || '')}</b></div><div class="stat"><span>ProMouser plan</span><b>${esc((me.promouser.plan || 'free').replace(/^./, c => c.toUpperCase()))}</b><small>shared account</small></div><div class="stat"><span>Mode</span><b>${api.mode === 'demo' ? 'Demo' : 'Online'}</b><small>${api.mode === 'demo' ? 'saved in this browser' : 'synced across devices'}</small></div></div>
          <p class="auth-note" style="margin-top:14px">${icon('users')}<span><b>Linked with ProMouser.</b> This is the same account as <a href="${PROMOUSER_URL}" target="_blank" rel="noopener">ProMouser</a>: your plan, Turbo and CPS test bests show here, and anything you buy works on both sites. ${api.mode === 'demo' ? 'In demo mode the two sites can’t share accounts; that works once Supabase is connected.' : ''}</span></p>
          <div class="row" style="margin-top:14px"><a class="btn" href="${PROMOUSER_URL}account.html" target="_blank" rel="noopener">${icon('external')}ProMouser account</a><button class="btn danger" type="button" data-auth="signout">${icon('out')}Sign out</button></div></section>
      </div>`;
      hydrateThumbs(view);
      const save = async (patch, msg) => { try { await api.setProfile(patch); await refresh(); toast(`${icon('check')} ${msg}`, { kind: 'ok' }); draw(); } catch (x) { toast(errText(x), { kind: 'bad' }); } };
      $('#pf').addEventListener('submit', e => { e.preventDefault(); const f = new FormData(e.target); save({ display_name: f.get('display_name'), username: f.get('username'), bio: f.get('bio') }, 'Profile saved'); });
      $('#avFile').addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        try { const blob = await prepAvatar(file), url = await api.uploadAvatar(blob); await save({ avatar_url: url }, 'Picture updated'); } catch (x) { toast(x.code === 'X' ? x.message : errText(x), { kind: 'bad' }); }
      });
      const del = $('#avDel'); del && del.addEventListener('click', () => save({ avatar_url: null }, 'Picture removed'));
      $$('[data-border]', view).forEach(b => b.addEventListener('click', () => save({ border: b.dataset.border || null }, 'Border equipped')));
      $$('[data-show]', view).forEach(b => b.addEventListener('click', () => save({ showcase: b.dataset.show }, 'Showcase updated')));
      const gt = $('#gTurbo'); gt && gt.addEventListener('click', () => buyTurbo(draw));
      gradEditor($('#ge1'), 'name', me.name_grad, g => save({ name_grad: g }, g ? 'Gradient name saved' : 'Gradient removed'));
      gradEditor($('#ge2'), 'banner', me.theme, g => save({ theme: g }, g ? 'Banner saved' : 'Banner removed'), 'banner');
      if (location.hash) { const t = $(location.hash); t && t.scrollIntoView(); }
    };
    draw();
  }
});
