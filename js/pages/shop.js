import { boot, state, $, $$, esc, num, icon, rarityTag, api, buyTurbo } from '../ui.js';
import { ITEMS, itemById, RARITY } from '../data.js';
import { RANK, priceHtml, artHtml, hydrateThumbs, openItem } from '../items-ui.js';

boot({
  page: 'shop.html', title: 'Shop',
  render(view, me) {
    let tab = (location.hash || '#featured').slice(1);
    const draw = () => {
      me = state.me;
      const sort = list => list.sort((a, b) => RANK[b.rarity] - RANK[a.rarity] || (b.inr || 0) - (a.inr || 0) || (b.coins || 0) - (a.coins || 0));
      const lists = {
        featured: sort(ITEMS.filter(i => ['m-prism', 'm-molten', 'm-galaxy', 'm-gold', 'b-crown', 'b-fire', 'b-glitch', 'm-chrome'].includes(i.id))),
        mice: sort(ITEMS.filter(i => i.kind === 'mouse')), borders: sort(ITEMS.filter(i => i.kind === 'border'))
      };
      const card = it => { const owned = me.inventory.includes(it.id); return `<button class="item ${owned ? '' : 'locked'}" type="button" data-item="${it.id}" style="--rc:${RARITY[it.rarity].color}">
        <div class="item-art">${artHtml(it, me)}</div>${rarityTag(it)}<h3>${esc(it.name)}</h3><div class="price">${priceHtml(it, owned)}</div></button>`; };
      view.innerHTML = `<div class="row between" style="margin-bottom:18px"><div class="tabs" role="tablist" style="flex:0 1 520px">${[['featured', 'Featured'], ['mice', '3D Mice'], ['borders', 'Borders'], ['turbo', 'Turbo']].map(([k, t]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${t}</button>`).join('')}</div>
        <span class="pill coins">${icon('coin')}<b>${num(me.coins)}</b> coins</span></div>
        ${tab === 'turbo' ? `<div class="turbo-hero"><span class="kicker">ProMouser Turbo</span><h2 class="grad-text">Stand out.</h2><p>Gradient username, custom profile gradients, the Turbo battle pass track and the exclusive Turbo Hyperdrive mouse and Aurora border.</p>
            <div class="turbo-price">₹199 <small>/ month</small></div>${me.turbo ? `<p class="badge turbo">Active until ${new Date(me.turbo_until).toLocaleDateString('en-IN')}</p>` : ''}
            <div class="row center"><button class="btn primary lg" type="button" id="getTurbo">${icon('turbo')}${me.turbo ? 'Add a month' : 'Get Turbo'}</button><a class="btn ghost lg" href="turbo.html">Everything in Turbo</a></div>
            <p class="small muted">Got ProMouser Ultra? It includes a full year of Turbo.</p></div>
            <div class="section-h"><h2>Turbo exclusives</h2></div><div class="items">${ITEMS.filter(i => i.turbo).map(card).join('')}</div>`
          : `<div class="items">${lists[tab].map(card).join('')}</div>
             <p class="small muted" style="margin-top:18px">Coins come from playing games (up to 2,000 a day) and the daily bonus. ₹ purchases use your ProMouser account. ${api.mode === 'demo' ? 'Demo mode: nothing is charged.' : ''}</p>`}`;
      $$('[data-tab]', view).forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; history.replaceState({}, '', '#' + tab); draw(); }));
      $$('[data-item]', view).forEach(b => b.addEventListener('click', () => openItem(itemById[b.dataset.item], draw)));
      const gt = $('#getTurbo', view); gt && gt.addEventListener('click', () => buyTurbo(draw));
      hydrateThumbs(view);
    };
    draw();
    addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t && t !== tab) { tab = t; draw(); } });
  }
});
