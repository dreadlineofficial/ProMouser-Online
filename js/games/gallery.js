/* Shooting Gallery: 60 s in a 3D range. Targets pop up at 10–45 m; far, small and moving ones score
   most, and a bullseye doubles it. Mouse to aim (click to lock), left click to fire. */
import { THREE, engine, look, gun, fx, crosshair, sfx, textSprite } from './fps.js';
import { results, countdown, hud, pill } from './common.js';

export async function start(stage, ctx) {
  const DUR = 60000, E = engine(stage, { fov: 70, bloom: .8 }), { scene, cam } = E, L = look(E.canvas, cam, { sens: .0019 }), G = gun(cam, { color: '#f59e0b', kind: 'pistol' }), F = fx(scene), X = crosshair(stage);
  scene.background = new THREE.Color('#07040e'); scene.fog = new THREE.Fog('#07040e', 30, 75);
  scene.add(new THREE.HemisphereLight('#a5b4fc', '#1a0f05', .5));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.2); sun.position.set(6, 14, 8); sun.castShadow = true; Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 30, bottom: -30, far: 70 }); sun.shadow.mapSize.set(2048, 2048); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 120), new THREE.MeshStandardMaterial({ color: '#141019', roughness: .5, metalness: .4 })); floor.rotation.x = -Math.PI / 2; floor.position.z = -40; floor.receiveShadow = true; scene.add(floor);
  // lanes, distance markers and a back wall
  [10, 20, 30, 45].forEach((d, i) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(24, .02, .08), new THREE.MeshBasicMaterial({ color: new THREE.Color(['#22d3ee', '#a855f7', '#f472b6', '#f59e0b'][i]).multiplyScalar(2), toneMapped: false })); line.position.set(0, .02, -d); scene.add(line);
    const s = textSprite(d + ' m', { size: 60, glow: ['#22d3ee', '#a855f7', '#f472b6', '#f59e0b'][i] }); s.position.set(-11, 1.2, -d); s.scale.set(2, .5, 1); scene.add(s);
  });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 1), new THREE.MeshStandardMaterial({ color: '#1a1325', roughness: .7 })); wall.position.set(0, 5, -60); wall.receiveShadow = true; scene.add(wall);
  [-12, 12].forEach(x => { const w = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 70), new THREE.MeshStandardMaterial({ color: '#120d1b', roughness: .7 })); w.position.set(x, 3, -28); scene.add(w);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, 70), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f59e0b').multiplyScalar(2.4), toneMapped: false })); strip.position.set(x * .96, 5.8, -28); scene.add(strip); });
  [-20, -40].forEach(z => { const l = new THREE.PointLight('#f59e0b', 25, 26, 1.6); l.position.set(0, 6, z); scene.add(l); });
  const title = textSprite('PROMOUSER RANGE', { size: 70, glow: '#f59e0b', w: 1024, h: 160 }); title.position.set(0, 7.6, -59); title.scale.set(14, 2.2, 1); scene.add(title);
  cam.position.set(0, 1.6, 2);

  // targets: a disc with rings on a post that flips up
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); ['#ffffff', '#ef4444', '#ffffff', '#ef4444', '#facc15'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(128, 128, 126 - i * 25, 0, 7); x.fill(); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const targets = [];
  function spawn(now) {
    const dist = [10, 20, 30, 45][Math.floor(Math.random() * 4)], size = [.75, .6, .5, .42][[10, 20, 30, 45].indexOf(dist)] * (.85 + Math.random() * .3), moving = Math.random() < .35;
    const g = new THREE.Group(), disc = new THREE.Mesh(new THREE.CircleGeometry(size, 40), new THREE.MeshStandardMaterial({ map: ringTex, emissive: '#ffffff', emissiveMap: ringTex, emissiveIntensity: .35, roughness: .5, side: THREE.DoubleSide }));
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
    const end = h ? h.point : ray.ray.at(70, new THREE.Vector3()); F.tracer(G.muzzle.getWorldPosition(new THREE.Vector3()), end, '#fde68a');
    if (h) {
      const t = h.object.userData.t, local = t.disc.worldToLocal(h.point.clone()), bull = local.length() < t.size * .22;
      const pts = Math.round((t.dist * 6 + (t.moving ? 60 : 0)) * (bull ? 2 : 1) * (1 + Math.min(streak, 8) * .1));
      score += pts; hits++; streak++; t.dead = true; X.hit(bull); sfx(bull ? 'kill' : 'hit'); F.sparks(h.point, bull ? '#facc15' : '#ffffff', 16);
      const pop = textSprite('+' + pts + (bull ? ' BULLSEYE' : ''), { size: 56, glow: bull ? '#facc15' : '#22d3ee' }); pop.position.copy(h.point).add(new THREE.Vector3(0, .6, 0)); pop.scale.set(2.4, .6, 1); scene.add(pop);
      const t0 = now; const rise = () => { const k = (performance.now() - t0) / 700; pop.position.y += .01; pop.material.opacity = 1 - k; if (k < 1) requestAnimationFrame(rise); else scene.remove(pop); }; rise();
    } else streak = 0;
  });
  addEventListener('mouseup', () => {});
  const intro = document.createElement('div'); intro.className = 'gover';
  intro.innerHTML = `<div class="gover-card"><h2 class="grad-text" style="font-size:3rem">Shooting Gallery</h2><p class="muted">60 seconds. Far, small and moving targets score more. Bullseyes double it.</p><button class="btn primary lg" type="button" id="go">Click to play</button><p class="small muted">Arrow keys also aim.</p></div>`;
  stage.appendChild(intro);
  await new Promise(res => intro.querySelector('#go').addEventListener('click', () => { L.lock(); res(); }));
  intro.remove();
  await countdown(stage);
  running = true;
  const t0 = performance.now(); let last = t0, nextSpawn = t0;
  stage.__gallery = { get score() { return score; }, targets };
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
      hud(stage, `${pill('Score', score)}${pill('Streak', streak)}${pill('Accuracy', shots ? Math.round(hits / shots * 100) + '%' : '—')}${pill('Time', Math.max(0, (DUR - (now - t0)) / 1000).toFixed(1))}`);
      E.render();
      if (now - t0 >= DUR) res(); else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  running = false; L.dispose(); setTimeout(() => E.dispose(), 50);
  results(stage, ctx, { score, unit: 'pts', won: false, title: 'Range closed', sub: `${hits} hits · ${shots ? Math.round(hits / shots * 100) : 0}% accuracy` });
}
