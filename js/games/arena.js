/* =====================================================================
   Neon Arena: 3D free-for-all. First to 15 eliminations or the most in 3 minutes.
   Solo vs bots, or a lobby match (positions synced ~12x/second, hits
   reported by the shooter, bots simulated by the host).
   Controls: mouse to aim (click to lock), left click fire, WASD move,
   Shift sprint, Space jump, R reload, Tab scores, arrow keys also turn.
   ===================================================================== */
import { THREE, engine, look, gun, fx, crosshair, sfx, textSprite } from './fps.js';
import { results, sleep, countdown, avatar, nameTag, esc } from './common.js';
import { buildMouse, animateMouse } from '../mouse3d.js';

const FRAG_LIMIT = 15, MATCH_MS = 180000, R = .38, STEP = .45, EYE = 1.62, GRAV = 22;
const V3 = THREE.Vector3;

/* ---------- map: [x, z, width, depth, height, glow] ---------- */
function mapBoxes() {
  const b = [[0, -32, 66, 2, 7, 1], [0, 32, 66, 2, 7, 1], [-32, 0, 2, 66, 7, 2], [32, 0, 2, 66, 7, 2], [0, 0, 9, 9, 1.2, 0], [0, 0, 3.2, 3.2, 4.2, 2]];
  const q = [[9, 9, 4, 1.4, 1.35, 1], [17, 5, 1.6, 6, 2.4, 2], [7, 19, 6, 1.6, 1.3, 1], [22, 22, 5, 5, 3.2, 2], [13, -3, 1.4, 4, 1.4, 1], [25, 11, 3, 3, 1.25, 2], [4, 26, 2, 4, 2.6, 1], [20, 16, 1.2, 1.2, 4, 1]];
  q.forEach(([x, z, w, d, h, c]) => { [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], i) => b.push([x * sx, z * sz, w, d, h, (c + i) % 3])); });
  return b.map(([x, z, w, d, h, c]) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, top: h, c }));
}
const SPAWNS = [[-26, -26], [26, 26], [-26, 26], [26, -26], [0, -26], [0, 26], [-26, 0], [26, 0], [-14, -12], [14, 12]];
const COLORS = ['#22d3ee', '#f472b6', '#a855f7', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6', '#eab308', '#14b8a6', '#e879f9', '#fb7185', '#84cc16'];

function floorTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#7c3aed'; x.lineWidth = 3; x.strokeRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(34,211,238,.35)'; x.lineWidth = 1; x.strokeRect(64, 64, 128, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 16); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function buildWorld(scene, boxes) {
  scene.background = new THREE.Color('#0b0518'); scene.fog = new THREE.FogExp2('#120a26', .016);
  // sky dome: purple horizon fading to a starry black zenith
  const sc = document.createElement('canvas'); sc.width = 16; sc.height = 256; const sx = sc.getContext('2d'); const sg = sx.createLinearGradient(0, 0, 0, 256);
  sg.addColorStop(0, '#02010a'); sg.addColorStop(.42, '#140a33'); sg.addColorStop(.5, '#5b1d8f'); sg.addColorStop(.53, '#f472b6'); sg.addColorStop(.56, '#2a0f4a'); sg.addColorStop(1, '#05020c'); sx.fillStyle = sg; sx.fillRect(0, 0, 16, 256);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide, fog: false, depthWrite: false })));
  scene.add(new THREE.HemisphereLight('#a5b4fc', '#2a1240', 1.05));
  const sun = new THREE.DirectionalLight('#c7d2fe', 1.1); sun.position.set(18, 30, 12); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 80 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005; scene.add(sun);
  [['#22d3ee', -20, -20], ['#f472b6', 20, 20], ['#a855f7', -20, 20], ['#f59e0b', 20, -20], ['#a855f7', 0, 0]].forEach(([c, x, z]) => { const l = new THREE.PointLight(c, 70, 42, 1.4); l.position.set(x, 6, z); scene.add(l); });
  const ft = floorTex();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshStandardMaterial({ color: '#0d0b16', roughness: .32, metalness: .6, emissive: '#ffffff', emissiveMap: ft, emissiveIntensity: .95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const glows = ['#22d3ee', '#f472b6', '#a855f7'].map(c => new THREE.LineBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2), toneMapped: false }));
  // walls and cover: dark panels with glowing neon bands
  const band = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 256); x.fillStyle = '#fff'; x.fillRect(0, 26, 64, 6); x.fillRect(0, 200, 64, 3); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t; })();
  const mats = [['#2a2440', '#22d3ee'], ['#2f2350', '#f472b6'], ['#1f2a44', '#a855f7']].map(([c, e]) => new THREE.MeshStandardMaterial({ color: c, roughness: .42, metalness: .55, emissive: e, emissiveMap: band, emissiveIntensity: 1.6 }));
  const solid = [];
  boxes.forEach(b => {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, geo = new THREE.BoxGeometry(w, b.top, d), m = new THREE.Mesh(geo, mats[b.c]);
    m.position.set((b.x0 + b.x1) / 2, b.top / 2, (b.z0 + b.z1) / 2); m.castShadow = m.receiveShadow = true; scene.add(m); solid.push(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), glows[b.c]); e.position.copy(m.position); scene.add(e);
  });
  // centrepiece: a giant Prism Phantom spinning over the tower
  const hero = buildMouse('m-prism'); hero.scale.setScalar(2.2); hero.position.set(0, 6.2, 0); scene.add(hero);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, .05, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color('#22d3ee').multiplyScalar(2.5), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 4.35; scene.add(ring);
  const sign = textSprite('PROMOUSER ARENA', { color: '#ffffff', glow: '#f472b6', size: 70, w: 1024, h: 160 }); sign.scale.set(12, 1.9, 1); sign.position.set(0, 6.4, -30.6); scene.add(sign);
  const sign2 = sign.clone(); sign2.position.set(0, 6.4, 30.6); scene.add(sign2);
  // floating dust
  const n = 500, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([(Math.random() - .5) * 62, Math.random() * 10, (Math.random() - .5) * 62], i * 3);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#c4b5fd', size: .05, transparent: true, opacity: .6 })); scene.add(dust);
  return { solid, tick(t) { hero.rotation.y = t * .5; hero.position.y = 6.2 + Math.sin(t * 1.2) * .25; animateMouse(hero, t); ring.rotation.z = t * .3; dust.rotation.y = t * .01; } };
}

