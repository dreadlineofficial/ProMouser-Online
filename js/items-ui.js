/* Item helpers shared by the shop, profile, settings and battle pass pages:
   price labels, art (3D thumbnails / border previews) and the item detail modal. */
import { state, $, $$, esc, num, inr, icon, avatar, rarityTag, modal, closeModal, toast, errText, refresh, buyItem, buyTurbo, api } from './ui.js';
import { itemById, RARITY } from './data.js';

export const RANK = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
export function priceHtml(it, owned) {
  if (owned) return `<span class="owned">${icon('check')} Owned</span>`;
  const parts = [];
  if (it.coins != null) parts.push(`<span>${icon('coin')}${num(it.coins)}</span>`);
  if (it.inr != null) parts.push(`<span>${inr(it.inr)}</span>`);
  if (it.free) parts.push('<span>Free</span>');
  if (it.passTier) parts.push(`<span class="chip">${it.track === 'turbo' ? 'Turbo pass' : 'Battle pass'} · tier ${it.passTier}</span>`);
  if (it.turbo) parts.push('<span class="badge turbo">Turbo exclusive</span>');
  return parts.join('<span class="muted">or</span>');
}
export function artHtml(it, me) {
  return it.kind === 'mouse' ? `<img data-thumb="${it.id}" alt="${esc(it.name)}" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">` : `<div class="border-art">${avatar(me, 84, { border: it.id })}</div>`;
}
export async function hydrateThumbs(root = document) {
  const imgs = $$('img[data-thumb]', root); if (!imgs.length) return;
  const m = await import('./mouse3d.js');
  for (const img of imgs) { if (!img.isConnected || img.dataset.done) continue; img.dataset.done = 1; img.src = await m.thumb(img.dataset.thumb); }
}

export function openItem(it, onChange) {
  const me = state.me, owned = me.inventory.includes(it.id), r = RARITY[it.rarity], equipped = it.kind === 'border' ? me.border === it.id : me.showcase === it.id;
  const body = modal(`<div class="item-modal" style="--rc:${r.color}">
    <div class="viewer" id="iv">${it.kind === 'border' ? `<div class="border-art">${avatar(me, 170, { border: it.id })}</div>` : '<span class="viewer-hint">Drag to spin</span>'}</div>
    <div style="display:grid;gap:12px">${rarityTag(it)}<h2 style="margin:0">${esc(it.name)}</h2><p class="muted">${esc(it.desc || '')}</p>
      <div class="item"><div class="price" style="font-size:1rem">${priceHtml(it, owned)}</div></div>
      <div style="display:grid;gap:8px" id="acts"></div></div></div>`, { cls: 'wide', label: it.name });
  const acts = $('#acts', body);
  if (owned) acts.innerHTML = `<button class="btn primary" type="button" id="equip" ${equipped ? 'disabled' : ''}>${equipped ? 'Equipped ✓' : it.kind === 'border' ? 'Equip border' : 'Set as showcase mouse'}</button>`;
  else {
    if (it.coins != null) acts.insertAdjacentHTML('beforeend', `<button class="btn ${it.inr ? '' : 'primary'}" type="button" id="byCoins" ${me.coins < it.coins ? 'disabled' : ''}>${icon('coin')}Buy for ${num(it.coins)} coins</button>${me.coins < it.coins ? `<p class="small muted">You need ${num(it.coins - me.coins)} more coins. <a class="grad-text" href="play.html"><b>Play games</b></a> to earn them.</p>` : ''}`);
    if (it.inr != null) acts.insertAdjacentHTML('beforeend', `<button class="btn primary" type="button" id="byInr">Buy for ${inr(it.inr)}</button>`);
    if (it.passTier) acts.insertAdjacentHTML('beforeend', `<a class="btn primary" href="pass.html">Unlock at ${it.track === 'turbo' ? 'Turbo pass' : 'battle pass'} tier ${it.passTier}</a>`);
    if (it.turbo) acts.insertAdjacentHTML('beforeend', `<button class="btn primary" type="button" id="byTurbo">${icon('turbo')}Get Turbo (₹199/month)</button><p class="small muted">Turbo items are yours to keep, even after Turbo ends.</p>`);
  }
  let v = null;
  if (it.kind === 'mouse') import('./mouse3d.js').then(m => { if ($('#iv', body)) v = m.viewer($('#iv', body), it.id, { bloom: .7 }); });
  const done = async msg => { await refresh(); toast(msg, { kind: 'ok' }); closeModal(); onChange && onChange(); };
  const on = (sel, fn) => { const el = $(sel, body); el && el.addEventListener('click', async () => { el.disabled = true; try { await fn(); } catch (x) { toast(errText(x), { kind: 'bad' }); el.disabled = false; } }); };
  on('#equip', async () => { await api.setProfile(it.kind === 'border' ? { border: it.id } : { showcase: it.id }); await done(`${icon('check')} ${esc(it.name)} equipped`); });
  on('#byCoins', async () => { await api.buy(it.id); await done(`${icon('check')} ${esc(it.name)} is yours!`); });
  on('#byInr', async () => { closeModal(true); buyItem(it, () => onChange && onChange()); });
  on('#byTurbo', async () => { closeModal(true); buyTurbo(() => onChange && onChange()); });
}

