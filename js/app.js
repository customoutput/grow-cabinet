import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Plant, VARIETIES, loadLeafTextures, leafUniforms, DAY, EPOCH, START_AGE, lerp, smooth, clamp } from './plant.js';
import { buildShelf, buildMotes, SH } from './shelf.js';
import { createPost } from './post.js';
import { buildAquarium } from './aquarium.js';

const $ = (s) => document.querySelector(s);

async function boot() {
  const canvas = $('#c');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); }
  catch (e) { $('#loading').textContent = 'This view needs WebGL, which this browser has turned off.'; return; }
  const mobile = Math.min(innerWidth, innerHeight) < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0b0b);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const shelf = buildShelf(scene);
  const motes = buildMotes(scene);
  const aq = buildAquarium(scene, { lowEnd: mobile });
  const textures = await loadLeafTextures('tex/', renderer);

  const defs = [
    ['dragonScale', -0.305, -0.005, 21, 2, 0.15, 'Dragon Scale Mint · left'],
    ['blackVelvetPink', -0.1, 0.01, 37, -4, 0.05, 'Black Velvet Pink · centre left'],
    ['dragonScale', 0.105, -0.01, 43, 7, -0.05, 'Dragon Scale Mint · centre right'],
    ['blackVelvetPink', 0.31, 0.0, 59, 3, -0.15, 'Black Velvet Pink · right']
  ];
  const trayTop = SH.trayH - 0.003;
  const plants = defs.map(([v, x, z, seed, age, facing, name]) => {
    const p = new Plant(v, { position: new THREE.Vector3(x, trayTop, SH.trayZ + z), seed, ageOffset: age, facing, name });
    scene.add(p.group); return p;
  });

  // ---- camera ----
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 12);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.minDistance = 0.12; controls.maxDistance = 2.8;
  controls.minAzimuthAngle = -0.9; controls.maxAzimuthAngle = 0.9;
  controls.minPolarAngle = 0.5; controls.maxPolarAngle = 1.66;
  controls.screenSpacePanning = true;
  const VIEWS = {
    cabinet: { target: [0, -0.05, 0], fitW: 0.98, fitH: 1.04, dir: [0.0, 0.1, 1] },
    shelf: { target: [0, 0.16, -0.01], fitW: 0.9, fitH: 0.4, dir: [0.0, 0.2, 1] },
    tank: { target: [0, -0.32, 0], fitW: 0.9, fitH: 0.42, dir: [0.0, 0.05, 1], fitWP: 0.6 },
    p0: { plant: 0 }, p1: { plant: 1 }, p2: { plant: 2 }, p3: { plant: 3 }
  };
  function pose(name) {
    const v = VIEWS[name];
    if (v.plant != null) {
      const p = plants[v.plant].group.position;
      const t = new THREE.Vector3(p.x, p.y + 0.1, p.z + 0.01);
      const dir = new THREE.Vector3(-p.x * 0.6, 0.38, 1).normalize();
      return { pos: t.clone().addScaledVector(dir, camera.aspect < 1 ? 0.62 : 0.44), target: t };
    }
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitW = camera.aspect < 1 ? (v.fitWP || Math.min(v.fitW, 0.62)) : v.fitW;
    const d = Math.max(v.fitH / 2 / tan, fitW / 2 / (tan * camera.aspect)) + 0.2;
    const dir = new THREE.Vector3(...v.dir).normalize(), t = new THREE.Vector3(...v.target);
    return { pos: t.clone().addScaledVector(dir, d), target: t };
  }
  let tween = null;
  function goView(name, instant) {
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === name));
    const p = pose(name);
    if (instant) { camera.position.copy(p.pos); controls.target.copy(p.target); controls.update(); return; }
    tween = { t: 0, fp: camera.position.clone(), ft: controls.target.clone(), tp: p.pos, tt: p.target };
  }

  const post = createPost(renderer, scene, camera);
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const s = new THREE.Vector2(); renderer.getDrawingBufferSize(s); post.setSize(s.x, s.y); aq.resizeBubbles(camera, renderer);
  }
  addEventListener('resize', resize); resize();
  goView('cabinet', true);

  // click a leaf to focus on it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const blades = []; plants.forEach((p) => p.leaves.forEach((l) => blades.push(l.blade)));
    const hit = ray.intersectObjects(blades, false)[0];
    if (hit) tween = { t: 0, fp: camera.position.clone(), ft: controls.target.clone(), tp: camera.position.clone().add(hit.point.clone().sub(controls.target).multiplyScalar(0.35)), tt: hit.point.clone() };
  });

  // ---- state + UI ----
  const store = { get(k, d) { try { const v = localStorage.getItem('gs-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('gs-' + k, JSON.stringify(v)); } catch (e) { } } };
  const S = { offset: 0, speed: 1, air: store.get('air', true), cinematic: store.get('cine', true), airLevel: 0, lastGrow: -9 };
  post.setCinematic(S.cinematic);
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { S.speed = +b.dataset.speed; sync(); }));
  $('#today').addEventListener('click', () => { S.offset = 0; S.speed = 1; sync(); });
  $('#air').addEventListener('click', () => { S.air = !S.air; store.set('air', S.air); sync(); });
  $('#cine').addEventListener('click', () => { S.cinematic = !S.cinematic; store.set('cine', S.cinematic); post.setCinematic(S.cinematic); sync(); });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => goView(b.dataset.view)));
  if (innerWidth >= 1200) { $('#log').classList.add('open'); $('#logToggle').setAttribute('aria-expanded', 'true'); }
  $('#logToggle').addEventListener('click', () => { const o = $('#log').classList.toggle('open'); $('#logToggle').setAttribute('aria-expanded', o); });
  function sync() {
    document.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.speed === S.speed));
    $('#air').setAttribute('aria-pressed', S.air); $('#air').textContent = S.air ? 'Airflow on' : 'Airflow off';
    $('#cine').setAttribute('aria-pressed', S.cinematic); $('#cine').textContent = S.cinematic ? 'Cinematic' : 'Clear view';
    $('#today').hidden = Math.abs(S.offset) < 60000 && S.speed === 1;
  }
  sync();
  const rows = plants.map((p, i) => {
    const li = document.createElement('li'); li.tabIndex = 0;
    li.innerHTML = `<div class="row-top"><span class="pname"></span><span class="pill"></span></div><div class="bar"><i></i></div><div class="meta"><span class="leaf"></span><span class="next"></span></div>`;
    li.addEventListener('click', () => goView('p' + i)); li.addEventListener('keydown', (e) => { if (e.key === 'Enter') goView('p' + i); });
    $('#plants').appendChild(li);
    return { p, name: li.querySelector('.pname'), pill: li.querySelector('.pill'), bar: li.querySelector('.bar i'), leaf: li.querySelector('.leaf'), next: li.querySelector('.next') };
  });
  const fd = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), ft = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  function ui(simMs) {
    const d = new Date(simMs);
    $('#simDate').textContent = fd.format(d); $('#simTime').textContent = ft.format(d);
    $('#simDay').textContent = 'Day ' + (Math.floor((simMs - EPOCH) / DAY) + 1);
    for (const r of rows) {
      const s = r.p.status();
      r.name.textContent = r.p.v.short; r.pill.textContent = s.stage; r.pill.dataset.stage = s.stage.split(' ')[0].toLowerCase();
      r.bar.style.width = Math.round(s.pct * 100) + '%';
      r.leaf.textContent = `Leaf ${s.leafNo} · ${s.leaves} on plant`;
      r.next.textContent = s.next < 1 ? 'Next leaf within a day' : `Next leaf in ~${Math.round(s.next)} d`;
    }
  }

  // ---- loop ----
  const clock = new THREE.Clock();
  let t = 0, uiT = 0, lcdT = 0, first = true;
  function step(dt, draw) {
    t += dt; leafUniforms.uTime.value = t;
    S.offset += dt * 1000 * (S.speed - 1);
    const simMs = Date.now() + S.offset, age = START_AGE + (simMs - EPOCH) / DAY;
    for (const L of shelf.lights) L.light.intensity = L.base;
    S.airLevel = lerp(S.airLevel, S.air ? 1 : 0, Math.min(1, dt * 0.6));
    if (t - S.lastGrow > (S.speed > 1 ? 0.05 : 2) || first) { plants.forEach((p) => p.update(age, textures)); S.lastGrow = t; }
    plants.forEach((p, i) => p.animate(t, 0.12 + 0.55 * S.airLevel * (0.7 + 0.3 * Math.sin(t * 0.13 + i))));
    motes.update(dt, t);
    aq.update(dt, t, 1);
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 1.2); const e = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.fp, tween.tp, e); controls.target.lerpVectors(tween.ft, tween.tt, e);
      if (tween.t >= 1) tween = null;
    }
    controls.update();
    post.setFocus(camera.position.distanceTo(controls.target));
    uiT -= dt; lcdT -= dt;
    if (uiT <= 0 || first) { ui(simMs); uiT = 0.25; }
    if (lcdT <= 0) { shelf.updateLCD(24.2 + Math.sin(simMs / 3.6e6) * 0.4, 84 + Math.sin(simMs / 2.7e6) * 3); lcdT = 5; }
    if (draw) post.render(t);
    if (first) { first = false; $('#loading').hidden = true; document.body.classList.add('ready'); }
  }
  function frame() { if (window.__paused) return; requestAnimationFrame(frame); step(Math.min(clock.getDelta(), 0.1), true); }
  frame();
  window.__app = { scene, camera, controls, plants, post, S, goView, renderer, step: (n, dt) => { for (let i = 0; i < n; i++) step(dt || 1 / 30, i === n - 1); } };
}
boot().catch((e) => { console.error(e); const l = document.querySelector('#loading'); if (l) l.textContent = 'Something went wrong loading the shelf. Refresh to try again.'; });
