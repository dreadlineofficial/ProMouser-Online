/* =====================================================================
   ProMouser Online: shared data
   Games, the item catalog, battle pass rewards, coin rules and levels.
   Prices and rules here MIRROR supabase/online.sql (the server is the
   source of truth when Supabase is connected; demo mode uses these).
   ===================================================================== */

export const GAMES = [
  { id: 'arena', name: 'Arena', tag: '3D FPS', icon: 'crosshair', mp: true, bots: true, max: 8,
    blurb: 'Fast free-for-all in a sunlit 3D concrete yard. First to 15 eliminations, or the most in 3 minutes.', score: 'Eliminations', grad: ['#22d3ee', '#3b82f6'] },
  { id: 'cps-duel', name: 'CPS Duel', tag: 'Duel', icon: 'cursor', mp: true, bots: true, max: 8,
    blurb: '10 seconds. Click as fast as you can. Highest CPS wins.', score: 'CPS', grad: ['#f472b6', '#ef4444'] },
  { id: 'reaction-duel', name: 'Reaction Duel', tag: 'Duel', icon: 'bolt', mp: true, bots: true, max: 8, low: true,
    blurb: 'Best of 5. Wait for green, click first. Jump the gun and you lose the round.', score: 'Avg ms', grad: ['#22c55e', '#14b8a6'] },
  { id: 'royale', name: 'Click Royale', tag: 'Party', icon: 'crown', mp: true, bots: true, max: 12,
    blurb: 'Five-second rounds. The slowest clicker is knocked out each round. Last one standing wins.', score: 'Rounds survived', grad: ['#f59e0b', '#ef4444'] },
  { id: 'aim-rush', name: 'Aim Rush', tag: 'Aim', icon: 'target', mp: true, bots: false, max: 8,
    blurb: '30 seconds of targets. Faster hits and streaks score more. Misses cost you.', score: 'Points', grad: ['#a855f7', '#6366f1'] },
  { id: 'tracking', name: 'Orb Tracking', tag: 'Aim', icon: 'orbit', mp: true, bots: false, max: 8,
    blurb: 'Keep your cursor on a dodging orb for 30 seconds. Smooth aim wins.', score: '% on target', grad: ['#06b6d4', '#22c55e'] },
  { id: 'gallery', name: 'Shooting Gallery', tag: '3D', icon: 'gallery', mp: false, bots: false, max: 1,
    blurb: '60 seconds in a 3D range. Pop targets at every distance; small far ones score most.', score: 'Points', grad: ['#eab308', '#f97316'] },
  { id: 'simon', name: 'Pattern Recall', tag: 'Brain', icon: 'grid', mp: false, bots: false, max: 1,
    blurb: 'Watch the pattern, click it back. It gets one step longer every round.', score: 'Level', grad: ['#8b5cf6', '#ec4899'] }
];
export const gameById = Object.fromEntries(GAMES.map(g => [g.id, g]));
export const SCORE_LIMIT = { arena: 80, 'cps-duel': 35, 'reaction-duel': 2000, 'aim-rush': 20000, tracking: 100, gallery: 40000, royale: 12, simon: 60 };

// coins for one game (same formula as o_submit); capped at 120 per game and 2,000 a day
export function coinsFor(game, score, won) {
  const w = won ? 1 : 0;
  const c = 10 + ({
    arena: Math.trunc(score * 4) + w * 30,
    'cps-duel': Math.trunc(score * 2) + w * 25,
    'reaction-duel': Math.max(0, Math.trunc((400 - score) / 10)) + w * 25,
    'aim-rush': Math.trunc(score / 40),
    tracking: Math.trunc(score / 2),
    gallery: Math.trunc(score / 60),
    royale: Math.trunc(score * 5) + w * 30,
    simon: Math.trunc(score * 3)
  }[game] || 0);
  return Math.min(120, c);
}
export const DAILY_COIN_CAP = 2000;
export const xpFor = (coins, won) => 30 + (won ? 30 : 0) + Math.min(60, Math.floor(coins / 2));
export const levelOf = xp => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 150));
export const xpForLevel = lvl => 150 * (lvl - 1) * (lvl - 1);
export const BP_TIER_XP = 400, BP_TIERS = 30, BP_SEASON = 1;
export const START_COINS = 250;

