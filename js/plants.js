/* Plant growth engine: procedural aroids that put out a new leaf every week or so.
   Each leaf emerges as a rolled spike, unfurls, expands, hardens off from its new-leaf
   colour, and the oldest leaf yellows and drops once the plant carries its maximum.
   Every leaf picks its own variegation texture, so no two leaves look alike. */
(function (PC) {
  'use strict';

  // Growth habit per variety. Sizes are metres; intervals are days between new leaves.
  const VARIETIES = {
    bulbasaur: {
      label: "Monstera 'Bulbasaur' (mint)", interval: [7, 10], maxLeaves: 6, L: [0.045, 0.22], petiole: [0.04, 0.18], petR: 0.0032,
      lean: [0.2, 0.95], pitch: [0.4, -0.15], droop: 0.24, fold: 0.06, cup: 0.05, rough: 0.42, sheen: 0.05, env: 0.45,
      young: [1.25, 1.3, 0.85], unfurl: [2.0, 6.0], petColor: 0x7aa05a, stem: 0.05, stemColor: 0x6f8a4e, spread: 2.2
    },
    tigerMint: {
      label: "Monstera 'White Tiger Mint'", interval: [7, 10], maxLeaves: 6, L: [0.045, 0.22], petiole: [0.04, 0.18], petR: 0.0032,
      lean: [0.2, 0.95], pitch: [0.4, -0.15], droop: 0.24, fold: 0.06, cup: 0.05, rough: 0.42, sheen: 0.05, env: 0.45,
      young: [1.25, 1.3, 0.85], unfurl: [2.0, 6.0], petColor: 0x86a668, stem: 0.05, stemColor: 0x7c9460, spread: 2.2
    },
    billietiae: {
      label: 'Philodendron billietiae variegata', interval: [7, 10], maxLeaves: 6, L: [0.05, 0.21], petiole: [0.04, 0.2], petR: 0.0026,
      lean: [0.12, 0.5], pitch: [-0.6, -1.2], droop: 0.08, fold: 0.1, cup: 0, wave: 0.6, rough: 0.3, sheen: 0.05, env: 0.6,
      young: [1.2, 1.15, 0.75], unfurl: [1.8, 5.0], petColor: 0xc4733a, stem: 0.03, stemColor: 0x8a6a3a, spread: 2.0, grid: [8, 22]
    },
    dragonScale: {
      label: "Alocasia 'Dragon Scale Mint'", interval: [10, 14], maxLeaves: 4, L: [0.045, 0.15], petiole: [0.05, 0.15], petR: 0.0028,
      lean: [0.12, 0.6], pitch: [0.8, 0.25], droop: 0.04, fold: 0.05, cup: 0.12, rough: 0.32, sheen: 0.1, env: 0.65,
      young: [1.12, 1.15, 1.05], unfurl: [2.4, 6.5], petColor: 0x9aa886, stem: 0.015, stemColor: 0x8a8a6a, spread: 2.2
    },
    blackVelvetPink: {
      label: "Alocasia 'Black Velvet' pink", interval: [11, 15], maxLeaves: 4, L: [0.04, 0.13], petiole: [0.04, 0.11], petR: 0.0024,
      lean: [0.2, 0.7], pitch: [0.55, 0.0], droop: 0.06, fold: 0.04, cup: 0.06, rough: 0.85, sheen: 0.9, env: 0.3,
      young: [1.15, 1.0, 1.0], unfurl: [2.4, 6.5], petColor: 0x4a3a3c, stem: 0.012, stemColor: 0x4a3a34, spread: 2.2
    },
    peachLatte: {
      label: "Alocasia cuprea 'Peach Latte'", interval: [10, 14], maxLeaves: 4, L: [0.045, 0.15], petiole: [0.05, 0.14], petR: 0.0028,
      lean: [0.12, 0.6], pitch: [0.75, 0.2], droop: 0.04, fold: 0.05, cup: 0.1, rough: 0.28, sheen: 0.15, env: 0.9, metal: 0.25,
      young: [1.15, 1.0, 1.0], unfurl: [2.4, 6.5], petColor: 0xb3897a, stem: 0.015, stemColor: 0x8a6a5a, spread: 2.2
    },
    veitchii: {
      label: 'Anthurium veitchii (King)', interval: [11, 15], maxLeaves: 5, L: [0.06, 0.26], petiole: [0.05, 0.15], petR: 0.0026,
      lean: [0.25, 0.85], pitch: [1.05, -1.25], droop: 0.08, fold: 0.07, cup: 0, rough: 0.3, sheen: 0.08, env: 0.7,
      young: [1.2, 1.05, 0.8], unfurl: [2.2, 6.5], petColor: 0x55703a, stem: 0.03, stemColor: 0x5a4b32, spread: 0.85, grid: [10, 46], corr: 1
    },
    warocqueanum: {
      label: 'Anthurium warocqueanum (Queen)', interval: [11, 15], maxLeaves: 5, L: [0.06, 0.25], petiole: [0.05, 0.14], petR: 0.0022,
      lean: [0.25, 0.85], pitch: [1.05, -1.3], droop: 0.08, fold: 0.06, cup: 0, rough: 0.85, sheen: 0.9, env: 0.3,
      young: [1.25, 0.95, 0.8], unfurl: [2.2, 6.5], petColor: 0x4c5a32, stem: 0.03, stemColor: 0x5a4b32, spread: 0.85, grid: [8, 24]
    },
    // ---- large floor plants ----
    marbleMonstera: {
      label: 'Monstera marble variegata (floor)', interval: [12, 16], maxLeaves: 9, L: [0.2, 0.46], petiole: [0.18, 0.42], petR: 0.0075,
      lean: [0.5, 1.1], pitch: [0.95, 0.25], droop: 0.2, fold: 0.05, cup: 0.04, rough: 0.4, sheen: 0.05, env: 0.5,
      young: [1.2, 1.25, 0.9], unfurl: [2.5, 7], petColor: 0x5e8a3e, stem: 0.7, stemR: 2.6, stemColor: 0x5b6e3c, spread: 1.15,
      grid: [16, 22], climb: true, xl: true
    },
    blackVelvetXL: {
      label: "Alocasia 'Black Velvet' pink (floor)", interval: [13, 18], maxLeaves: 7, L: [0.2, 0.44], petiole: [0.4, 0.82], petR: 0.007,
      lean: [0.12, 0.6], pitch: [0.95, 0.35], droop: 0.06, fold: 0.04, cup: 0.06, rough: 0.85, sheen: 0.9, env: 0.3,
      young: [1.15, 1.0, 1.0], unfurl: [3, 8], petColor: 0x5e4a48, stem: 0.13, stemR: 3.8, stemColor: 0x4a3a34, spread: 1.3,
      grid: [14, 20], xl: true
    }
  };
  PC.VARIETIES = VARIETIES;

  function leafGeometry(NX, NY) {
    const pos = new Float32Array((NX + 1) * (NY + 1) * 3), uv = new Float32Array((NX + 1) * (NY + 1) * 2), idx = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const k = j * (NX + 1) + i; uv[k * 2] = i / NX; uv[k * 2 + 1] = j / NY; }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.userData = { NX, NY };
    return g;
  }
  function shapeLeaf(geo, P, set) {
    const { NX, NY } = geo.userData;
    const pos = geo.attributes.position, W = P.W, L = P.L, back = P.back, hW = W / 2;
    const R = P.roll > 0.002 ? hW / (P.roll * Math.PI * 1.15) : 0;
    const ca = Math.cos(set.angle), sa = Math.sin(set.angle);
    for (let j = 0; j <= NY; j++) {
      const v = j / NY, Yn = -back + v * (1 + back), y = Yn * L;
      for (let i = 0; i <= NX; i++) {
        const X = (i / NX) * 2 - 1, x = X * hW, s = Math.abs(x), sg = Math.sign(x);
        let xx = x, z = 0;
        if (R) { const a = s / R; xx = sg * R * Math.sin(a); z = R * (1 - Math.cos(a)); }
        z += P.fold * s + P.cup * s * s / hW;
        if (P.wave) z += P.wave * W * 0.06 * Math.sin(Yn * 16 + P.wavePh + sg) * (s / hW) * (s / hW) * (1 - P.roll);
        if (P.corr) {
          const acr = Yn * ca - Math.abs(X) * set.aspect * 0.5 * sa;
          z += P.corr * L * 0.011 * Math.sin(acr * Math.PI * 2 * set.corr) * Math.min(1, s / (hW * 0.15)) * (1 - P.roll);
        }
        z -= P.droop * Yn * Yn * L * (Yn > 0 ? 1 : 0.6);
        const yy = y * (1 - 0.12 * P.droop * Yn * Yn);
        pos.setXYZ(j * (NX + 1) + i, xx, yy, z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // ---- materials ----------------------------------------------------------
  function leafMaterial(set, g, U) {
    const m = new THREE.MeshStandardMaterial({
      map: set.map, normalMap: set.normalMap, alphaMap: set.alphaMap, alphaTest: 0.5, side: THREE.DoubleSide,
      roughness: g.rough, metalness: g.metal || 0, envMapIntensity: g.env, normalScale: new THREE.Vector2(0.9, 0.9)
    });
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = PC.shared.time; sh.uniforms.uLight = PC.shared.plantLight;
      sh.uniforms.uFlutter = U.uFlutter; sh.uniforms.uPhase = U.uPhase; sh.uniforms.uSheen = { value: g.sheen };
      sh.vertexShader = 'uniform float uTime; uniform float uFlutter; uniform float uPhase;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float edge = abs(uv.x - 0.5) * 2.0;
        float along = uv.y;
        transformed.z += sin(uTime * 2.4 + uPhase + along * 3.0 + edge * 1.5) * uFlutter * 0.003 * (edge * edge + along * 0.6);
        transformed.z += sin(uTime * 4.1 + uPhase * 1.7 + along * 5.0) * uFlutter * 0.0008 * edge;`);
      sh.fragmentShader = 'uniform float uSheen; uniform float uLight;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.25) * vec3(1.15, 1.22, 1.0);`)
        .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
          float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
          outgoingLight += diffuseColor.rgb * fres * uSheen * 0.45 * uLight;
          gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
    };
    m.customProgramCacheKey = () => 'leaf';
    return m;
  }

  function taperTube(curve, r0, r1, segs) {
    const geo = new THREE.TubeGeometry(curve, segs, 1, 7, false);
    const p = geo.attributes.position, pt = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      curve.getPointAt(i / segs, pt);
      const r = PC.lerp(r0, r1, i / segs);
      for (let j = 0; j <= 7; j++) {
        const k = i * 8 + j;
        v.fromBufferAttribute(p, k).sub(pt).multiplyScalar(r).add(pt);
        p.setXYZ(k, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }

  // ---- Plant --------------------------------------------------------------
  class Plant {
    constructor(variety, opts) {
      this.variety = variety; this.g = VARIETIES[variety];
      this.name = opts.name || this.g.label;
      this.seed = opts.seed;
      this.ageOffset = opts.ageOffset || 0;
      this.group = new THREE.Group();
      this.group.position.copy(opts.position);
      this.leaves = new Map();
      this.sets = PC.Tex.getVarietySets(variety);
      this.fen = !!PC.Tex.LEAF_SPECS[variety].fen;
      this.depthMats = this.sets.map((s) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: s.alphaMap, alphaTest: 0.5 }));
      this.petMat = new THREE.MeshStandardMaterial({ color: this.g.petColor, roughness: 0.42, metalness: 0 });
      const r = PC.rng(this.seed);
      this.emerge = [0];
      for (let k = 1; k < 400; k++) this.emerge.push(this.emerge[k - 1] + PC.lerp(this.g.interval[0], this.g.interval[1], r()));
      this.leafRand = [];
      for (let k = 0; k < 400; k++) this.leafRand.push([r(), r(), r(), r(), r(), r(), r(), r()]);
      this.facing = opts.facing || 0;
      this._buildBase();
      this.age = -1;
    }

    _buildBase() {
      const g = this.g;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0028, 6, 28), new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.6 }));
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.002; this.group.add(rim);
      this.stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 1, 10), new THREE.MeshStandardMaterial({ color: g.stemColor, roughness: 0.75 }));
      this.stem.castShadow = true; this.group.add(this.stem);
      this.aerial = null;
    }

    leafCount(age) { let n = 0; while (n < this.emerge.length && this.emerge[n] <= age) n++; return n; }

    update(simAge) {
      const age = Math.max(0.5, simAge + this.ageOffset);
      if (Math.abs(age - this.age) < 1e-5) return;
      this.age = age;
      const g = this.g, N = this.leafCount(age);
      const stemH = Math.min(g.stem, 0.006 + age * g.stem * 0.006);
      const sr = Math.min(1, 0.5 + age / 120) * (g.stemR || 1);
      this.stem.scale.set(sr, stemH, sr);
      this.stem.position.y = stemH / 2 - 0.004;
      this.stemTop = stemH - 0.005;
      if ((this.variety === 'bulbasaur' || this.variety === 'tigerMint') && age > 70 && !this.aerial) this._addAerial();
      if (g.climb && !this.aerial) this._addAerialXL();

      const alive = new Set();
      for (let k = Math.max(0, N - g.maxLeaves - 1); k < N; k++) {
        const a = age - this.emerge[k], rank = N - 1 - k;
        let dying = 0;
        if (rank >= g.maxLeaves) {
          if (this.outside) continue;   // display plants get their old leaves trimmed
          const d = age - this.emerge[k + g.maxLeaves];
          if (d > 9) continue;
          dying = PC.smooth(0, 7, d);
        }
        alive.add(k);
        let leaf = this.leaves.get(k);
        if (!leaf) { leaf = this._makeLeaf(k); this.leaves.set(k, leaf); }
        this._grow(leaf, k, a, rank, N, dying);
      }
      for (const [k, leaf] of this.leaves) if (!alive.has(k)) this._removeLeaf(k, leaf);
    }

    _setIndex(k) {
      const rr = this.leafRand[k][5];
      if (this.fen) {
        const spec = PC.Tex.LEAF_SPECS[this.variety], per = spec.variants, nm = this.sets.length / per;
        const m = k < 2 ? 0 : k < 5 ? 1 : k < 8 ? 2 : 3, mi = PC.clamp(m - (spec.minMat || 0), 0, nm - 1);
        return mi * per + Math.floor(rr * per);
      }
      return Math.floor(rr * this.sets.length);
    }

    _makeLeaf(k) {
      const rr = this.leafRand[k], si = this._setIndex(k), set = this.sets[si];
      const U = { uFlutter: { value: 0 }, uPhase: { value: rr[6] * 50 } };
      const mat = leafMaterial(set, this.g, U);
      const grid = this.g.grid || [10, 14];
      const geo = leafGeometry(grid[0], grid[1]);
      const blade = new THREE.Mesh(geo, mat);
      blade.castShadow = true; blade.receiveShadow = true; blade.frustumCulled = false;
      blade.customDepthMaterial = this.depthMats[si];
      const pivot = new THREE.Group(); pivot.add(blade);
      const assembly = new THREE.Group(); assembly.add(pivot);
      const pet = new THREE.Mesh(new THREE.BufferGeometry(), this.petMat);
      pet.castShadow = true; pet.receiveShadow = true; assembly.add(pet);
      this.group.add(assembly);
      return { k, assembly, pivot, blade, pet, mat, geo, U, set, q0: new THREE.Quaternion(), last: {}, Lcur: 0, roll: 1, ph: rr[6] * 50, exposure: rr[4] };
    }

    _removeLeaf(k, leaf) {
      this.group.remove(leaf.assembly);
      leaf.geo.dispose(); leaf.pet.geometry.dispose(); leaf.mat.dispose();
      this.leaves.delete(k);
    }

    _addAerial() {
      const r = PC.rng(this.seed + 9), mat = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.8 }), grp = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const a = r() * 6.28, top = new THREE.Vector3(0, 0.035, 0);
        const c = new THREE.CatmullRomCurve3([top, new THREE.Vector3(Math.sin(a) * 0.025, 0.03, Math.cos(a) * 0.025), new THREE.Vector3(Math.sin(a) * 0.045, 0.01, Math.cos(a) * 0.045), new THREE.Vector3(Math.sin(a) * 0.05, -0.01, Math.cos(a) * 0.05)]);
        const m = new THREE.Mesh(taperTube(c, 0.0024, 0.0016, 20), mat); m.castShadow = true; grp.add(m);
      }
      this.aerial = grp; this.group.add(grp);
    }

    _addAerialXL() {
      const r = PC.rng(this.seed + 19), mat = new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.85 }), grp = new THREE.Group();
      const H = this.g.stem;
      for (let i = 0; i < 6; i++) {
        const y0 = H * (0.2 + 0.12 * i + r() * 0.05), a = (r() - 0.5) * 2.4;
        const intoPole = i % 2 === 0;
        const pts = intoPole
          ? [[0, y0, 0.006], [Math.sin(a) * 0.02, y0 - 0.03, -0.01], [Math.sin(a) * 0.03, y0 - 0.09, -0.03], [0.0, y0 - 0.16, -0.04]]
          : [[0, y0, 0.006], [Math.sin(a) * 0.05, y0 - 0.05, 0.03], [Math.sin(a) * 0.1, y0 * 0.45, 0.05 + r() * 0.04], [Math.sin(a) * 0.13, -0.01, 0.05 + r() * 0.05]];
        const c = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)));
        const m = new THREE.Mesh(taperTube(c, 0.0048, 0.003, 30), mat); m.castShadow = true; grp.add(m);
      }
      this.aerial = grp; this.group.add(grp);
    }

    _grow(leaf, k, a, rank, N, dying) {
      const g = this.g, rr = this.leafRand[k];
      const sizeF = 1 - Math.exp(-(k + 1) / 6);
      const Lfull = PC.lerp(g.L[0], g.L[1], sizeF) * (0.9 + rr[0] * 0.2);
      const petFull = PC.lerp(g.petiole[0], g.petiole[1], sizeF) * (0.88 + rr[1] * 0.24);

      const pExt = PC.smooth(0, 4, a);
      const unf = PC.smooth(g.unfurl[0], g.unfurl[1], a);
      const expand = 0.32 + 0.68 * PC.smooth(1.5, 10, a);
      const harden = PC.smooth(5, 15, a);
      const rankF = PC.clamp(rank / Math.max(1, g.maxLeaves - 1), 0, 1);

      const L = Lfull * expand;
      const W = L * leaf.set.aspect * PC.lerp(0.7, 1, unf);
      const petLen = Math.max(0.01, petFull * (0.25 + 0.75 * pExt));
      const settle = PC.smooth(1, 8, a);
      let lean = PC.lerp(g.lean[0] * 0.4, PC.lerp(g.lean[0], g.lean[1], rankF) + (rr[2] - 0.5) * 0.25, settle);
      // young plants hold leaves more upright; pendant habits develop as leaves get bigger
      const habit = PC.lerp(0.45, 1, sizeF);
      let pitch = PC.lerp(1.35, PC.lerp(g.pitch[0], g.pitch[1], rankF) * habit + (rr[3] - 0.5) * 0.3, PC.smooth(1.5, 7, a));
      lean += dying * 0.35; pitch -= dying * 0.6;

      const az = this.facing + (((k * 0.381966 + rr[4] * 0.12) % 1) - 0.5) * g.spread * 2;
      const hdir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
      let ny = PC.clamp((k - (N - 8)) / 8, 0.15, 1);
      // climbing stems: each node is laid down at the growing tip and slowly slides down as the vine climbs
      if (g.climb) ny = 1 - 0.72 * PC.clamp(a / (((g.interval[0] + g.interval[1]) / 2) * (g.maxLeaves + 1)), 0, 1);
      const br = 0.005 * (g.stemR || 1);
      const base = new THREE.Vector3(Math.sin(az) * br, this.stemTop * ny, Math.cos(az) * br);
      const up = new THREE.Vector3(0, 1, 0);
      const tip = base.clone().addScaledVector(up, petLen * Math.cos(lean)).addScaledVector(hdir, petLen * Math.sin(lean));
      const ctrl = base.clone().addScaledVector(up, petLen * 0.62).addScaledVector(hdir, petLen * Math.sin(lean) * 0.12);
      const last = leaf.last, changed = (x, y) => Math.abs((x || 0) - (y || 0)) > 0.0004;
      if (changed(last.petLen, petLen) || changed(last.lean, lean) || last.az !== az || changed(last.by, base.y)) {
        leaf.pet.geometry.dispose();
        const rBase = g.petR * (0.45 + 0.55 * sizeF);
        leaf.pet.geometry = taperTube(new THREE.QuadraticBezierCurve3(base, ctrl, tip), rBase, rBase * 0.75, 14);
        last.petLen = petLen; last.lean = lean; last.az = az; last.by = base.y;
      }
      leaf.pivot.position.copy(tip);
      // hanging leaves can't pass through the tray: they only drop below it once past the front edge
      if (pitch < 0 && !this.outside) {
        const front = PC.DIM.trayZ + PC.DIM.trayD / 2;
        const over = this.group.position.z + tip.z > front + 0.012;
        const room = tip.y + (over ? 0.06 : -0.008);
        const lim = room <= 0 ? 0 : -Math.asin(Math.min(1, room / Math.max(L, 1e-3)));
        pitch = Math.max(pitch, lim);
      }

      const Y = hdir.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
      const X = new THREE.Vector3().crossVectors(Y, up).normalize();
      const Z = new THREE.Vector3().crossVectors(X, Y);
      leaf.q0.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      leaf.q0.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rr[2] - 0.5) * 0.35));

      const roll = 1 - unf;
      const P = {
        L, W, back: leaf.set.back, roll,
        fold: g.fold * (1 + roll * 2), cup: g.cup, wave: g.wave || 0, wavePh: rr[0] * 6, corr: g.corr || 0,
        droop: g.droop * (0.3 + 0.7 * PC.smooth(3, 10, a)) * (0.6 + 0.4 * sizeF) + dying * 0.4
      };
      if (changed(last.L, L) || changed(last.roll, roll) || changed(last.droop, P.droop)) {
        shapeLeaf(leaf.geo, P, leaf.set);
        last.L = L; last.roll = roll; last.droop = P.droop;
      }
      leaf.Lcur = L; leaf.roll = roll;

      const y = g.young, c = leaf.mat.color;
      c.setRGB(PC.lerp(y[0], 1, harden), PC.lerp(y[1], 1, harden), PC.lerp(y[2], 1, harden));
      if (dying > 0) c.lerp(new THREE.Color(2.2, 1.9, 0.4), dying);
      leaf.mat.roughness = PC.lerp(Math.min(0.3, g.rough), g.rough, harden);
    }

    // slow, gentle movement from the fans
    animate(t, wind) {
      for (const leaf of this.leaves.values()) {
        const ph = leaf.ph, sizeF = Math.min(1.3, leaf.Lcur / 0.15), stiff = 1 - leaf.roll * 0.8;
        const w = wind * (0.65 + 0.35 * leaf.exposure);
        const gust = PC.noise3(t * 0.28 + ph, ph * 0.3, 0.5);
        leaf.assembly.rotation.x = w * (0.014 * Math.sin(t * 0.55 + ph) + 0.022 * gust);
        leaf.assembly.rotation.z = -w * (0.022 + 0.016 * Math.sin(t * 0.43 + ph * 1.3) + 0.016 * gust);
        _e.set(
          w * sizeF * stiff * (0.07 * Math.sin(t * 1.25 + ph) + 0.035 * Math.sin(t * 2.1 + ph * 2.1) + 0.08 * gust),
          w * stiff * 0.08 * Math.sin(t * 0.9 + ph),
          w * stiff * 0.05 * Math.sin(t * 1.1 + ph * 0.7));
        _q.setFromEuler(_e);
        leaf.pivot.quaternion.copy(leaf.q0).multiply(_q);
        leaf.U.uFlutter.value = w * stiff * (0.4 + Math.abs(gust) * 0.8);
      }
    }

    status() {
      const age = this.age, N = this.leafCount(age), g = this.g;
      const a = age - this.emerge[N - 1];
      let stage, pct;
      if (a < 2) { stage = 'Emerging'; pct = a / 2; }
      else if (a < g.unfurl[1]) { stage = 'Unfurling'; pct = PC.smooth(g.unfurl[0], g.unfurl[1], a); }
      else if (a < 10) { stage = 'Expanding'; pct = (a - g.unfurl[1]) / (10 - g.unfurl[1]); }
      else if (a < 15) { stage = 'Hardening off'; pct = (a - 10) / 5; }
      else { stage = 'Mature'; pct = 1; }
      return { name: this.name, leaves: Math.min(N, g.maxLeaves), stage, pct, next: this.emerge[N] - age, leafNo: N, age };
    }
  }
  const _e = new THREE.Euler(), _q = new THREE.Quaternion();
  PC.Plant = Plant;

  // ---- layout: four plants per shelf, small starts ----------------------------
  PC.buildPlants = function (scene) {
    const D = PC.DIM, top = (s) => D.shelves[s] + D.trayH - 0.004, z = D.trayZ;
    const defs = [
      // shelf 0 (above the tank)
      ['bulbasaur', 0, -0.32, z - 0.03, 11, 4, 0.25],
      ['billietiae', 0, -0.11, z - 0.06, 23, 0, 0.1],
      ['tigerMint', 0, 0.11, z - 0.02, 17, -3, -0.1],
      ['billietiae', 0, 0.32, z - 0.06, 29, 6, -0.25],
      // shelf 1
      ['dragonScale', 1, -0.32, z - 0.02, 31, 3, 0.2],
      ['blackVelvetPink', 1, -0.11, z + 0.02, 37, 0, 0.1],
      ['peachLatte', 1, 0.11, z - 0.03, 41, -2, -0.1],
      ['dragonScale', 1, 0.32, z + 0.01, 43, -6, -0.2],
      // shelf 2 (top): pendant anthuriums near the front edge
      ['veitchii', 2, -0.31, z + 0.07, 53, 2, 0.15],
      ['warocqueanum', 2, -0.1, z + 0.08, 59, 0, 0.05],
      ['veitchii', 2, 0.11, z + 0.07, 61, -4, -0.05],
      ['warocqueanum', 2, 0.32, z + 0.08, 67, 5, -0.15]
    ];
    const plants = [];
    for (const [variety, s, x, zz, seed, ageOff, facing] of defs) {
      const p = new Plant(variety, { position: new THREE.Vector3(x, top(s), zz), seed, ageOffset: ageOff, facing });
      p.shelf = s;
      scene.add(p.group); plants.push(p);
    }
    return plants;
  };
})(window.PC);

