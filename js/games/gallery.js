/* Shooting Gallery: 60 s in a 3D range. Targets pop up at 10–45 m; far, small and moving ones score
   most, and a bullseye doubles it. Mouse to aim (click to lock), left click to fire. */
import { THREE, engine, look, gun, fx, crosshair, sfx, textSprite, daySky, daylight, concreteTex, block, wallText } from './fps.js';
import { results, countdown, hud, pill } from './common.js';

export async function start(stage, ctx) {
  const DUR = 60000, E = engine(stage, { fov: 70, bloom: .15 }), { scene, cam } = E, L = look(E.canvas, cam, { sens: .0019 }), G = gun(cam, { kind: 'pistol' }), F = fx(scene), X = crosshair(stage);
  daySky(scene, { fog: [50, 120] }); daylight(scene, { extent: 40, at: [10, 30, 6] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 120), new THREE.MeshStandardMaterial({ map: concreteTex(6), roughness: .93 })); floor.rotation.x = -Math.PI / 2; floor.position.z = -40; floor.receiveShadow = true; scene.add(floor);
  // firing bench, lanes, distance boards and a sand berm
  const bench = block(10, .9, .7, '#5a5f66'); bench.position.set(0, .45, 1.1); scene.add(bench);
  [10, 20, 30, 45].forEach(d => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(22, .1), new THREE.MeshStandardMaterial({ color: '#f3f0e8', roughness: .8 })); line.rotation.x = -Math.PI / 2; line.position.set(0, .012, -d); scene.add(line);
    [-11, 11].forEach(x => { const post = block(.25, 1.6, .25, '#454a52', { cap: false }); post.position.set(x, .8, -d); scene.add(post);
      const t = wallText(d + ' M', { width: 1.6, color: '#1d1f23' }); const plate = block(1.7, .5, .06, '#d7ff3c', { cap: false }); plate.position.set(x, 1.85, -d); scene.add(plate); t.position.set(x, 1.85, -d + .04); scene.add(t); });
  });
  const berm = block(40, 6, 4, '#a8946f', { rough: 1, cap: false }); berm.position.set(0, 3, -60); scene.add(berm);
  [-12, 12].forEach(x => { const w = block(1, 4, 70, '#b8b2a6'); w.position.set(x, 2, -28); scene.add(w); });
  const title = wallText('PROMOUSER RANGE', { width: 14 }); title.position.set(0, 4.6, -57.95); scene.add(title);
  cam.position.set(0, 1.6, 2);

  // targets: a disc with rings on a post that flips up
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); ['#f4f1ea', '#ff5b2e', '#f4f1ea', '#ff5b2e', '#1d1f23'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(128, 128, 126 - i * 25, 0, 7); x.fill(); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const targets = [];
  function spawn(now) {
    const dist = [10, 20, 30, 45][Math.floor(Math.random() * 4)], size = [.75, .6, .5, .42][[10, 20, 30, 45].indexOf(dist)] * (.85 + Math.random() * .3), moving = Math.random() < .35;
    const g = new THREE.Group(), disc = new THREE.Mesh(new THREE.CircleGeometry(size, 40), new THREE.MeshStandardMaterial({ map: ringTex, roughness: .6, side: THREE.DoubleSide }));
    disc.position.y = 1.5; disc.castShadow = true; g.add(disc);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.5, 8), new THREE.MeshStandardMaterial({ color: '#555', metalness: .8, roughness: .3 })); post.position.y = .75; g.add(post);
    g.position.set((Math.random() - .5) * 18, 0, -dist); g.rotation.x = -Math.PI / 2; scene.add(g);
    const t = { g, disc, dist, size, moving, phase: Math.random() * 6, born: now, life: 1700 + Math.random() * 1300 + dist * 25, up: 0, dead: false };
    disc.userData.t = t; targets.push(t);
  }
  let score = 0, hits = 0, shots = 0, streak = 0, nextShot = 0, running = false;
  const ray = new THREE.Raycaster();
  E.canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return; if (!L.locked) L.lock();
    const now = performance.now(); if (!running || now < nextShot) return; nextShot = now + 230; shots++; G.fire(); sfx('pistol');
    ray.setFromCamera(new THREE.Vector2(0, 0), cam); const h = ray.intersectObjects(targets.filter(t => !t.dead).map(t => t.disc), false)[0];
    const end = h ? h.point : ray.ray.at(70, new THREE.Vector3()); F.tracer(G.muzzle.getWorldPosition(new THREE.Vector3()), end);
    if (h) {
      const t = h.object.userData.t, local = t.disc.worldToLocal(h.point.clone()), bull = local.length() < t.size * .22;
      const pts = Math.round((t.dist * 6 + (t.moving ? 60 : 0)) * (bull ? 2 : 1) * (1 + Math.min(streak, 8) * .1));
      score += pts; hits++; streak++; t.dead = true; X.hit(bull); sfx(bull ? 'kill' : 'hit'); F.sparks(h.point, bull ? '#d7ff3c' : '#ffe2a8', 16);
      const pop = textSprite('+' + pts + (bull ? ' BULLSEYE' : ''), { size: 56, color: bull ? '#d7ff3c' : '#ffffff' }); pop.position.copy(h.point).add(new THREE.Vector3(0, .6, 0)); pop.scale.set(2.4, .6, 1); scene.add(pop);
      const t0 = now; const rise = () => { const k = (performance.now() - t0) / 700; pop.position.y += .01; pop.material.opacity = 1 - k; if (k < 1) requestAnimationFrame(rise); else scene.remove(pop); }; rise();
    } else streak = 0;
  });
  addEventListener('mouseup', () => {});
  const intro = document.createElement('div'); intro.className = 'gintro';
  intro.innerHTML = `<div class="gintro-card"><span class="kicker">3D · solo range</span><h2>Shooting Gallery</h2><p class="muted">60 seconds. Far, small and moving targets score more. Bullseyes double it.</p>
    <div class="keys"><span><kbd>Mouse</kbd>aim</span><span><kbd>LMB</kbd>fire</span><span><kbd>Arrows</kbd>also aim</span></div><div><button class="btn primary lg" type="button" id="go">Click to play</button></div></div>`;
  stage.appendChild(intro);
  G.group.visible = false; const xh = stage.querySelector('.xhair'); if (xh) xh.style.visibility = 'hidden'; let preview = true; const pv = () => { if (!preview) return; requestAnimationFrame(pv); E.render(); }; pv();
  await new Promise(res => intro.querySelector('#go').addEventListener('click', () => { L.lock(); res(); }));
  preview = false; G.group.visible = true; if (xh) xh.style.visibility = ''; intro.remove();
  await countdown(stage);
  running = true;
  const t0 = performance.now(); let last = t0, nextSpawn = t0;
  stage.__gallery = { get score() { return score; }, targets, L };
  await new Promise(res => {
    const frame = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now; L.apply(dt); G.update(dt, false, false);
      if (now > nextSpawn && targets.filter(t => !t.dead).length < 4) { spawn(now); nextSpawn = now + 450 + Math.random() * 500; }
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i], age = now - t.born, up = t.dead || age > t.life ? Math.max(0, t.up - dt * 6) : Math.min(1, t.up + dt * 7);
        if (!t.dead && age > t.life && t.up >= 1) { t.dead = true; streak = 0; }
        t.up = up; t.g.rotation.x = -Math.PI / 2 * (1 - up); if (t.moving && !t.dead) t.g.position.x = Math.sin(now / 600 + t.phase) * 7;
        if ((t.dead || age > t.life) && up <= 0) { scene.remove(t.g); targets.splice(i, 1); }
      }
      F.update(dt);
      hud(stage, `<div class="hud-row">${pill('Score', score, '', 'big')}${pill('Streak', 'x' + streak)}${pill('Accuracy', shots ? Math.round(hits / shots * 100) + '%' : '—')}</div>${pill('Time', Math.max(0, (DUR - (now - t0)) / 1000).toFixed(1), '', 'hot')}`);
      E.render();
      if (now - t0 >= DUR) res(); else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  running = false; L.dispose(); setTimeout(() => E.dispose(), 50);
  results(stage, ctx, { score, unit: 'pts', won: false, title: 'Range closed', sub: `${hits} hits · ${shots ? Math.round(hits / shots * 100) : 0}% accuracy` });
}
