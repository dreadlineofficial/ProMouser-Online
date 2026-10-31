# ProMouser Online

The social side of [ProMouser](https://promouser.website/): friends, chat, lobbies,
8 games, 3D digital mice, animated profile borders, a battle pass and ProMouser Turbo.

It's a static site (HTML, CSS and JavaScript modules, no build step). Accounts, coins,
items and chat live in the **same Supabase project as ProMouser**, so one account works on
both sites.

## Try it locally
```bash
python3 -m http.server 8000
```
Then open <http://localhost:8000>.

With no Supabase keys the site runs in **demo mode**. Everything is saved in your browser,
and each browser tab can be signed in as a different player, so you can try friends, chat,
lobbies and duels against yourself.

## Connect it to Supabase (shared accounts)
Do this after ProMouser is already connected.
1. In the Supabase **SQL Editor**, run ProMouser's `supabase/schema.sql`, then
   `supabase/test-payments.sql` (optional, keeps the demo checkout working), and then
   **`supabase/online.sql`** from this repo. All three are safe to re-run.
2. Put the **same** Project URL and publishable key in `supabase-config.js`:
   ```js
   window.PMO_SUPABASE = { url: 'https://YOUR-PROJECT.supabase.co', anonKey: 'sb_publishable_...', testPayments: true };
   ```
3. Go to **Authentication → URL Configuration** and add this site's address to
   **Redirect URLs**, for example `https://dreadlineofficial.github.io/ProMouser-Online/`.
4. Check **Storage**: `online.sql` creates a public `avatars` bucket. Each player can only
   write inside their own folder.
5. Leave **Realtime** on (it is by default). It carries chat notifications, online status,
   lobby presence and live game state.

You don't need anything else. Signing up on either site creates the account for both. A
ProMouser user just signs in here, and their plan, Turbo and CPS-test bests show on their profile.

## Hosting on GitHub Pages
In the repo on GitHub, go to **Settings → Pages**, set **Source: Deploy from a branch** and
pick **main / (root)**. The site will be at `https://dreadlineofficial.github.io/ProMouser-Online/`.

For a custom subdomain like `online.promouser.website`:
1. Add a `CNAME` file containing that name.
2. Create a DNS CNAME record pointing it to `dreadlineofficial.github.io`.
3. Update `ONLINE_URL` in ProMouser's `build.py` and `onlineUrl` in its `backend.js`.

## What's in it
| | |
|---|---|
| **Games** | All eight are 3D: Arena (a sunlit first-person shooter where opponents wear orange), CPS Duel, Reaction Duel, Click Royale, Aim Rush, Orb Tracking, Shooting Gallery and Pattern Recall. Solo, vs bots or in lobbies. Your showcase mouse stands on your pedestal in the duels. |
| **Social** | Friends and requests, live direct messages, online status, invites, public and private lobbies with join codes, lobby chat, ready-up. |
| **Collection** | 15 procedurally modelled 3D mice and 14 animated borders, from common to mythic. Earn them with coins, the battle pass or Turbo, or buy them in ₹. |
| **Profile** | Display name, username, bio, picture upload, border, showcase mouse, game stats, ProMouser stats. |
| **Turbo** (₹199/month) | A gradient username, a custom profile banner gradient, the Turbo battle pass track and exclusive items. ProMouser Ultra includes a whole year. |

## How it's protected
- **Server-side rules:** every change goes through checked functions in `online.sql`.
  - Prices come from the database.
  - Coins are capped at 120 per game and 2,000 a day.
  - Scores are checked against realistic limits.
  - Equipped items must be owned, and gradients need Turbo.
- **Private data:** direct messages can only be read by the two players in them, and only
  friends can message each other.
- **Realtime messages:** these never contain private content. A chat message is stored in
  the database, and Realtime only says "you have a new message".
- **Honest limits:**
  - Game results are reported by the player's browser, so a determined cheater can fake a
    score. The limits and coin caps keep that from breaking the economy.
  - In Arena, hits are reported by the shooter.

## Files
| Path | What it is |
|---|---|
| `index.html`, `play.html`, … | page shells; each loads `js/pages/<page>.js` |
| `js/api.js` | picks the backend: `api-sb.js` (Supabase) or `api-demo.js` (this browser) |
| `js/net.js` | realtime: Supabase channels, or BroadcastChannel between tabs in demo mode |
| `js/ui.js` | app shell, sign-in, avatars and borders, toasts, checkout |
| `js/data.js` | games, item catalog, battle pass, coin rules (mirrors `online.sql`) |
| `js/mouse3d.js` | the 3D mouse models, thumbnails and viewer (three.js) |
| `js/games/` | the games; `fps.js` is the first-person engine and daylight world kit, `stage3d.js` the studio set, pedestals and labels for the other 3D games, `common.js` the match and results toolkit |
| `assets/posters/` | game card art, rendered from the games themselves |
| `tools/test-online.js` | Playwright check: every page, six games to the results screen, Arena and Gallery, and a two-tab lobby duel |
| `supabase/online.sql` | tables, security rules and server functions |
| `vendor/` | three.js r170 (MIT) and supabase-js 2.117.3 (MIT) |