/* Two large floor plants beside the cabinet, each in a ceramic planter under its own wall spotlight */
(function (PC) {
  'use strict';
  const T = PC.Tex;

  function speckleTex() {
    const S = 512, c = T.canvas(S), x = c.getContext('2d'), r = PC.rng(91);
    x.fillStyle = '#d8d2c7'; x.fillRect(0, 0, S, S);
    const img = x.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < S * S; i++) { const n = (Math.random() - 0.5) * 10 + PC.noise3((i % S) / 60, Math.floor(i / S) / 60, 1.3) * 10; d[i * 4] += n; d[i * 4 + 1] += n; d[i * 4 + 2] += n; }
    x.putImageData(img, 0, 0);
    for (let i = 0; i < 2600; i++) {
      const v = r(); x.fillStyle = v < 0.7 ? 'rgba(40,36,32,0.75)' : v < 0.9 ? 'rgba(120,96,70,0.6)' : 'rgba(250,248,240,0.9)';
      x.beginPath(); x.arc(r() * S, r() * S, 0.5 + r() * 1.6, 0, 6.283); x.fill();
    }
    return T.tex(c, true, true);
  }
  function aroidMixTex() {
    const S = 512, c = T.canvas(S), x = c.getContext('2d'), r = PC.rng(92);
    x.fillStyle = '#20150e'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 1400; i++) {            // orchid bark chunks
      const v = 40 + r() * 60; x.fillStyle = `rgb(${v * 1.5},${v * 0.95},${v * 0.6})`;
      x.save(); x.translate(r() * S, r() * S); x.rotate(r() * 6.28);
      x.fillRect(-6 - r() * 10, -3 - r() * 4, 12 + r() * 20, 6 + r() * 8); x.restore();
    }
    for (let i = 0; i < 700; i++) {             // perlite
      const v = 210 + r() * 40; x.fillStyle = `rgb(${v},${v},${v - 6})`;
      x.beginPath(); x.arc(r() * S, r() * S, 2 + r() * 4, 0, 6.283); x.fill();
    }
    for (let i = 0; i < 400; i++) {             // charcoal and coir
      x.fillStyle = r() < 0.5 ? '#0c0c0c' : '#5b3a22';
      x.beginPath(); x.arc(r() * S, r() * S, 1.5 + r() * 3, 0, 6.283); x.fill();
    }
    return T.tex(c, true, true);
  }
  function mossTex() {
    const W = 256, H = 1024, c = T.canvas(W, H), x = c.getContext('2d'), r = PC.rng(93);
    x.fillStyle = '#3d3423'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      const g = r(); x.strokeStyle = g < 0.55 ? `rgba(${120 + r() * 50},${100 + r() * 40},${60 + r() * 20},0.7)` : g < 0.85 ? `rgba(${70 + r() * 30},${95 + r() * 40},${40 + r() * 20},0.7)` : 'rgba(25,20,14,0.8)';
      x.lineWidth = 0.6 + r() * 1.4; const px = r() * W, py = r() * H, a = r() * 6.28, l = 4 + r() * 10;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 1) * l * 0.5, py + Math.sin(a + 1) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    return T.tex(c, true, true);
  }

  // soft additive cone for a visible light beam
  function beamMaterial(color) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uI; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float along = vUv.y; float edge = pow(abs(dot(vN, vV)), 1.6);
          float a = edge * smoothstep(0.0, 0.12, 1.0 - along) * pow(along, 1.3) * 0.11 * uI;
          gl_FragColor = vec4(uColor * a, a); }`
    });
  }

  PC.buildFloorPlants = function (scene) {
    const potMat = new THREE.MeshStandardMaterial({ map: speckleTex(), roughness: 0.62, metalness: 0 });
    potMat.map.repeat.set(3, 1);
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x3a3631, roughness: 0.9 });
    const soilMat = new THREE.MeshStandardMaterial({ map: aroidMixTex(), roughness: 0.95 });
    const out = { plants: [], lights: [], beams: [], lenses: [] };
    const POT_H = 0.36, R_TOP = 0.2, R_BOT = 0.16, SOIL_Y = 0.335;

    function pot(x, z) {
      const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      const prof = [[0.0, 0.0], [R_BOT - 0.01, 0], [R_BOT, 0.008], [R_TOP - 0.004, POT_H - 0.012], [R_TOP, POT_H - 0.004], [R_TOP - 0.008, POT_H], [R_TOP - 0.016, POT_H - 0.006]];
      const outer = new THREE.Mesh(new THREE.LatheGeometry(prof.map((q) => new THREE.Vector2(q[0], q[1])), 96), potMat);
      outer.castShadow = true; outer.receiveShadow = true; g.add(outer);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(R_TOP - 0.016, R_TOP - 0.03, 0.06, 64, 1, true), innerMat);
      inner.material.side = THREE.BackSide; inner.position.y = POT_H - 0.03; g.add(inner);
      const soil = new THREE.Mesh(new THREE.CircleGeometry(R_TOP - 0.016, 64), soilMat);
      soil.rotation.x = -Math.PI / 2; soil.position.y = SOIL_Y; soil.receiveShadow = true; g.add(soil);
      // felt pads
      for (let i = 0; i < 3; i++) { const a = i * 2.094; PC.box(0.03, 0.006, 0.03, innerMat, Math.cos(a) * 0.11, -0.003, Math.sin(a) * 0.11, g); }
      g.position.y = 0.006;
      return g;
    }

    function lamp(x, target, warm) {
      const black = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.35, metalness: 0.6 });
      const head = new THREE.Vector3(x * 0.92, 2.2, 0.16), wallP = new THREE.Vector3(x * 0.92, 2.22, -0.298);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 32), black);
      plate.rotation.x = Math.PI / 2; plate.position.copy(wallP); scene.add(plate);
      const armC = new THREE.LineCurve3(wallP.clone().add(new THREE.Vector3(0, 0, 0.005)), head.clone().add(new THREE.Vector3(0, 0.04, -0.02)));
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(armC, 4, 0.006, 10, false), black));
      const dir = target.clone().sub(head).normalize();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.13, 40, 1, true), black);
      body.material = black.clone(); body.material.side = THREE.DoubleSide;
      body.position.copy(head).addScaledVector(dir, -0.04);
      body.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); scene.add(body);
      const back = new THREE.Mesh(new THREE.CircleGeometry(0.032, 32), black);
      back.position.copy(head).addScaledVector(dir, -0.105); back.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate()); scene.add(back);
      const lensM = new THREE.MeshBasicMaterial({ color: 0xfff3dc, toneMapped: false });
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 32), lensM);
      lens.position.copy(head).addScaledVector(dir, 0.022); lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); scene.add(lens);
      const sp = new THREE.SpotLight(warm, 0, 4.2, 0.36, 0.6, 1.0);
      sp.position.copy(head); sp.target.position.copy(target); scene.add(sp); scene.add(sp.target);
      sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.camera.near = 0.3; sp.shadow.camera.far = 3.6;
      sp.shadow.bias = -0.0005; sp.shadow.normalBias = 0.02; sp.shadow.radius = 5;
      // visible beam
      const len = head.distanceTo(target) * 1.25, rad = Math.tan(0.36) * len;
      const cone = new THREE.CylinderGeometry(rad, 0.03, len, 48, 1, true);
      cone.translate(0, -len / 2, 0);
      const bm = beamMaterial(warm), beam = new THREE.Mesh(cone, bm);
      beam.position.copy(head).addScaledVector(dir, 0.022); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      beam.renderOrder = 40; scene.add(beam);
      out.lights.push({ light: sp, base: 2.6, warm: new THREE.Color(warm) });
      out.beams.push(bm); out.lenses.push(lensM);
    }

    // left: marbled monstera climbing a moss pole
    {
      const x = -1.22, z = 0.02, g = pot(x, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 1.0, 40, 8), new THREE.MeshStandardMaterial({ map: mossTex(), roughness: 1 }));
      pole.material.map.repeat.set(2, 3);
      pole.position.set(0, SOIL_Y + 0.42, -0.05); pole.castShadow = true; pole.receiveShadow = true; g.add(pole);
      const tie = new THREE.MeshStandardMaterial({ color: 0x8a6e45, roughness: 0.9 });
      for (const h of [0.25, 0.5, 0.72]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0018, 6, 32), tie); t.rotation.x = Math.PI / 2; t.scale.set(1, 1.5, 1); t.position.set(0, SOIL_Y + h, -0.03); g.add(t); }
      const p = new PC.Plant('marbleMonstera', { position: new THREE.Vector3(x, SOIL_Y + 0.006, z), seed: 301, ageOffset: 420, facing: -0.3 });
      p.outside = true; p.shelf = null; p.view = 'floorL'; scene.add(p.group); out.plants.push(p);
      lamp(x, new THREE.Vector3(x, 1.0, 0.08), 0xfff0d8);
    }
    // right: large Black Velvet pink alocasia
    {
      const x = 1.3, z = 0.04;
      pot(x, z);
      const p = new PC.Plant('blackVelvetXL', { position: new THREE.Vector3(x, SOIL_Y + 0.006, z), seed: 409, ageOffset: 420, facing: -0.05 });
      p.outside = true; p.shelf = null; p.view = 'floorR'; scene.add(p.group); out.plants.push(p);
      lamp(x, new THREE.Vector3(x, 0.95, 0.1), 0xfff0d8);
    }
    return out;
  };
})(window.PC);
