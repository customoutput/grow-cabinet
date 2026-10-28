/* Humidifier mist: soft fog puffs from a nozzle on each plant shelf. Mist sinks, drifts
   with the fans, pools in each shelf, hazes the air and fogs the glass. */
(function (PC) {
  'use strict';
  const D = PC.DIM;

  function puffTexture() {
    const S = 128, c = PC.Tex.canvas(S), x = c.getContext('2d'), r = PC.rng(12);
    for (let i = 0; i < 14; i++) {
      const px = S / 2 + (r() - 0.5) * S * 0.35, py = S / 2 + (r() - 0.5) * S * 0.35, rad = S * (0.18 + r() * 0.2);
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    }
    return PC.Tex.tex(c, false);
  }

  PC.buildMist = function (scene, cab, renderer) {
    const MAX = 1600, nozzles = cab.mistNozzles;
    const pos = new Float32Array(MAX * 3), aSize = new Float32Array(MAX), aAlpha = new Float32Array(MAX);
    const P = [];
    for (let i = 0; i < MAX; i++) P.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 0.03, n: 0, seed: Math.random() * 50 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    const uniforms = { uTex: { value: puffTexture() }, uScale: { value: 600 }, uColor: { value: new THREE.Color(1, 1, 1) } };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false,
      vertexShader: `
        attribute float aSize; attribute float aAlpha; uniform float uScale;
        varying float vA; varying float vRot;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.05, -mv.z);
          vA = aAlpha; vRot = fract(position.x * 37.0 + position.z * 91.0) * 6.28;
        }`,
      fragmentShader: `
        uniform sampler2D uTex; uniform vec3 uColor; varying float vA; varying float vRot;
        void main() {
          vec2 p = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot);
          p = mat2(c, -s, s, c) * p + 0.5;
          float a = texture2D(uTex, p).a * vA;
          if (a < 0.002) discard;
          gl_FragColor = vec4(uColor, a);
        }`
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false; points.renderOrder = 15; scene.add(points);

    // ambient haze inside each shelf
    const hazes = [];
    const tops = [D.shelves[1], D.shelves[2], D.ceiling];
    for (let s = 0; s < 3; s++) {
      const h = tops[s] - D.shelves[s] - 0.01;
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const b = new THREE.Mesh(new THREE.BoxGeometry(D.inW - 0.02, h, D.inD - 0.02), m);
      b.position.set(0, D.shelves[s] + h / 2 + 0.005, 0); b.renderOrder = 16; scene.add(b);
      hazes.push(m);
    }

    let emitAcc = 0, cursor = 0;
    const state = { level: 0 };
    function spawn(nz) {
      for (let k = 0; k < MAX; k++) {
        cursor = (cursor + 1) % MAX;
        const p = P[cursor];
        if (p.alive) continue;
        const sp = 0.16 + Math.random() * 0.12;
        p.alive = true; p.age = 0; p.life = 12 + Math.random() * 9; p.s0 = 0.018 + Math.random() * 0.02; p.n = nz;
        p.x = nz.pos.x + (Math.random() - 0.5) * 0.01; p.y = nz.pos.y; p.z = nz.pos.z + (Math.random() - 0.5) * 0.01;
        p.vx = nz.dir.x * sp + (Math.random() - 0.5) * 0.02; p.vy = nz.dir.y * sp - Math.random() * 0.01; p.vz = nz.dir.z * sp + (Math.random() - 0.5) * 0.02;
        return;
      }
    }

    function update(dt, t, on, winds, light) {
      dt = Math.min(dt, 0.05);
      state.level = on ? state.level + dt * (1 - state.level) / 22 : state.level - dt * state.level / 50;
      if (on) {
        emitAcc += dt * 30 * nozzles.length;
        while (emitAcc >= 1) { emitAcc -= 1; spawn(nozzles[Math.floor(Math.random() * nozzles.length)]); }
      }
      const xMax = D.inW / 2 - 0.03, zMax = D.inD / 2 - 0.025;
      for (let i = 0; i < MAX; i++) {
        const p = P[i];
        if (!p.alive) { aAlpha[i] = 0; continue; }
        p.age += dt;
        if (p.age > p.life) { p.alive = false; aAlpha[i] = 0; continue; }
        const drag = Math.exp(-dt * 0.55);
        p.vx *= drag; p.vy *= drag; p.vz *= drag;
        p.vy -= 0.016 * dt;                                // cool mist sinks
        p.vx += (winds[p.n.shelf] || 0) * 0.035 * dt;     // fan pushes it across
        const n1 = PC.noise3(p.x * 5 + p.seed, p.y * 5, t * 0.15), n2 = PC.noise3(p.z * 5, p.x * 5 + p.seed, t * 0.15 + 7);
        p.vx += n1 * 0.02 * dt; p.vz += n2 * 0.02 * dt; p.vy += PC.noise3(p.y * 4, t * 0.12, p.seed) * 0.006 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const pad = aSize[i] * 0.3;
        if (p.x < -xMax + pad) { p.x = -xMax + pad; p.vx *= -0.3; } else if (p.x > xMax - pad) { p.x = xMax - pad; p.vx *= -0.3; }
        if (p.z < -zMax + pad) { p.z = -zMax + pad; p.vz *= -0.3; } else if (p.z > zMax - pad) { p.z = zMax - pad; p.vz *= -0.3; }
        const ylo = p.n.ymin + 0.02, yhi = p.n.ymax;
        if (p.y < ylo) { p.y = ylo; p.vy = Math.abs(p.vy) * 0.2; p.vx *= 1.02; p.vz *= 1.02; } else if (p.y > yhi) { p.y = yhi; p.vy *= -0.3; }
        const k = p.age / p.life;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        aSize[i] = p.s0 * (1 + 4.5 * Math.sqrt(k));
        aAlpha[i] = PC.smooth(0, 1.5, p.age) * (1 - PC.smooth(0.5, 1, k)) * 0.075;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true;
      const v = 0.22 + 0.78 * light;
      uniforms.uColor.value.setRGB(0.86 * v, 0.9 * v, 0.92 * v); if (PC.shared.tint) uniforms.uColor.value.multiply(PC.shared.tint);
      for (const h of hazes) { h.opacity = state.level * 0.15; h.color.setRGB(0.85 * v, 0.89 * v, 0.9 * v); if (PC.shared.tint) h.color.multiply(PC.shared.tint); }
      // condensation on the glass
      cab.glass.opacity = 0.09 + state.level * 0.17;
      cab.glass.roughness = 0.03 + state.level * 0.35;
      cab.glass.color.setRGB(0.9 + state.level * 0.1, 0.96 + state.level * 0.04, 0.94 + state.level * 0.06);
    }
    function resize(camera) {
      uniforms.uScale.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];
    }
    return { update, resize, state };
  };
})(window.PC);
