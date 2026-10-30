import { boot, state, $, esc, icon, avatar, nameTag, buyTurbo, api } from '../ui.js';
import { PROMOUSER_URL } from '../data.js';

boot({
  page: 'turbo.html', title: 'ProMouser Turbo', gated: false,
  render(view, me) {
    const draw = () => {
      me = state.me;
      const demo = { display_name: me ? me.display_name : 'Your Name', username: 'you', turbo: true, name_grad: { colors: ['#22d3ee', '#a855f7', '#f472b6'], angle: 90 }, border: 'b-aurora', avatar_url: me && me.avatar_url };
      view.innerHTML = `<section class="turbo-hero"><span class="kicker">ProMouser Turbo</span><h2 class="grad-text">Turbo</h2>
        <div class="row center" style="gap:14px">${avatar(demo, 64)}<span style="font-size:1.8rem">${nameTag(demo)}</span></div>
        <p>Make your profile impossible to miss. A gradient username everywhere you appear, your own profile gradients, the Turbo battle pass track and an exclusive 3D mouse.</p>
        <div class="turbo-price">₹199 <small>/ month</small></div>
        ${me && me.turbo ? `<span class="badge turbo">${icon('turbo')}Active until ${new Date(me.turbo_until).toLocaleDateString('en-IN')}</span>` : ''}
        <div class="row center">${me ? `<button class="btn primary lg" type="button" id="getT">${icon('turbo')}${me.turbo ? 'Add a month' : 'Get Turbo'}</button>` : '<button class="btn primary lg" type="button" data-auth="signup">Create account to get Turbo</button>'}${me && me.turbo ? '<a class="btn ghost lg" href="settings.html#turbo">Style my profile</a>' : ''}</div>
        <p class="small muted">Already have <a href="${PROMOUSER_URL}ultra.html" target="_blank" rel="noopener" class="grad-text"><b>ProMouser Ultra</b></a>? It includes 1 month of Turbo. Same account, nothing to link.</p></section>
        <div class="perks">
          <div class="perk">${icon('star')}<h3>Gradient username</h3><p>Pick a preset or build your own 2–3 colour gradient. It shows in lobbies, chats, leaderboards and your profile.</p></div>
          <div class="perk">${icon('user')}<h3>Profile gradients</h3><p>Paint your profile banner with your own gradient, so your page looks nothing like anyone else’s.</p></div>
          <div class="perk">${icon('pass')}<h3>Turbo battle pass</h3><p>A second reward track: coins every tier, plus the Ember border, the Ember Strike mouse, the Void border and the mythic Spectre.</p></div>
          <div class="perk">${icon('mouse')}<h3>Turbo Hyperdrive</h3><p>The exclusive Turbo mouse and the Turbo Aurora border. Claimed instantly, and yours to keep.</p></div>
        </div>`;
      const g = $('#getT'); g && g.addEventListener('click', () => buyTurbo(draw));
    };
    draw();
  }
});