/* ---------- items ----------
   look (mice): shape, body colour/material, accent, glow strip, pattern, animation — read by mouse3d.js
   look (borders): CSS class bd-<id> in online.css */
export const RARITY = {
  common: { name: 'Common', color: '#9ca3af' }, rare: { name: 'Rare', color: '#38bdf8' }, epic: { name: 'Epic', color: '#a855f7' },
  legendary: { name: 'Legendary', color: '#f59e0b' }, mythic: { name: 'Mythic', color: '#f472b6' }
};
export const ITEMS = [
  { id: 'm-starter', kind: 'mouse', name: 'Starter Classic', rarity: 'common', free: true, desc: 'Where everyone starts. Clean, matte and dependable.',
    look: { shape: 'classic', body: '#2a2d36', rough: .55, metal: .1, accent: '#3b3f4b', glow: '#ff2d55', wheel: '#111' } },
  { id: 'm-carbon', kind: 'mouse', name: 'Carbon Lite', rarity: 'common', coins: 400, desc: 'Woven carbon fibre with a red pinstripe.',
    look: { shape: 'classic', body: '#16181d', rough: .35, metal: .35, pattern: 'carbon', accent: '#20232b', glow: '#ef4444', wheel: '#ef4444' } },
  { id: 'm-arctic', kind: 'mouse', name: 'Arctic Honeycomb', rarity: 'rare', coins: 1200, desc: 'A featherweight white honeycomb shell with icy blue light.',
    look: { shape: 'honeycomb', body: '#d5dce8', rough: .5, metal: 0, accent: '#dfe6f0', glow: '#38bdf8', wheel: '#38bdf8' } },
  { id: 'm-toxic', kind: 'mouse', name: 'Toxic Neon', rarity: 'rare', coins: 1500, desc: 'Black shell, radioactive green underglow.',
    look: { shape: 'ergo', body: '#0d0f0c', rough: .3, metal: .2, accent: '#151a12', glow: '#84cc16', wheel: '#84cc16', pattern: 'stripes', patternColor: '#84cc16' } },
  { id: 'm-chrome', kind: 'mouse', name: 'Chrome Viper', rarity: 'epic', coins: 3000, desc: 'Mirror-polished chrome that reflects the whole room.',
    look: { shape: 'mini', body: '#c9ced8', rough: .1, metal: 1, accent: '#b8bec9', glow: '#e5e7eb', wheel: '#9ca3af' } },
  { id: 'm-sakura', kind: 'mouse', name: 'Sakura Bloom', rarity: 'epic', coins: 3500, desc: 'Soft pink pearl with cherry-blossom petals.',
    look: { shape: 'classic', body: '#f4a3c4', rough: .3, metal: .05, clearcoat: 1, pattern: 'petals', patternColor: '#ffe4ef', accent: '#f4a7c4', glow: '#f472b6', wheel: '#fff' } },
  { id: 'm-holo', kind: 'mouse', name: 'Holo Glass', rarity: 'epic', inr: 79, desc: 'Clear glass shell with a rainbow film. See the circuitry glow inside.',
    look: { shape: 'classic', body: '#cfe8ff', rough: .05, metal: 0, glass: true, iridescence: 1, accent: '#cfe8ff', glow: '#22d3ee', wheel: '#fff', inner: true } },
  { id: 'm-galaxy', kind: 'mouse', name: 'Galaxy Drift', rarity: 'legendary', inr: 129, desc: 'A swirling nebula with stars that drift as it turns.',
    look: { shape: 'ergo', body: '#1b1035', rough: .3, metal: .2, clearcoat: 1, pattern: 'galaxy', accent: '#2a1856', glow: '#a78bfa', wheel: '#c4b5fd', anim: 'drift' } },
  { id: 'm-molten', kind: 'mouse', name: 'Molten Core', rarity: 'legendary', inr: 149, desc: 'Cracked obsidian with lava pulsing through the seams.',
    look: { shape: 'ergo', body: '#120a08', rough: .6, metal: .1, pattern: 'lava', accent: '#1d0f0b', glow: '#ff6a00', wheel: '#ff6a00', anim: 'pulse' } },
  { id: 'm-gold', kind: 'mouse', name: 'Gold Rush', rarity: 'legendary', coins: 12000, inr: 149, desc: 'Solid polished gold. Grind 12,000 coins or skip the line.',
    look: { shape: 'classic', body: '#e8b53a', rough: .16, metal: 1, accent: '#e2b23a', glow: '#fff3b0', wheel: '#7a5a12' } },
  { id: 'm-prism', kind: 'mouse', name: 'Prism Phantom', rarity: 'mythic', inr: 199, desc: 'An iridescent shell that shifts through every colour, with a living RGB core.',
    look: { shape: 'mini', body: '#7c3aed', rough: .15, metal: .6, iridescence: 1, clearcoat: 1, accent: '#4c1d95', glow: '#22d3ee', wheel: '#f472b6', anim: 'hue' } },
  { id: 'm-circuit', kind: 'mouse', name: 'Circuit Board', rarity: 'epic', passTier: 20, track: 'free', desc: 'Green PCB with gold traces. Battle pass, tier 20.',
    look: { shape: 'classic', body: '#0b3d2e', rough: .5, metal: .2, pattern: 'circuit', patternColor: '#e9c46a', accent: '#0f4a38', glow: '#2dd4bf', wheel: '#e9c46a' } },
  { id: 'm-ember', kind: 'mouse', name: 'Ember Strike', rarity: 'epic', passTier: 15, track: 'turbo', desc: 'Smouldering black and orange. Turbo battle pass, tier 15.',
    look: { shape: 'mini', body: '#1a1210', rough: .4, metal: .3, pattern: 'stripes', patternColor: '#f97316', accent: '#2a1a14', glow: '#f97316', wheel: '#f97316' } },
  { id: 'm-spectre', kind: 'mouse', name: 'Season One Spectre', rarity: 'mythic', passTier: 30, track: 'turbo', desc: 'Ghostly translucent shell with a spectral core. Turbo battle pass, tier 30.',
    look: { shape: 'ergo', body: '#a5f3fc', rough: .1, metal: 0, glass: true, accent: '#67e8f9', glow: '#e879f9', wheel: '#e879f9', inner: true, anim: 'pulse' } },
  { id: 'm-hyperdrive', kind: 'mouse', name: 'Turbo Hyperdrive', rarity: 'mythic', turbo: true, desc: 'The Turbo mouse. A cyan-to-pink gradient shell with racing lights.',
    look: { shape: 'mini', body: '#22d3ee', body2: '#f472b6', rough: .2, metal: .5, clearcoat: 1, accent: '#a855f7', glow: '#ffffff', wheel: '#a855f7', anim: 'hue', pattern: 'stripes', patternColor: '#ffffff' } },

  { id: 'b-clean', kind: 'border', name: 'Clean Ring', rarity: 'common', free: true, desc: 'A simple ring. Classic.' },
  { id: 'b-crimson', kind: 'border', name: 'Crimson Pulse', rarity: 'common', coins: 300, desc: 'A red ring with a heartbeat glow.' },
  { id: 'b-frost', kind: 'border', name: 'Frost', rarity: 'rare', coins: 800, desc: 'Icy crystals around your picture.' },
  { id: 'b-pixel', kind: 'border', name: 'Pixel Party', rarity: 'rare', coins: 1000, desc: '8-bit blocks that cycle colour.' },
  { id: 'b-neon', kind: 'border', name: 'Neon Cycle', rarity: 'epic', coins: 2000, desc: 'A spinning neon ring that runs through the spectrum.' },
  { id: 'b-sakura', kind: 'border', name: 'Sakura Petals', rarity: 'epic', coins: 2500, desc: 'Cherry-blossom petals drifting around you.' },
  { id: 'b-fire', kind: 'border', name: 'Inferno', rarity: 'legendary', coins: 6000, inr: 49, desc: 'Living flames. Grind 6,000 coins or grab it now.' },
  { id: 'b-galaxy', kind: 'border', name: 'Galaxy', rarity: 'legendary', inr: 79, desc: 'A slowly orbiting starfield.' },
  { id: 'b-glitch', kind: 'border', name: 'Glitch', rarity: 'legendary', inr: 99, desc: 'Corrupted RGB split that jitters every few seconds.' },
  { id: 'b-crown', kind: 'border', name: 'Royal Crown', rarity: 'mythic', inr: 129, desc: 'A gold ring and a floating crown.' },
  { id: 'b-volt', kind: 'border', name: 'Volt', rarity: 'epic', passTier: 10, track: 'free', desc: 'Electric arcs. Battle pass, tier 10.' },
  { id: 'b-ember', kind: 'border', name: 'Ember', rarity: 'epic', passTier: 5, track: 'turbo', desc: 'Rising sparks. Turbo battle pass, tier 5.' },
  { id: 'b-void', kind: 'border', name: 'Void', rarity: 'legendary', passTier: 25, track: 'turbo', desc: 'A black-hole swirl. Turbo battle pass, tier 25.' },
  { id: 'b-aurora', kind: 'border', name: 'Turbo Aurora', rarity: 'mythic', turbo: true, desc: 'The Turbo border: shimmering aurora light.' }
];
export const itemById = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const FREE_ITEMS = ITEMS.filter(i => i.free).map(i => i.id);
export const TURBO_ITEMS = ITEMS.filter(i => i.turbo).map(i => i.id);

