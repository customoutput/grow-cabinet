/* Room, cabinet frame, glass, shelves, hydro trays, LEDs, fans, tubing, doors */
(function (PC) {
  'use strict';
  const D = PC.DIM;

  PC.buildRoom = function (scene) {
    const wood = PC.Tex.wood(); wood.repeat.set(3, 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0, envMapIntensity: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    const pl = PC.Tex.plaster(); pl.repeat.set(4, 2);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4),
      new THREE.MeshStandardMaterial({ map: pl, roughness: 0.95, envMapIntensity: 0.3 }));
    wall.position.set(0, 2, -0.3); wall.receiveShadow = true; scene.add(wall);
    const base = PC.box(8, 0.09, 0.015, new THREE.MeshStandardMaterial({ color: 0x1d1c1a, roughness: 0.6 }), 0, 0.045, -0.29, scene);
    base.receiveShadow = true;

    // soft light spill on floor and wall (additive)
    const glowTex = PC.Tex.glow();
    const spillMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffe9cc, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), spillMat);
    spill.rotation.x = -Math.PI / 2; spill.position.set(0, 0.002, 0.55); scene.add(spill);
    const wallSpill = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.8), spillMat.clone());
    wallSpill.material.opacity = 0.12; wallSpill.position.set(0, 1.1, -0.295); scene.add(wallSpill);
    return { spillMats: [spillMat, wallSpill.material] };
  };

  PC.buildCabinet = function (scene) {
    const cab = new THREE.Group(); scene.add(cab);
    const out = { group: cab, lights: [], ledMats: [], glows: [], fans: [], doors: [], trays: [] };

    const metal = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.42, metalness: 0.55 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xe6f4f0, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.09, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
    const shelfGlass = new THREE.MeshPhysicalMaterial({ color: 0xbfe5dc, roughness: 0.05, transparent: true, opacity: 0.28, envMapIntensity: 1.2, depthWrite: false });
    const felt = PC.Tex.felt(); felt.repeat.set(3, 6);
    const backMat = new THREE.MeshStandardMaterial({ map: felt, color: 0x9a9e9a, roughness: 0.95, envMapIntensity: 0.2 });
    out.metal = metal; out.glass = glass;

    const W = D.W, H = D.H, Dp = D.D, hw = W / 2, hd = Dp / 2;
    const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
    // plinth
    sh(PC.box(W, D.plinth, Dp, metal, 0, D.plinth / 2, 0, cab));
    // posts
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) sh(PC.box(0.022, H - D.plinth, 0.022, metal, sx * (hw - 0.011), D.plinth + (H - D.plinth) / 2, sz * (hd - 0.011), cab));
    // top
    sh(PC.box(W, 0.03, Dp, metal, 0, H - 0.015, 0, cab));
    // top/bottom rails sides
    for (const sx of [-1, 1]) for (const y of [D.plinth + 0.01, H - 0.04]) PC.box(0.02, 0.02, Dp, metal, sx * (hw - 0.01), y, 0, cab);
    // back panel
    const back = PC.box(W - 0.02, H - D.plinth - 0.03, 0.01, backMat, 0, D.plinth + (H - D.plinth - 0.03) / 2, -hd + 0.006, cab);
    back.receiveShadow = true;
    // side glass
    for (const sx of [-1, 1]) {
      const g = PC.box(0.005, H - D.plinth - 0.06, Dp - 0.04, glass, sx * (hw - 0.01), D.plinth + (H - D.plinth) / 2, 0, cab);
      g.renderOrder = 10;
    }

    // ---- shelves ------------------------------------------------------
    for (const y of D.shelves) {
      const s = PC.box(D.inW, 0.008, 0.42, shelfGlass, 0, y - 0.004, 0.01, cab);
      s.receiveShadow = true; s.renderOrder = 5;
      PC.box(D.inW, 0.018, 0.016, metal, 0, y - 0.012, 0.215, cab);
      PC.box(D.inW, 0.012, 0.012, metal, 0, y - 0.012, -0.19, cab);
    }

    // ---- hydroponic trays with LECA --------------------------------------
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x0e0f0f, roughness: 0.62, metalness: 0.1 });
    const lecaGeo = new THREE.IcosahedronGeometry(0.0068, 1);
    const lecaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
    for (let s = 0; s < 3; s++) {
      const y = D.shelves[s], tw = D.trayW, td = D.trayD, th = D.trayH, z = D.trayZ, t = 0.004;
      const tg = new THREE.Group(); tg.position.set(0, y, z); cab.add(tg);
      sh(PC.box(tw, t, td, trayMat, 0, t / 2, 0, tg));
      sh(PC.box(tw, th, t, trayMat, 0, th / 2, td / 2 - t / 2, tg));
      sh(PC.box(tw, th, t, trayMat, 0, th / 2, -td / 2 + t / 2, tg));
      sh(PC.box(t, th, td, trayMat, tw / 2 - t / 2, th / 2, 0, tg));
      sh(PC.box(t, th, td, trayMat, -tw / 2 + t / 2, th / 2, 0, tg));
      // rolled lip
      PC.box(tw + 0.006, 0.006, 0.008, trayMat, 0, th, td / 2, tg);
      // fill below LECA
      PC.box(tw - 0.01, th - 0.02, td - 0.01, new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 1 }), 0, (th - 0.02) / 2, 0, tg);

      const r = PC.rng(77 + s), step = 0.0118;
      const nx = Math.floor((tw - 0.02) / step), nz = Math.floor((td - 0.02) / step);
      const count = nx * nz * 2;
      const inst = new THREE.InstancedMesh(lecaGeo, lecaMat, count);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
      let k = 0;
      for (let layer = 0; layer < 2; layer++) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x = -tw / 2 + 0.01 + (i + 0.5 + (r() - 0.5) * 0.7 + layer * 0.5) * step;
        const zz = -td / 2 + 0.01 + (j + 0.5 + (r() - 0.5) * 0.7 + layer * 0.5) * step;
        if (Math.abs(x) > tw / 2 - 0.009 || Math.abs(zz) > td / 2 - 0.009) { m4.makeScale(0, 0, 0); inst.setMatrixAt(k++, m4); continue; }
        const yy = th - 0.014 + layer * 0.006 + PC.noise3(x * 30, zz * 30, s) * 0.003;
        const s0 = 0.75 + r() * 0.5;
        sc.set(s0 * (0.9 + r() * 0.2), s0 * (0.85 + r() * 0.2), s0 * (0.9 + r() * 0.2));
        e.set(r() * 6.28, r() * 6.28, r() * 6.28); q.setFromEuler(e);
        p.set(x, yy, zz); m4.compose(p, q, sc); inst.setMatrixAt(k, m4);
        const v = 0.75 + r() * 0.35;
        col.setRGB(0.36 * v, 0.17 * v, 0.09 * v); inst.setColorAt(k, col);
        k++;
      }
      inst.castShadow = false; inst.receiveShadow = true; tg.add(inst);
      out.trays.push(tg);

      // drain fitting + level indicator
      const fit = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0x202224, roughness: 0.4 }));
      fit.position.set(-tw / 2 + 0.03, th + 0.008, -td / 2 + 0.03); tg.add(fit);
    }

    // ---- LED bars + lights ----------------------------------------------
    const alu = new THREE.MeshStandardMaterial({ color: 0x9aa1a5, roughness: 0.32, metalness: 0.85 });
    const glowTex = PC.Tex.glow();
    const ledY = [D.shelves[0] - 0.018, D.shelves[1] - 0.018, D.shelves[2] - 0.018, D.ceiling - 0.015];
    ledY.forEach((y, i) => {
      for (const zz of [0.11, -0.07]) {
        PC.box(0.86, 0.01, 0.026, alu, 0, y - 0.005, zz, cab);
        const ledMat = new THREE.MeshBasicMaterial({ color: 0xfff3e2, toneMapped: false });
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.014), ledMat);
        strip.rotation.x = Math.PI / 2; strip.position.set(0, y - 0.0105, zz); cab.add(strip);
        out.ledMats.push({ mat: ledMat, tank: i === 0 });
        const gm = new THREE.MeshBasicMaterial({ map: glowTex, color: i === 0 ? 0xdff6ff : 0xfff0dc, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
        const g = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.07), gm);
        g.rotation.x = Math.PI / 2; g.position.set(0, y - 0.012, zz); cab.add(g);
        out.glows.push({ mat: gm, base: 0.55, tank: i === 0 });
      }
      // two spot lights per level for even coverage, one casts shadows
      for (const lx of [-0.24, 0.24]) {
        const sp = new THREE.SpotLight(i === 0 ? 0xeaf8ff : 0xfff1e0, 0, 1.6, 1.25, 0.95, 1.4);
        sp.position.set(lx, y - 0.02, 0.03);
        sp.target.position.set(lx * 0.8, y - 0.5, 0.0);
        cab.add(sp); cab.add(sp.target);
        const shadow = i > 0;
        if (shadow) {
          sp.castShadow = true;
          sp.shadow.mapSize.set(1024, 1024);
          sp.shadow.camera.near = 0.02; sp.shadow.camera.far = 1.2;
          sp.shadow.bias = -0.0006; sp.shadow.normalBias = 0.01; sp.shadow.radius = 4;
        }
        out.lights.push({ light: sp, base: i === 0 ? 1.5 : 2.4, tank: i === 0 });
      }
    });

    // ---- fans ------------------------------------------------------------
    const fanFrame = new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.55 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222426, roughness: 0.5, transparent: true, opacity: 1 });
    const blurMat = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    for (let s = 0; s < 3; s++) {
      const f = new THREE.Group();
      const size = 0.08, t = 0.007;
      // square frame with 4 bars
      PC.box(size, t, 0.025, fanFrame, 0, size / 2 - t / 2, 0, f);
      PC.box(size, t, 0.025, fanFrame, 0, -size / 2 + t / 2, 0, f);
      PC.box(t, size, 0.025, fanFrame, size / 2 - t / 2, 0, 0, f);
      PC.box(t, size, 0.025, fanFrame, -size / 2 + t / 2, 0, 0, f);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.0035, 8, 40), fanFrame); f.add(ring);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 24), fanFrame); hub.rotation.x = Math.PI / 2; f.add(hub);
      // rear struts
      for (let a = 0; a < 3; a++) { const st = PC.box(0.036, 0.003, 0.003, fanFrame, 0, 0, -0.011, f); st.rotation.z = a * 2.094; st.position.set(Math.cos(a * 2.094) * 0.02, Math.sin(a * 2.094) * 0.02, -0.011); }
      const rotor = new THREE.Group(); f.add(rotor);
      for (let b = 0; b < 7; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.0016, 0.012), bladeMat);
        const piv = new THREE.Group(); piv.rotation.z = (b / 7) * Math.PI * 2;
        blade.position.x = 0.025; blade.rotation.x = 0.55; blade.rotation.y = 0.15;
        piv.add(blade); rotor.add(piv);
      }
      const blur = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.036, 40), blurMat); f.add(blur);
      const y = D.shelves[s] + 0.22;
      f.position.set(-D.inW / 2 + 0.03, y, -0.05);
      f.rotation.y = Math.PI / 2 - 0.35;
      // mounting bracket
      PC.box(0.004, 0.012, 0.06, fanFrame, -D.inW / 2 + 0.012, y - 0.04, -0.05, cab);
      cab.add(f);
      out.fans.push({ group: f, rotor, speed: 0 });
    }
    out.bladeMat = bladeMat; out.blurMat = blurMat;

    // ---- tubing (pump -> top tray, trays cascade -> tank) ----------------
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0d, roughness: 0.25, metalness: 0.1 });
    const tube = (pts, r) => {
      const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(24, pts.length * 14), r || 0.0042, 8, false), tubeMat);
      m.castShadow = true; cab.add(m); return m;
    };
    const s0 = D.shelves;
    tube([[0.4, 0.15, -0.155], [0.4, 0.44, -0.16], [0.41, 0.505, -0.175], [0.43, 0.505, -0.2], [0.455, 0.47, -0.212], [0.458, 0.8, -0.215], [0.458, s0[2] + 0.04, -0.215], [0.45, s0[2] + 0.1, -0.2], [0.4, s0[2] + 0.09, -0.16], [0.39, s0[2] + 0.065, -0.155]]);
    const drain = (yTop, yBot) => tube([[-0.4, yTop + 0.005, -0.15], [-0.41, yTop - 0.01, -0.17], [-0.44, yTop - 0.03, -0.215], [-0.445, (yTop + yBot) / 2, -0.215], [-0.44, yBot + 0.1, -0.21], [-0.42, yBot + 0.11, -0.17], [-0.395, yBot + 0.085, -0.15]], 0.005);
    drain(s0[2], s0[1]);
    drain(s0[1], s0[0]);
    tube([[-0.4, s0[0] + 0.005, -0.15], [-0.41, s0[0] - 0.01, -0.17], [-0.44, s0[0] - 0.04, -0.215], [-0.445, 0.53, -0.214], [-0.43, 0.515, -0.2], [-0.4, 0.52, -0.165], [-0.39, 0.51, -0.155]], 0.005);
    out.trickleOrigin = new THREE.Vector3(-0.39, 0.505, -0.155);

    // ---- ultrasonic humidifier beside the cabinet, hose to a mist manifold ----
    {
      // black tower humidifier: matte body, smoked tank lit from inside, LED ring, light bar and display
      const hum = new THREE.Group(); hum.position.set(0.8, 0, 0.02); scene.add(hum);
      const black = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.55, metalness: 0.2 });
      const gloss = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
      const lathe = (pts, mat, segs) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map((q) => new THREE.Vector2(q[0], q[1])), segs || 64), mat); hum.add(m); return m; };
      lathe([[0, 0], [0.098, 0], [0.1, 0.006], [0.1, 0.03], [0.096, 0.034], [0, 0.034]], black);
      lathe([[0, 0.04], [0.092, 0.04], [0.09, 0.2], [0, 0.2]], gloss);
      // smoked glass water tank with an inner glow
      const smoke = new THREE.MeshPhysicalMaterial({ color: 0x15181a, roughness: 0.05, transparent: true, opacity: 0.72, envMapIntensity: 1.6, depthWrite: false, clearcoat: 1 });
      const tankC = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.089, 0.15, 64, 1, true), smoke); tankC.position.y = 0.276; tankC.renderOrder = 13; hum.add(tankC);
      const innerM = new THREE.MeshBasicMaterial({ color: 0x29d3ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.081, 0.1, 48), innerM); inner.position.y = 0.255; inner.renderOrder = 12; hum.add(inner);
      lathe([[0, 0.35], [0.09, 0.35], [0.088, 0.372], [0.07, 0.384], [0, 0.384]], gloss);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 32), black); spout.position.y = 0.398; hum.add(spout);
      // LEDs
      const ringM = new THREE.MeshBasicMaterial({ color: 0x29d3ff, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.099, 0.0028, 8, 96), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = 0.037; hum.add(ring);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.089, 0.002, 8, 96), ringM); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.352; hum.add(ring2);
      const ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0018, 8, 48), ringM); ring3.rotation.x = Math.PI / 2; ring3.position.y = 0.413; hum.add(ring3);
      const barM = new THREE.MeshBasicMaterial({ color: 0x29d3ff, toneMapped: false });
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 0.07), barM); bar.position.set(0, 0.09, 0.0925); hum.add(bar);
      // round touch display
      const dc = PC.Tex.canvas(256), dTex = PC.Tex.tex(dc, true);
      const disp = new THREE.Mesh(new THREE.CircleGeometry(0.028, 48), new THREE.MeshBasicMaterial({ map: dTex, toneMapped: false }));
      disp.position.set(0, 0.163, 0.0918); hum.add(disp);
      // light spill on floor and wall
      const gTex = PC.Tex.glow();
      const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: gTex, color: 0x29d3ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = 0.003; hum.add(floorGlow);
      const wallGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), floorGlow.material.clone()); wallGlow.position.set(0, 0.3, -0.315); wallGlow.material.opacity = 0.18; hum.add(wallGlow);
      hum.traverse((o) => { if (o.isMesh && o.material.toneMapped !== false && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
      const ledCols = [new THREE.Color(0x29d3ff), new THREE.Color(0x7a5cff)], tmpC = new THREE.Color();
      let lastRH = -1, lastOn = null;
      function drawDisplay(rh, on) {
        const x = dc.getContext('2d'), S = 256;
        x.clearRect(0, 0, S, S); x.fillStyle = '#030405'; x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, 6.283); x.fill();
        x.lineWidth = 9; x.lineCap = 'round';
        x.strokeStyle = 'rgba(41,211,255,0.15)'; x.beginPath(); x.arc(S / 2, S / 2, 104, 0.75 * Math.PI, 2.25 * Math.PI); x.stroke();
        x.strokeStyle = on ? '#29d3ff' : '#3a4a52'; x.beginPath(); x.arc(S / 2, S / 2, 104, 0.75 * Math.PI, (0.75 + 1.5 * rh / 100) * Math.PI); x.stroke();
        x.fillStyle = on ? '#bff3ff' : '#55656c'; x.textAlign = 'center';
        x.font = '600 84px "IBM Plex Mono", monospace'; x.fillText(String(Math.round(rh)), S / 2, 150);
        x.font = '500 26px "IBM Plex Mono", monospace'; x.fillText(on ? '%RH  MIST' : '%RH  IDLE', S / 2, 196);
        dTex.needsUpdate = true;
      }
      out.updateHumidifier = function (t, on, rh) {
        const k = 0.5 + 0.5 * Math.sin(t * 0.35);
        tmpC.copy(ledCols[0]).lerp(ledCols[1], k);
        const breathe = on ? 0.75 + 0.25 * Math.sin(t * 1.4) : 0.18;
        ringM.color.copy(tmpC).multiplyScalar(on ? 1 : 0.25);
        barM.color.copy(tmpC).multiplyScalar(breathe);
        innerM.color.copy(tmpC); innerM.opacity = on ? 0.32 + 0.08 * Math.sin(t * 2.1) : 0.06;
        floorGlow.material.color.copy(tmpC); floorGlow.material.opacity = on ? 0.5 : 0.12;
        wallGlow.material.color.copy(tmpC); wallGlow.material.opacity = on ? 0.16 : 0.04;
        const r = Math.round(rh);
        if (r !== lastRH || on !== lastOn) { drawDisplay(r, on); lastRH = r; lastOn = on; }
      };
      out.humLed = null;

      const hoseM = new THREE.MeshStandardMaterial({ color: 0x0e0f10, roughness: 0.42, metalness: 0.05 });
      const hose = (pts, r) => {
        const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
        const m = new THREE.Mesh(new THREE.TubeGeometry(c, 90, r, 10, false), hoseM); m.castShadow = true; scene.add(m); return m;
      };
      hose([[0.8, 0.41, 0.02], [0.8, 0.52, 0.0], [0.74, 1.2, -0.12], [0.62, 1.95, -0.2], [0.5, 2.05, -0.2], [0.42, 2.05, -0.2], [0.41, 1.99, -0.2]], 0.011);
      // manifold down the back right corner with a nozzle into each plant shelf
      const top = D.ceiling - 0.005;
      hose([[0.41, top, -0.2], [0.41, D.shelves[0] + 0.3, -0.2]], 0.006);
      out.mistNozzles = [];
      const zoneTop = [D.shelves[1], D.shelves[2], D.ceiling];
      for (let s = 0; s < 3; s++) {
        const y = D.shelves[s] + 0.3;
        hose([[0.41, y, -0.2], [0.39, y, -0.19], [0.37, y - 0.005, -0.175]], 0.005);
        const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.005, 0.016, 16), new THREE.MeshStandardMaterial({ color: 0x111213, roughness: 0.35, metalness: 0.3 }));
        noz.position.set(0.365, y - 0.006, -0.172); noz.rotation.set(Math.PI / 2, 0, -0.9); cab.add(noz);
        out.mistNozzles.push({ pos: new THREE.Vector3(0.355, y - 0.008, -0.165), dir: new THREE.Vector3(-0.75, -0.1, 0.65).normalize(), ymin: D.shelves[s] + 0.004, ymax: zoneTop[s] - 0.03, shelf: s });
      }
    }

    // ---- doors -------------------------------------------------------------
    const doorH = H - D.plinth - 0.04, doorW = hw - 0.004;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * hw, D.plinth + 0.02, hd + 0.008); cab.add(pivot);
      const dg = new THREE.Group(); pivot.add(dg);
      const cxm = -side * doorW / 2;
      const bar = 0.018;
      PC.box(doorW, bar, 0.014, metal, cxm, bar / 2, 0, dg);
      PC.box(doorW, bar, 0.014, metal, cxm, doorH - bar / 2, 0, dg);
      PC.box(bar, doorH, 0.014, metal, -side * bar / 2, doorH / 2, 0, dg);
      PC.box(bar, doorH, 0.014, metal, -side * (doorW - bar / 2), doorH / 2, 0, dg);
      const gl = PC.box(doorW - 0.02, doorH - 0.02, 0.004, glass, cxm, doorH / 2, 0, dg); gl.renderOrder = 20;
      // handle
      PC.box(0.012, 0.14, 0.012, metal, -side * (doorW - 0.04), 1.05, 0.02, dg);
      PC.box(0.012, 0.012, 0.02, metal, -side * (doorW - 0.04), 1.12, 0.01, dg);
      PC.box(0.012, 0.012, 0.02, metal, -side * (doorW - 0.04), 0.98, 0.01, dg);
      out.doors.push({ pivot, side, open: 0 });
    }

    // ---- thermo-hygrometer ---------------------------------------------
    const lcd = PC.Tex.canvas(256, 160);
    const lcdTex = PC.Tex.tex(lcd, true);
    const dev = new THREE.Group();
    PC.box(0.07, 0.05, 0.018, new THREE.MeshStandardMaterial({ color: 0xe9e8e3, roughness: 0.5 }), 0, 0.025, 0, dev);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.038), new THREE.MeshStandardMaterial({ map: lcdTex, roughness: 0.25, emissive: 0xffffff, emissiveMap: lcdTex, emissiveIntensity: 0.12 }));
    scr.position.set(0, 0.026, 0.0095); dev.add(scr);
    PC.box(0.04, 0.004, 0.03, new THREE.MeshStandardMaterial({ color: 0xd9d8d2 }), 0, 0.002, -0.008, dev);
    dev.position.set(0.39, D.shelves[0], 0.16); dev.rotation.y = -0.3; dev.rotation.x = -0.1;
    dev.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    cab.add(dev);
    out.updateLCD = function (temp, rh) {
      const x = lcd.getContext('2d');
      x.fillStyle = '#c9cfc3'; x.fillRect(0, 0, 256, 160);
      x.fillStyle = '#20241f';
      x.font = '600 64px "IBM Plex Mono", monospace'; x.textAlign = 'right';
      x.fillText(temp.toFixed(1), 196, 72);
      x.font = '600 22px "IBM Plex Mono", monospace'; x.fillText('°C', 236, 44);
      x.font = '600 56px "IBM Plex Mono", monospace'; x.fillText(String(Math.round(rh)), 196, 140);
      x.font = '600 22px "IBM Plex Mono", monospace'; x.fillText('%RH', 248, 140);
      x.fillRect(12, 86, 232, 2);
      lcdTex.needsUpdate = true;
    };
    out.updateLCD(24.6, 78);

    return out;
  };
})(window.PC);
