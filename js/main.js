/* Renderer, environment, camera, time model, UI wiring, main loop */
(function (PC) {
  'use strict';
  const $ = (s) => document.querySelector(s);

  function boot() {
    const canvas = $('#c');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      $('#loading').textContent = 'This view needs WebGL, which this browser has turned off.';
      return;
    }
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0d0d);

    // ---- environment for reflections (a soft room with a window) ----
    {
      const env = new THREE.Scene();
      const room = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 10), new THREE.MeshBasicMaterial({ color: 0x1c1d1e, side: THREE.BackSide }));
      room.position.y = 2; env.add(room);
      const panel = (w, h, c, x, y, z, ry, rx) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); env.add(m); };
      panel(3, 2.2, 0xb9c8d6, -4.9, 2.2, 1.5, Math.PI / 2);
      panel(4, 1, 0x7a746c, 0, 4.4, 2, 0, Math.PI / 2);
      panel(1, 1.2, 0xffc890, 3.5, 1.6, 3.5, -Math.PI / 4);
      panel(2.5, 0.6, 0x5a5550, 0, 1.5, 4.9, Math.PI);
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(env, 0.04).texture;
      pm.dispose();
    }

    // ---- lights in the room ----
    const hemi = new THREE.HemisphereLight(0xc8d2d6, 0x2a2018, 0.22); scene.add(hemi);
    const lamp = new THREE.PointLight(0xffcf9e, 0.55, 7, 1.6); lamp.position.set(-1.7, 1.9, 1.8); scene.add(lamp);

    const room = PC.buildRoom(scene);
    const cab = PC.buildCabinet(scene);
    const aq = PC.buildAquarium(scene, cab);
    const plants = PC.buildPlants(scene);
    const floor = PC.buildFloorPlants(scene);
    plants.push(...floor.plants);
    const mist = PC.buildMist(scene, cab, renderer);

    const store = {
      get(k, d) { try { const v = localStorage.getItem('gc-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem('gc-' + k, JSON.stringify(v)); } catch (e) { } }
    };
    // ---- camera ----
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 30);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 0.18; controls.maxDistance = 6;
    controls.minAzimuthAngle = -1.15; controls.maxAzimuthAngle = 1.15;
    controls.maxPolarAngle = 1.72; controls.minPolarAngle = 0.35;
    controls.screenSpacePanning = true;

    const VIEWS = {
      cabinet: { target: [0.04, 1.0, 0], fitW: 3.5, fitWP: 1.5, fitH: 2.5, dir: [0.14, 0.03, 1] },
      floorL: { target: [-1.2, 0.95, 0.05], fitW: 1.3, fitH: 1.75, dir: [0.3, 0.12, 1] },
      floorR: { target: [1.28, 0.95, 0.05], fitW: 1.3, fitH: 1.75, dir: [-0.3, 0.12, 1] },
      aquarium: { target: [0, 0.28, 0], fitW: 0.98, fitH: 0.46, dir: [0.08, 0.06, 1] },
      shelf1: { target: [0, 0.83, 0], fitW: 1.02, fitH: 0.48, dir: [0.1, 0.1, 1] },
      shelf2: { target: [0, 1.29, 0], fitW: 1.02, fitH: 0.48, dir: [0.1, 0.06, 1] },
      shelf3: { target: [0, 1.74, 0], fitW: 1.02, fitH: 0.48, dir: [0.1, -0.06, 1] }
    };
    function viewPose(name) {
      const v = VIEWS[name], tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const fitW = v.fitWP && camera.aspect < 1 ? v.fitWP : v.fitW;
      const d = Math.max(v.fitH / 2 / tan, fitW / 2 / (tan * camera.aspect)) + 0.26;
      const dir = new THREE.Vector3(...v.dir).normalize();
      const t = new THREE.Vector3(...v.target);
      return { pos: t.clone().addScaledVector(dir, d), target: t };
    }
    let camTween = null, currentView = 'cabinet';
    const S = {
      offset: 0, speed: 1, lights: store.get('lights', 'on'), fans: store.get('fans', true), mist: store.get('mist', true), doors: false, doorsManual: false,
      level: 1, tankLevel: 1, night: 0, tankNight: 0, fanSpin: 0, lastGrow: 0, rh: 70
    };
    function goView(name, instant) {
      currentView = name;
      if (!S.doorsManual) { S.doors = name.startsWith('shelf') || name === 'aquarium'; syncUI(); }
      const p = viewPose(name);
      document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === name));
      if (instant) { camera.position.copy(p.pos); controls.target.copy(p.target); controls.update(); return; }
      camTween = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: p.pos, toT: p.target };
    }

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); mist.resize(camera); aq.resizeBubbles(camera, renderer);
    }
    window.addEventListener('resize', () => { resize(); });
    resize();

    // ---- state ----

    // ---- UI ----
    const speedBtns = document.querySelectorAll('[data-speed]');
    speedBtns.forEach((b) => b.addEventListener('click', () => { S.speed = +b.dataset.speed; syncUI(); }));
    $('#today').addEventListener('click', () => { S.offset = 0; S.speed = 1; syncUI(); });
    document.querySelectorAll('[data-lights]').forEach((b) => b.addEventListener('click', () => { S.lights = b.dataset.lights; store.set('lights', S.lights); syncUI(); }));
    $('#fans').addEventListener('click', () => { S.fans = !S.fans; store.set('fans', S.fans); syncUI(); });
    $('#mist').addEventListener('click', () => { S.mist = !S.mist; store.set('mist', S.mist); syncUI(); });
    $('#doors').addEventListener('click', () => { S.doors = !S.doors; S.doorsManual = true; syncUI(); });
    document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => goView(b.dataset.view)));
    if (window.innerWidth >= 1280) { $('#log').classList.add('open'); $('#logToggle').setAttribute('aria-expanded', 'true'); }
    $('#logToggle').addEventListener('click', () => { const p = $('#log'); const open = p.classList.toggle('open'); $('#logToggle').setAttribute('aria-expanded', open); });
    function syncUI() {
      speedBtns.forEach((b) => b.setAttribute('aria-pressed', +b.dataset.speed === S.speed));
      document.querySelectorAll('[data-lights]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lights === S.lights));
      $('#fans').setAttribute('aria-pressed', S.fans); $('#fans').textContent = S.fans ? 'Fans on' : 'Fans off';
      $('#mist').setAttribute('aria-pressed', S.mist); $('#mist').textContent = S.mist ? 'Mist on' : 'Mist off';
      $('#doors').setAttribute('aria-pressed', S.doors); $('#doors').textContent = S.doors ? 'Close doors' : 'Open doors';
      $('#today').hidden = Math.abs(S.offset) < 60000 && S.speed === 1;
    }
    syncUI();
    goView('cabinet', true);

    // growth log rows
    const list = $('#plants');
    const rows = plants.map((p) => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="row-top"><span class="pname"></span><span class="pill"></span></div>
        <div class="bar"><i></i></div>
        <div class="meta"><span class="leaf"></span><span class="next"></span></div>`;
      li.tabIndex = 0;
      const target = p.view || ['shelf1', 'shelf2', 'shelf3'][p.shelf];
      li.addEventListener('click', () => goView(target));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') goView(target); });
      list.appendChild(li);
      return { p, li, name: li.querySelector('.pname'), pill: li.querySelector('.pill'), bar: li.querySelector('.bar i'), leaf: li.querySelector('.leaf'), next: li.querySelector('.next') };
    });
    const fmtDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    function updateUI(simMs, ageDays) {
      const d = new Date(simMs);
      $('#simDate').textContent = fmtDate.format(d);
      $('#simTime').textContent = fmtTime.format(d);
      $('#simDay').textContent = 'Day ' + (Math.floor((simMs - PC.EPOCH) / PC.DAY) + 1);
      $('#shrimpCount').textContent = aq.shrimp.count() + ' cherry shrimp';
      $('#rh').textContent = Math.round(S.rh) + '% RH';
      for (const r of rows) {
        const s = r.p.status();
        r.name.textContent = s.name;
        r.pill.textContent = s.stage; r.pill.dataset.stage = s.stage.split(' ')[0].toLowerCase();
        r.bar.style.width = Math.round(s.pct * 100) + '%';
        r.leaf.textContent = `Leaf ${s.leafNo} · ${s.leaves} on plant`;
        r.next.textContent = s.next < 1 ? 'Next leaf within a day' : `Next leaf in ~${Math.round(s.next)} d`;
      }
      $('#lightState').textContent = S.level > 0.5 ? 'Grow lights on' : S.night > 0.5 ? 'UV night lights' : S.level > 0.02 ? 'Dimming' : 'Lights off';
    }

    // ---- photoperiod ----
    function photoLevel(simMs, onH, offH) {
      const d = new Date(simMs), h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      return PC.smooth(onH, onH + 0.5, h) * (1 - PC.smooth(offH - 0.5, offH, h));
    }

    const UV = new THREE.Color(0.55, 0.32, 1.0), MOON = new THREE.Color(0.25, 0.42, 1.0);
    PC.shared.tint = new THREE.Color(1, 1, 1);
    // ---- loop ----
    const clock = new THREE.Clock();
    let t = 0, uiTimer = 0, lcdTimer = 0, firstFrame = true;
    function frame() {
      if (PC.paused) return;
      requestAnimationFrame(frame);
      step(Math.min(clock.getDelta(), 0.1), true);
    }
    function step(dt, draw) {
      t += dt;
      PC.shared.time.value = t;

      S.offset += dt * 1000 * (S.speed - 1);
      const simMs = Date.now() + S.offset;
      const ageDays = PC.START_AGE + (simMs - PC.EPOCH) / PC.DAY;

      // lights: warm grow light by day, violet-blue UV night light after dark
      let day = 1, tankDay = 1, nite = 0, tankNite = 0;
      if (S.lights === 'off') { day = tankDay = 0; }
      else if (S.lights === 'night') { day = tankDay = 0; nite = tankNite = 1; }
      else if (S.lights === 'auto') { day = photoLevel(simMs, 8, 20); tankDay = photoLevel(simMs, 10, 21); nite = 1 - day; tankNite = 1 - tankDay; }
      const k = S.speed > 1000 ? 1 : Math.min(1, dt * 1.5);
      S.level = PC.lerp(S.level, day, k); S.tankLevel = PC.lerp(S.tankLevel, tankDay, k);
      S.night = PC.lerp(S.night, nite, k); S.tankNight = PC.lerp(S.tankNight, tankNite, k);
      const lv = S.level, nv = S.night, tl = S.tankLevel, tn = S.tankNight;
      for (const L of cab.lights) {
        if (!L.warm) L.warm = L.light.color.clone();
        const a = L.tank ? tl : lv, n = L.tank ? tn : nv, uv = L.tank ? MOON : UV;
        const f = L.tank ? 0.3 : 0.4;
        L.light.color.setRGB(L.warm.r * a + uv.r * n * f, L.warm.g * a + uv.g * n * f, L.warm.b * a + uv.b * n * f);
        L.light.intensity = L.base;
      }
      for (const m of cab.ledMats) {
        const a = m.tank ? tl : lv, n = m.tank ? tn : nv;
        m.mat.color.setRGB(0.08 + a * 0.92 + n * 0.5, 0.08 + a * 0.87 + n * 0.3, 0.08 + a * 0.8 + n * 1.0);
      }
      for (const g of cab.glows) {
        const a = g.tank ? tl : lv, n = g.tank ? tn : nv;
        if (!g.warm) g.warm = g.mat.color.clone();
        g.mat.color.setRGB(g.warm.r * a + 0.5 * n, g.warm.g * a + 0.3 * n, g.warm.b * a + n);
        g.mat.opacity = g.base * Math.min(1, a + n * 0.85);
      }
      for (let i = 0; i < floor.lights.length; i++) {
        const L = floor.lights[i];
        L.light.color.setRGB(L.warm.r * lv + UV.r * nv * 0.55, L.warm.g * lv + UV.g * nv * 0.55, L.warm.b * lv + UV.b * nv * 0.55);
        L.light.intensity = L.base;
        floor.beams[i].uniforms.uColor.value.copy(L.light.color); floor.beams[i].uniforms.uI.value = 1;
        floor.lenses[i].color.setRGB(0.1 + lv * 0.9 + nv * 0.5, 0.1 + lv * 0.85 + nv * 0.3, 0.1 + lv * 0.75 + nv);
      }
      const nightShare = nv / (lv + nv + 1e-3);
      PC.shared.tint.setRGB(1 - 0.5 * nightShare, 1 - 0.58 * nightShare, 1);
      PC.shared.plantLight.value = lv + nv * 0.35;
      PC.shared.caustic.value = 0.05 + tl * 0.65 + tn * 0.08;
      const roomK = 1 - 0.7 * nv * (1 - lv);
      lamp.intensity = 0.55 * roomK; hemi.intensity = 0.22 * roomK;
      for (const sm of room.spillMats) { if (!sm.warm) { sm.warm = sm.color.clone(); sm.base = sm.opacity; } sm.color.setRGB(sm.warm.r * lv + 0.45 * nv, sm.warm.g * lv + 0.3 * nv, sm.warm.b * lv + nv); sm.opacity = sm.base * Math.min(1, Math.max(lv, tl) + nv * 0.8); }
      const bl = 0.1 + tl * 0.75;
      aq.backdropMat.color.setRGB(bl * 0.95 * (1 - tn) + tn * 0.07, bl * (1 - tn) + tn * 0.12, bl * (1 - tn) + tn * 0.42);
      aq.edgeMat.opacity = 0.15 + 0.45 * Math.max(tl, tn);
      aq.edgeMat.color.setRGB(0.5 * (1 - tn) + 0.45 * tn, 0.85 * (1 - tn) + 0.4 * tn, 0.77 * (1 - tn) + tn);

      // fans and wind
      const spinTarget = S.fans ? 1 : 0;
      S.fanSpin = PC.lerp(S.fanSpin, spinTarget, Math.min(1, dt * (S.fans ? 0.8 : 0.35)));
      for (const f of cab.fans) f.rotor.rotation.z -= dt * S.fanSpin * 38;
      cab.bladeMat.opacity = 1 - S.fanSpin * 0.75; cab.blurMat.opacity = S.fanSpin * 0.55;
      const winds = [0, 1, 2].map((s) => S.fanSpin * (0.55 + 0.45 * PC.noise3(t * 0.15, s * 7.3, 1.1)));

      // growth
      const growEvery = S.speed > 1 ? 0.04 : 2;
      if (t - S.lastGrow > growEvery || firstFrame) { for (const p of plants) p.update(ageDays); S.lastGrow = t; }
      for (let i = 0; i < plants.length; i++) {
        const p = plants[i];
        if (p.outside) { p.animate(t, 0.2 * (0.6 + 0.4 * PC.noise3(t * 0.1, i * 3.3, 4.4))); continue; }
        const fanFall = 0.45 + 0.55 * Math.exp(-(p.group.position.x + 0.47) / 0.7);
        p.animate(t, winds[p.shelf] * fanFall);
      }

      // aquarium life
      aq.fish.update(dt, t);
      aq.shrimp.update(dt, t, (simMs - PC.EPOCH) / PC.DAY);
      mist.update(dt, t, S.mist, winds, Math.max(S.level, S.night * 0.75));
      aq.updateFineBubbles(dt, t, S.tankLevel);
      cab.updateHumidifier(t, S.mist, S.rh);
      S.rh = 68 + mist.state.level * 26 + PC.noise3(simMs / 3.6e6, 0.2, 0.9) * 3 - S.fanSpin * 2;
      aq.updateBubbles(dt * (S.tankLevel > 0.3 ? 1 : 0.15), t);
      aq.updateTrickle(dt, t, true);
      aq.waterNormal.offset.x += dt * 0.012; aq.waterNormal.offset.y += dt * 0.007;

      // doors
      for (const d of cab.doors) {
        d.open = PC.lerp(d.open, S.doors ? 1 : 0, Math.min(1, dt * 2.5));
        d.pivot.rotation.y = d.side * d.open * 1.75;
      }

      // camera tween
      if (camTween) {
        camTween.t = Math.min(1, camTween.t + dt / 1.1);
        const e = 1 - Math.pow(1 - camTween.t, 3);
        camera.position.lerpVectors(camTween.fromP, camTween.toP, e);
        controls.target.lerpVectors(camTween.fromT, camTween.toT, e);
        if (camTween.t >= 1) camTween = null;
      }
      controls.update();

      uiTimer -= dt; lcdTimer -= dt;
      if (uiTimer <= 0 || firstFrame) { updateUI(simMs, ageDays); uiTimer = 0.25; }
      if (lcdTimer <= 0) {
        const n = PC.noise3(simMs / 3.6e6, 0.2, 0.9);
        cab.updateLCD(23.4 + S.level * 1.6 + n * 0.4 - mist.state.level * 0.6, Math.min(99, S.rh));
        lcdTimer = 4;
      }
      if (draw) renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; $('#loading').hidden = true; document.body.classList.add('ready'); }
    }
    frame();
    PC.debug = { scene, camera, controls, plants, S, goView, renderer, mist, aq, step: (n, dt) => { for (let i = 0; i < n; i++) step(dt || 1 / 30, i === n - 1); } };
  }

  window.addEventListener('load', () => setTimeout(boot, 30));
})(window.PC);