// battle pass season 1 (same as online_bp_rewards)
export const BP_REWARDS = (() => {
  const r = [];
  for (let t = 2; t <= 30; t += 2) if (t !== 10 && t !== 20) r.push({ track: 'free', tier: t, coins: t === 30 ? 1000 : 50 + Math.floor(t / 4) * 50 });
  r.push({ track: 'free', tier: 10, coins: 0, item: 'b-volt' }, { track: 'free', tier: 20, coins: 0, item: 'm-circuit' });
  for (let t = 1; t <= 30; t++) if (![5, 15, 25, 30].includes(t)) r.push({ track: 'turbo', tier: t, coins: 150 });
  r.push({ track: 'turbo', tier: 5, coins: 0, item: 'b-ember' }, { track: 'turbo', tier: 15, coins: 0, item: 'm-ember' },
    { track: 'turbo', tier: 25, coins: 0, item: 'b-void' }, { track: 'turbo', tier: 30, coins: 0, item: 'm-spectre' });
  return r.sort((a, b) => a.tier - b.tier);
})();

// ProMouser products sold here (₹). Same ids as the shared products table.
export const TURBO_PRODUCT = { id: 'turbo-1m', type: 'turbo', name: 'ProMouser Turbo (1 month)', price: 199, days: 30 };
export const itemProduct = it => ({ id: 'item-' + it.id, type: 'item', item: it.id, name: `${it.name} (${it.kind})`, price: it.inr });

export const GRAD_PRESETS = [
  { name: 'Turbo', colors: ['#22d3ee', '#a855f7', '#f472b6'], angle: 90 },
  { name: 'Sunset', colors: ['#f97316', '#ef4444', '#ec4899'], angle: 90 },
  { name: 'Toxic', colors: ['#84cc16', '#22c55e'], angle: 90 },
  { name: 'Ice', colors: ['#e0f2fe', '#38bdf8', '#6366f1'], angle: 90 },
  { name: 'Gold', colors: ['#fde68a', '#f59e0b', '#b45309'], angle: 90 },
  { name: 'Vapor', colors: ['#f472b6', '#818cf8'], angle: 90 },
  { name: 'Blood', colors: ['#7f1d1d', '#ef4444'], angle: 90 },
  { name: 'Mint', colors: ['#5eead4', '#a7f3d0'], angle: 90 }
];

export const PROMOUSER_URL = 'https://promouser.website/';
