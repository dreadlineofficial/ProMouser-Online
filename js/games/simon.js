/* Pattern Recall (3D): a 3x3 arcade console. Watch the pads light up and play their notes,
   then click them back in order. The pattern grows by one every level. */
import { onPress, results, sleep, hud, pill } from './common.js';
import { studio, THREE } from './stage3d.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const COLORS = ['#d7ff3c', '#ff5b2e', '#5cb8ff', '#f472b6', '#f5c542', '#a78bfa', '#34d399', '#fb7185', '#22d3ee'];
export function buildSet(st) {
  const con = new THREE.Group(); st.scene.add(con); con.rotation.x = .38; con.position.set(0, 1.4, 0);
  const body = new THREE.Mesh(new RoundedBoxGeometry(8.4, .8, 8.4, 4, .25), new THREE.MeshStandardMaterial({ color: '#1a1d22', metalness: .5, roughness: .45 })); body.castShadow = body.receiveShadow = true; con.add(body);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(7.6, .2, 7.6, 3, .12), new THREE.MeshStandardMaterial({ color: '#0c0d10', roughness: .8 })); bezel.position.y = .45; con.add(bezel);
  const pads = COLORS.map((c, i) => {
    const col = new THREE.Color(c), mat = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(.35), emissive: col, emissiveIntensity: .06, roughness: .3, metalness: .1 });
    const pad = new THREE.Mesh(new RoundedBoxGeometry(2.05, .5, 2.05, 4, .16), mat); pad.position.set((i % 3 - 1) * 2.35, .7, (Math.floor(i / 3) - 1) * 2.35); pad.castShadow = true; con.add(pad);
    const light = new THREE.PointLight(col, 0, 6, 2); light.position.set(pad.position.x, 2, pad.position.z); con.add(light);
    pad.userData = { i, mat, light, col, glow: 0 }; return pad;
  });
  return { con, pads };
}

export async function start(stage, ctx) {
  const st = studio(stage, { fov: 40 }), S = buildSet(st);
  st.setCam([0, 8.6, 11.5], [0, 1.2, .2]);
  let ac = null; const beep = i => { try { ac = ac || new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 262 * Math.pow(2, [0, 2, 4, 5, 7, 9, 11, 12, 14][i] / 12); o.type = 'triangle'; g.gain.setValueAtTime(.12, ac.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .32); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + .35); } catch (e) { /* no audio */ } };
  st.onFrame(dt => S.pads.forEach(p => { const u = p.userData; u.glow = Math.max(0, u.glow - dt * 3); u.mat.emissiveIntensity = .06 + u.glow * 1.8; u.light.intensity = u.glow * 9; p.position.y = .7 - Math.min(u.glow, .5) * .25; }));
  st.start();
  const flash = async (i, ms = 380) => { S.pads[i].userData.glow = 1; beep(i); await sleep(ms); };
  const seq = []; let level = 0, input = 0, accepting = false, over = null;
  const msg = document.createElement('div'); msg.className = 'hud-msg'; stage.appendChild(msg);
  const status = (m, s = '') => { msg.innerHTML = m + (s ? `<small>${s}</small>` : ''); hud(stage, `<div class="hud-row">${pill('Level', level, '', 'big')}${pill('Best', (ctx.me.stats.simon || {}).best ?? '—')}</div>`); };
  onPress(stage, (t, b, e) => {
    if (!accepting || b !== 0) return;
    const hit = st.pick(e, S.pads); if (!hit) return;
    const i = hit.object.userData.i; S.pads[i].userData.glow = .8; beep(i);
    if (i !== seq[input]) { accepting = false; st.shake(.2); st.burst(hit.point, '#ff5b2e', 30, 4); over && over(); return; }
    st.burst(hit.point, COLORS[i], 10, 2.5);
    input++; if (input === seq.length) { accepting = false; next(); }
  });
  const next = async () => {
    level = seq.length; seq.push(Math.floor(Math.random() * 9)); input = 0; status('Watch', `Level ${level + 1}`); await sleep(700);
    const speed = Math.max(180, 440 - seq.length * 14);
    for (const i of seq) { await flash(i, speed); await sleep(120); }
    status('Your turn', `Repeat ${seq.length} pad${seq.length > 1 ? 's' : ''}`); accepting = true;
  };
  status('Get ready'); await sleep(900);
  await new Promise(res => { over = res; next(); });
  status('Pattern broken'); await sleep(600);
  results(stage, ctx, { score: level, unit: 'levels', won: false, title: level >= 10 ? 'Big brain' : 'Pattern broken', sub: `You repeated a ${level}-step pattern.` });
}