/* player-shaped avatar for bots and other players, with head and body hitboxes */
function avatarMesh(scene, card, color) {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: '#1c1a28', roughness: .4, metalness: .6 }), accent = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: .3 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.36, .78, 6, 16), suit); body.position.y = .95; body.castShadow = true; g.add(body);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, .36), accent); chest.position.set(0, 1.2, 0); g.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 20, 16), suit); head.position.y = 1.62; head.castShadow = true; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.34, .09, .12), accent); visor.position.set(0, 1.65, -.17); g.add(visor);
  const gunM = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .55), suit); gunM.position.set(.3, 1.15, -.3); g.add(gunM);
  const tag = textSprite(card.display_name, { color: '#fff', glow: color, size: 48 }); tag.position.y = 2.2; tag.scale.set(1.6, .4, 1); g.add(tag);
  body.userData = { owner: card.user_id, head: false }; head.userData = { owner: card.user_id, head: true };
  scene.add(g);
  return { g, hit: [body, head] };
}

export async function start(stage, ctx) {
  const E = engine(stage, { bloom: .75 }), { scene, cam } = E, boxes = mapBoxes(), world = buildWorld(scene, boxes);
  const L = look(E.canvas, cam), G = gun(cam, { color: '#22d3ee' }), F = fx(scene), X = crosshair(stage);
  const ray = new THREE.Raycaster(), me = ctx.me.user_id, lobby = ctx.mode === 'lobby';
  const score = {}; ctx.all.forEach(p => { score[p.user_id] = { kills: 0, deaths: 0, card: p }; });
  const colorOf = id => COLORS[Math.abs([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % COLORS.length];

  /* ---------- physics shared by the player and bots ---------- */
  function groundAt(p, feet) { let g = 0; for (const b of boxes) if (p.x > b.x0 - R && p.x < b.x1 + R && p.z > b.z0 - R && p.z < b.z1 + R && feet >= b.top - STEP && b.top > g) g = b.top; return g; }
  function collide(p, feet) {
    for (const b of boxes) {
      if (!(p.x > b.x0 - R && p.x < b.x1 + R && p.z > b.z0 - R && p.z < b.z1 + R) || feet >= b.top - STEP) continue;
      const dx0 = p.x - (b.x0 - R), dx1 = b.x1 + R - p.x, dz0 = p.z - (b.z0 - R), dz1 = b.z1 + R - p.z, m = Math.min(dx0, dx1, dz0, dz1);
      if (m === dx0) p.x = b.x0 - R; else if (m === dx1) p.x = b.x1 + R; else if (m === dz0) p.z = b.z0 - R; else p.z = b.z1 + R;
    }
  }
  const spawnPoint = () => { const others = Object.values(ents).filter(e => e.alive).map(e => e.pos); let best = SPAWNS[0], bd = -1; [...SPAWNS].sort(() => Math.random() - .5).forEach(s => { const d = Math.min(99, ...others.map(o => Math.hypot(o.x - s[0], o.z - s[1]))); if (d > bd) { bd = d; best = s; } }); return new V3(best[0], 0, best[1]); };

  /* ---------- entities: me, bots, remote players ---------- */
  const ents = {};
  const P = ents[me] = { id: me, card: ctx.card, pos: new V3(), vel: new V3(), hp: 100, alive: true, lastHurt: 0, ammo: 30, reloading: 0, nextShot: 0 };
  P.pos.copy(spawnPoint()); L.yaw = Math.atan2(-P.pos.x, -P.pos.z) + Math.PI;
  const hitboxes = [];
  const addAvatar = (card, isBot) => { const a = avatarMesh(scene, card, colorOf(card.user_id)); hitboxes.push(...a.hit); const e = ents[card.user_id] = { id: card.user_id, card, bot: isBot, pos: new V3(), target: new V3(), yaw: 0, hp: 100, alive: true, mesh: a.g, nextThink: 0, nextShot: 0, wp: null, strafe: 1 }; e.pos.copy(spawnPoint()); e.target.copy(e.pos); return e; };
  ctx.bots.forEach(b => addAvatar(b, true));
  ctx.players.filter(p => p.user_id !== me).forEach(p => addAvatar(p, false));

  /* ---------- HUD ---------- */
  const hudEl = document.createElement('div'); hudEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3;font-weight:800';
  hudEl.innerHTML = `<div id="vig" style="position:absolute;inset:0;background:radial-gradient(circle,transparent 45%,rgba(255,30,60,.55));opacity:0;transition:opacity .2s"></div>
    <div style="position:absolute;left:16px;top:14px" class="row"><span class="pill" id="kd">0 / 0</span></div>
    <div style="position:absolute;left:50%;top:14px;transform:translateX(-50%)" class="row"><span class="pill" id="clock">3:00</span><span class="pill" id="lead"></span></div>
    <div id="feed" style="position:absolute;right:16px;top:14px;display:grid;gap:6px;justify-items:end;font-size:.82rem"></div>
    <div style="position:absolute;left:16px;bottom:16px;width:min(280px,40vw)"><div class="row between small"><span>HEALTH</span><b id="hpN">100</b></div><div class="xpbar" style="height:10px"><i id="hpB" style="width:100%;background:linear-gradient(90deg,#34d399,#22d3ee)"></i></div></div>
    <div style="position:absolute;right:16px;bottom:12px;text-align:right"><div class="gbig" id="ammo" style="font-size:3rem">30</div><small class="muted" id="ammoS">/ 30 · R to reload</small></div>
    <div id="dead" style="position:absolute;inset:0;display:none;place-items:center;background:rgba(10,0,6,.55)"><div class="center"><div class="gbig" style="color:#ff4d6d">ELIMINATED</div><p id="deadBy"></p></div></div>
    <div id="board" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;min-width:min(460px,90vw)" class="panel"></div>`;
  stage.appendChild(hudEl);
  const $h = s => hudEl.querySelector(s);
  const feed = html => { const d = document.createElement('div'); d.className = 'pill'; d.innerHTML = html; $h('#feed').prepend(d); setTimeout(() => d.remove(), 5000); while ($h('#feed').children.length > 5) $h('#feed').lastChild.remove(); };
  const ranking = () => Object.values(score).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  const board = () => { $h('#board').innerHTML = `<h3 style="margin-bottom:10px">Scoreboard</h3><ol class="standings">${ranking().map((s, i) => `<li class="${s.card.user_id === me ? 'me' : ''}"><span class="pos">${i + 1}</span>${avatar(s.card, 26)}<span>${nameTag(s.card)}${s.card.bot ? ' <small class="muted">bot</small>' : ''}</span><b>${s.kills} / ${s.deaths}</b></li>`).join('')}</ol>`; };
  const hudTick = (now, endAt) => {
    $h('#kd').textContent = `${score[me].kills} kills · ${score[me].deaths} deaths`; $h('#hpN').textContent = Math.ceil(P.hp); $h('#hpB').style.width = Math.max(0, P.hp) + '%';
    $h('#ammo').textContent = P.reloading ? '··' : P.ammo; const left = Math.max(0, endAt - now); $h('#clock').textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    const top = ranking()[0]; $h('#lead').innerHTML = top ? `Leader: ${esc(top.card.display_name)} · ${top.kills}` : '';
    $h('#board').style.display = L.keys.has('Tab') ? 'block' : 'none'; if (L.keys.has('Tab')) board();
    $h('#vig').style.opacity = Math.max(0, 1 - (now - P.lastHurt) / 600) * .9;
  };

  /* ---------- combat ---------- */
  let over = false;
  function kill(victim, killer, head) {
    if (!score[victim] || !score[killer]) return;
    score[killer].kills++; score[victim].deaths++;
    const k = score[killer].card, v = score[victim].card;
    feed(`${nameTag(k)} <span class="muted">${head ? '🎯' : '›'}</span> ${nameTag(v)}`);
    if (killer === me && victim !== me) { sfx('kill'); X.hit(true); }
    const e = ents[victim]; if (e) { e.alive = false; e.hp = 0; if (e.mesh) e.mesh.visible = false; }
    if (victim === me) { $h('#dead').style.display = 'grid'; $h('#deadBy').innerHTML = `by ${nameTag(k)} · respawning…`; }
    if (ctx.isHost && score[killer].kills >= FRAG_LIMIT && !over) ctx.emit('end', {});
    setTimeout(() => respawn(victim), 3000);
  }
  function respawn(id) {
    const e = ents[id]; if (!e || over) return;
    e.hp = 100; e.alive = true; e.pos.copy(spawnPoint()); if (e.target) e.target.copy(e.pos); if (e.mesh) e.mesh.visible = true;
    if (id === me) { P.ammo = 30; P.reloading = 0; $h('#dead').style.display = 'none'; }
  }
  const damage = (id, dmg, from, head) => {   // applied by whoever owns the entity
    const e = ents[id]; if (!e || !e.alive || over) return;
    e.hp -= dmg; if (id === me) { P.lastHurt = performance.now(); sfx('hurt'); }
    if (e.hp <= 0) ctx.emit('kill', { victim: id, killer: from, head });
  };
  ctx.listen('kill', d => kill(d.victim, d.killer, d.head));
  ctx.listen('hit', d => { if (d.to === me || (ctx.isHost && ents[d.to] && ents[d.to].bot)) damage(d.to, d.dmg, d.from, d.head); });
  const hitEnt = (id, dmg, from, head) => { const e = ents[id]; if (!e) return; if (id === me || (e.bot && ctx.isHost)) damage(id, dmg, from, head); else ctx.send('hit', { to: id, dmg, from, head }); };
  const losClear = (a, b) => { const dir = new V3().subVectors(b, a), d = dir.length(); ray.set(a, dir.normalize()); ray.far = d; return !ray.intersectObjects(world.solid, false).length; };

  function shoot(now) {
    if (!P.alive || P.reloading || now < P.nextShot || over) return;
    if (P.ammo <= 0) { P.reloading = now + 1600; return; }
    P.ammo--; P.nextShot = now + 100; G.fire(); sfx('shot');
    const moving = L.keys.has('KeyW') || L.keys.has('KeyA') || L.keys.has('KeyS') || L.keys.has('KeyD'), spread = (moving ? .022 : .007) * (P.vel.y !== 0 ? 1.8 : 1);
    const dir = new V3(0, 0, -1).applyQuaternion(cam.quaternion); dir.x += (Math.random() - .5) * spread; dir.y += (Math.random() - .5) * spread; dir.z += (Math.random() - .5) * spread; dir.normalize();
    ray.set(cam.getWorldPosition(new V3()), dir); ray.far = 120;
    const live = hitboxes.filter(h => ents[h.userData.owner] && ents[h.userData.owner].alive), hits = ray.intersectObjects([...world.solid, ...live], false);
    const end = hits.length ? hits[0].point : ray.ray.at(120, new V3());
    F.tracer(G.muzzle.getWorldPosition(new V3()), end, '#a5f3fc');
    if (hits.length && hits[0].object.userData.owner) {
      const h = hits[0].object.userData; X.hit(h.head); sfx('hit'); F.sparks(end, h.head ? '#ff4d6d' : '#fde68a', 14);
      hitEnt(h.owner, h.head ? 45 : 18, me, h.head);
    } else if (hits.length) F.sparks(end, '#a5f3fc', 8);
    L.pitch = Math.min(1.45, L.pitch + .006); L.yaw += (Math.random() - .5) * .004;   // recoil
  }

  /* ---------- bots (solo, or simulated by the lobby host) ---------- */
  const waypoints = []; for (let x = -27; x <= 27; x += 4.5) for (let z = -27; z <= 27; z += 4.5) { const p = new V3(x, 0, z); if (groundAt(p, 0) === 0 && !boxes.some(b => x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1)) waypoints.push(p); }
  function botThink(b, now) {
    if (!b.alive) return;
    const head = b.pos.clone().setY(1.6); let best = null, bd = 42;
    Object.values(ents).forEach(o => { if (o === b || !o.alive) return; const d = o.pos.distanceTo(b.pos); if (d < bd && losClear(head, o.pos.clone().setY(1.5))) { bd = d; best = o; } });
    b.enemy = best; b.nextThink = now + 220 + Math.random() * 140;
    if (!best && (!b.wp || b.pos.distanceTo(b.wp) < 1.5)) b.wp = waypoints[Math.floor(Math.random() * waypoints.length)];
    if (Math.random() < .25) b.strafe *= -1;
  }
  function botStep(b, dt, now) {
    if (!b.alive) return;
    const skill = b.card.skill || 1, sp = 4.4 * Math.min(1.25, skill);
    let mv = new V3();
    if (b.enemy && b.enemy.alive) {
      const to = new V3().subVectors(b.enemy.pos, b.pos); to.y = 0; const d = to.length(); to.normalize();
      b.yaw = Math.atan2(-to.x, -to.z);
      const side = new V3(-to.z, 0, to.x).multiplyScalar(b.strafe); mv.add(side.multiplyScalar(.8)); if (d > 17) mv.add(to); else if (d < 7) mv.sub(to.clone().multiplyScalar(.6));
      if (now > b.nextShot) {
        b.nextShot = now + (150 + Math.random() * 160) / skill;
        const tgtMoving = b.enemy.id === me ? (L.keys.size > 0) : !!b.enemy.wp, p = THREE.MathUtils.clamp((.42 * skill - d / 90) * (tgtMoving ? .8 : 1), .07, .7);
        const from = b.pos.clone().setY(1.2), toP = b.enemy.pos.clone().setY(1.2 + (Math.random() - .5) * .6);
        if (Math.random() < p) { const head = Math.random() < .12; F.tracer(from, toP, '#fca5a5'); hitEnt(b.enemy.id, head ? 30 : 11, b.id, head); }
        else { const miss = toP.clone().add(new V3((Math.random() - .5) * 2, (Math.random() - .5), (Math.random() - .5) * 2)); F.tracer(from, miss, '#fca5a5'); }
      }
    } else if (b.wp) { const to = new V3().subVectors(b.wp, b.pos); to.y = 0; if (to.lengthSq() > .01) { to.normalize(); mv.add(to); b.yaw = Math.atan2(-to.x, -to.z); } }
    if (mv.lengthSq() > 0) { mv.normalize().multiplyScalar(sp * dt); const before = b.pos.clone(); b.pos.add(mv); collide(b.pos, 0); if (b.pos.distanceTo(before) < sp * dt * .3) b.wp = waypoints[Math.floor(Math.random() * waypoints.length)]; }
  }

  /* ---------- network ---------- */
  ctx.listen('st', d => { if (d.id === me) return; const e = ents[d.id]; if (e && !e.bot) { e.target.set(d.p[0], d.p[1], d.p[2]); e.yaw = d.y; if (d.a !== e.alive) { e.alive = d.a; e.mesh.visible = d.a; } } if (d.b && !ctx.isHost) d.b.forEach(([id, x, z, y, a]) => { const b = ents[id]; if (b) { b.target.set(x, 0, z); b.yaw = y; b.alive = a; b.mesh.visible = a; } }); });
  let endAt = Infinity;
  ctx.listen('end', () => { if (!over) finish(); });

  /* ---------- start ---------- */
  const intro = document.createElement('div'); intro.className = 'gover';
  intro.innerHTML = `<div class="gover-card"><h2 class="grad-text" style="font-size:3rem">Neon Arena</h2><p class="muted">First to ${FRAG_LIMIT} eliminations, or the most in 3 minutes.</p>
    <p class="small muted">Mouse aim · Left click fire · WASD move · Shift sprint · Space jump · R reload · Tab scores</p><button class="btn primary lg" type="button" id="lockBtn">Click to play</button></div>`;
  stage.appendChild(intro);
  await new Promise(res => { intro.querySelector('#lockBtn').addEventListener('click', () => { L.lock(); res(); }); if (lobby) setTimeout(res, 6000); });
  intro.remove();
  E.canvas.addEventListener('mousedown', e => { if (e.button === 0) { if (!L.locked) L.lock(); L.buttons = 1; } });
  addEventListener('mouseup', e => { if (e.button === 0) L.buttons = 0; });
  await ctx.sync('go');
  await countdown(stage);
  endAt = performance.now() + MATCH_MS;

  /* ---------- loop ---------- */
  let last = performance.now(), sent = 0, raf = 0;
  stage.__arena = { P, L, ents, score, shoot: () => shoot(performance.now() + 1e5) };   // for automated tests
  const frame = now => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
    L.apply(dt);
    if (P.alive) {
      const k = L.keys, fwd = new V3(-Math.sin(L.yaw), 0, -Math.cos(L.yaw)), right = new V3(-fwd.z, 0, fwd.x), wish = new V3();
      if (k.has('KeyW')) wish.add(fwd); if (k.has('KeyS')) wish.sub(fwd); if (k.has('KeyD')) wish.add(right); if (k.has('KeyA')) wish.sub(right);
      const speed = (k.has('ShiftLeft') || k.has('ShiftRight')) && k.has('KeyW') ? 8.6 : 6.2;
      if (wish.lengthSq()) wish.normalize().multiplyScalar(speed);
      const ground = groundAt(P.pos, P.pos.y), onGround = P.pos.y <= ground + .001;
      const accel = onGround ? 14 : 3; P.vel.x += (wish.x - P.vel.x) * Math.min(1, accel * dt); P.vel.z += (wish.z - P.vel.z) * Math.min(1, accel * dt);
      if (onGround && k.has('Space')) P.vel.y = 7.6;
      P.vel.y -= GRAV * dt; P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; collide(P.pos, P.pos.y);
      P.pos.y += P.vel.y * dt; const g2 = groundAt(P.pos, P.pos.y + .3); if (P.pos.y <= g2) { P.pos.y = g2; P.vel.y = 0; }
      P.pos.x = THREE.MathUtils.clamp(P.pos.x, -30.5, 30.5); P.pos.z = THREE.MathUtils.clamp(P.pos.z, -30.5, 30.5);
      if (k.has('KeyR') && P.ammo < 30 && !P.reloading) P.reloading = now + 1600;
      if (P.reloading && now >= P.reloading) { P.reloading = 0; P.ammo = 30; }
      if (L.buttons) shoot(now);
      if (now - P.lastHurt > 4000 && P.hp < 100) P.hp = Math.min(100, P.hp + 18 * dt);
      G.update(dt, wish.lengthSq() > 0 && onGround, !!P.reloading);
    }
    cam.position.set(P.pos.x, P.pos.y + EYE, P.pos.z);
    if (ctx.isHost) Object.values(ents).forEach(b => { if (b.bot) { if (now > b.nextThink) botThink(b, now); botStep(b, dt, now); } });
    Object.values(ents).forEach(e => { if (!e.mesh) return; if (!ctx.isHost || !e.bot) e.pos.lerp(e.target, Math.min(1, dt * 12)); e.mesh.position.copy(e.pos); e.mesh.rotation.y = e.yaw; });
    if (lobby && now - sent > 80) { sent = now; ctx.send('st', { id: me, p: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)], y: +L.yaw.toFixed(3), a: P.alive, b: ctx.isHost ? ctx.bots.map(b => { const e = ents[b.user_id]; return [b.user_id, +e.pos.x.toFixed(2), +e.pos.z.toFixed(2), +e.yaw.toFixed(2), e.alive]; }) : undefined }); }
    world.tick(t); F.update(dt); hudTick(now, endAt);
    if (ctx.isHost && now > endAt && !over) ctx.emit('end', {});
    E.render();
  };
  raf = requestAnimationFrame(frame);

  function finish() {
    over = true; cancelAnimationFrame(raf); L.dispose();
    const st = ranking(), rank = st.findIndex(s => s.card.user_id === me) + 1;
    setTimeout(() => E.dispose(), 50); hudEl.remove();
    results(stage, ctx, { score: score[me].kills, unit: 'eliminations', won: rank === 1, title: rank === 1 ? 'Victory!' : `#${rank} of ${st.length}`, sub: `${score[me].kills} eliminations · ${score[me].deaths} deaths`,
      standings: st.map(s => ({ ...s.card, score: s.kills, label: `${s.kills} / ${s.deaths}` })) });
  }
}
