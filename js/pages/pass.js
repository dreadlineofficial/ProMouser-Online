import { boot, state, $, $$, esc, num, icon, toast, errText, refresh, buyTurbo, api } from '../ui.js';
import { BP_REWARDS, BP_TIER_XP, BP_TIERS, itemById, RARITY } from '../data.js';
import { hydrateThumbs } from '../items-ui.js';

boot({
  page: 'pass.html', title: 'Battle Pass',
  render(view) {
    const draw = () => {
      const me = state.me, tier = Math.min(BP_TIERS, Math.floor(me.bp_xp / BP_TIER_XP)), pct = tier >= BP_TIERS ? 100 : Math.round((me.bp_xp % BP_TIER_XP) / BP_TIER_XP * 100);
      const cell = (track, t) => {
        const r = BP_REWARDS.find(x => x.track === track && x.tier === t);
        if (!r) return `<div class="bp-cell empty ${track}"></div>`;
        const claimed = (me.bp_claims[track] || []).includes(t), can = tier >= t && !claimed && (track === 'free' || me.turbo), it = r.item && itemById[r.item];
        const art = it ? (it.kind === 'mouse' ? `<img data-thumb="${it.id}" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">` : `<span class="av bd ${it.id}" style="--s:44px"><span class="av-img"><b style="background:#222">★</b></span><span class="av-ring"></span></span>`) : icon('coin');
        return `<div class="bp-cell ${track} ${claimed ? 'claimed' : ''}" ${it ? `style="--rc:${RARITY[it.rarity].color}"` : ''}>${art}<span>${it ? esc(it.name) : num(r.coins) + ' coins'}</span>
          ${claimed ? '' : can ? `<button class="btn primary xs" type="button" data-claim="${track}:${t}">Claim</button>` : `<small class="muted">${tier < t ? '' : track === 'turbo' ? icon('lock') + ' Turbo' : ''}</small>`}</div>`;
      };
      const ready = BP_REWARDS.filter(r => tier >= r.tier && !(me.bp_claims[r.track] || []).includes(r.tier) && (r.track === 'free' || me.turbo)).length;
      view.innerHTML = `<section class="bp-head"><div><span class="kicker">Season 1</span><h2 style="margin:.2rem 0 .6rem">Battle pass · tier <span class="grad-text">${tier}</span> / ${BP_TIERS}</h2>
          <div class="xpbar" style="height:12px"><i style="width:${pct}%"></i></div><p class="small muted" style="margin-top:.5rem">${tier >= BP_TIERS ? 'Season complete!' : `${num(me.bp_xp % BP_TIER_XP)} / ${BP_TIER_XP} XP to tier ${tier + 1}`} · every game earns 30–120 XP${ready ? ` · <b style="color:var(--ok)">${ready} reward${ready > 1 ? 's' : ''} to claim</b>` : ''}</p></div>
        <div style="display:grid;gap:8px;justify-items:end">${me.turbo ? `<span class="badge turbo">${icon('turbo')}Turbo track unlocked</span>` : `<button class="btn primary" type="button" id="bpTurbo">${icon('turbo')}Unlock the Turbo track</button><small class="muted">₹199/month · 4 exclusive items</small>`}</div></section>
        <div class="bp-row-label">${icon('star')} Free track &nbsp;·&nbsp; <span class="grad-text">Turbo track below</span></div>
        <div class="bp-track"><div class="bp-cols">${Array.from({ length: BP_TIERS }, (_, i) => i + 1).map(t => `<div class="bp-col ${tier >= t ? 'reached' : ''}"><div class="bp-num">${t}</div>${cell('free', t)}${cell('turbo', t)}</div>`).join('')}</div></div>
        <p class="small muted">Tier 30 Turbo reward: the mythic <b>Season One Spectre</b> mouse. Free track: the Volt border at tier 10 and the Circuit Board mouse at tier 20.</p>`;
      hydrateThumbs(view);
      $$('[data-claim]', view).forEach(b => b.addEventListener('click', async () => {
        const [track, t] = b.dataset.claim.split(':'); b.disabled = true;
        try { await api.claimTier(track, +t); await refresh(); toast(`${icon('check')} Reward claimed`, { kind: 'ok' }); draw(); } catch (x) { toast(errText(x), { kind: 'bad' }); b.disabled = false; }
      }));
      const bt = $('#bpTurbo'); bt && bt.addEventListener('click', () => buyTurbo(draw));
      const cur = $(`.bp-col:nth-child(${Math.max(1, tier)})`, view); cur && cur.scrollIntoView({ inline: 'center', block: 'nearest' });
    };
    draw();
  }
});
