// Alocasia growth engine with photo-sourced leaves.
// Each leaf emerges as a rolled spike, unfurls, expands, hardens off from its new-leaf tint,
// and the oldest leaf yellows and drops once the plant carries its maximum.
import * as THREE from 'three';

export const DAY = 86400000;
export const EPOCH = new Date(2026, 9, 30, 0, 0, 0).getTime();
export const START_AGE = 46;

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const VARIETIES = {
  dragonScale: {
    label: "Alocasia 'Dragon Scale Mint'", short: 'Dragon Scale Mint',
    tex: ['ds_h', 'ds_hc'], interval: [9, 13], maxLeaves: 5,
    L: [0.08, 0.17], petiole: [0.08, 0.19], petR: 0.0028,
    lean: [0.1, 0.5], pitch: [-0.15, -0.7], droop: 0.05, fold: 0.02, cup: 0.03, lobe: 0.16, wave: 0.0, twist: 0.06,
    mat: { roughness: 0.42, clearcoat: 0.15, clearcoatRoughness: 0.35, normalScale: 0.35, env: 0.4 },
    transl: 0.55, petColor: 0xa9b98a, sheathColor: 0x9fae84, young: [1.06, 1.1, 0.96]
  },
  blackVelvetPink: {
    label: "Alocasia 'Black Velvet' pink variegata", short: 'Black Velvet Pink',
    tex: ['bvp_a', 'bvp_c'], interval: [11, 15], maxLeaves: 5,
    L: [0.075, 0.16], petiole: [0.075, 0.18], petR: 0.0025,
    lean: [0.12, 0.55], pitch: [-0.25, -0.8], droop: 0.06, fold: 0.015, cup: -0.02, lobe: 0.12, wave: 0.3, twist: 0.07,
    mat: { roughness: 0.74, sheen: 0.35, sheenRoughness: 0.5, sheenColor: 0x8a7f86, normalScale: 0.4, env: 0.3 },
    transl: 0.7, petColor: 0xb8c3a0, sheathColor: 0xa9b291, young: [1.08, 1.0, 1.04]
  }
};

// ---------------------------------------------------------------------------
// textures
const loader = new THREE.TextureLoader();
const texCache = {};
export async function loadLeafTextures(base, renderer) {
  const metas = await (await fetch(base + 'leaves.json')).json();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const load = (url, srgb) => new Promise((res, rej) => loader.load(url, (t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso; res(t);
  }, undefined, rej));
  await Promise.all(metas.map(async (m) => {
    const [map, alphaMap, normalMap] = await Promise.all([
      load(`${base}${m.name}_c.jpg`, true),
      load(`${base}${m.alphaOf || m.name}_a.png`, false),
      load(`${base}${m.normalOf || m.name}_n.jpg`, false)
    ]);
    texCache[m.name] = { map, alphaMap, normalMap, meta: m };
  }));
  return texCache;
}

// ---------------------------------------------------------------------------
// leaf geometry in texture space: junction (petiole attachment) at origin, tip at Y = 1
const STRETCH = { bvp_a: 1.28, bvp_c: 1.2 };   // undo the foreshortening of leaves photographed at an angle
function leafGeometry(meta, flip, NX = 22, NY = 30) {
  const xs = STRETCH[meta.name] || 1;
  const pad = 0.012;
  const u0 = meta.xmin - pad, u1 = meta.xmax + pad, v0 = meta.ymin - pad, v1 = meta.ymax + pad;
  const K = 1 / (meta.tv - meta.jv);
  const n = (NX + 1) * (NY + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), base = new Float32Array(n * 2), idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const k = j * (NX + 1) + i, u = lerp(u0, u1, i / NX), v = lerp(v0, v1, j / NY);
    uv[k * 2] = u; uv[k * 2 + 1] = v;
    base[k * 2] = (u - 0.5) * K * xs * (flip ? -1 : 1); base[k * 2 + 1] = (v - meta.jv) * K;
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    if (flip) idx.push(a, d, b, a, c, d); else idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData = { base, hw: (u1 - u0) * 0.5 * K * xs, K };
  return g;
}

function shapeLeaf(geo, P) {
  const { base, hw } = geo.userData, pos = geo.attributes.position, n = pos.count;
  const R = P.roll > 0.002 ? hw / (P.roll * Math.PI * 1.1) : 0;
  for (let k = 0; k < n; k++) {
    const X = base[k * 2], Y = base[k * 2 + 1], s = Math.abs(X), sg = Math.sign(X) || 1;
    let x = X, z = 0;
    if (R) { const a = s / R; x = sg * R * Math.sin(a); z = R * (1 - Math.cos(a)); }
    z += P.fold * s + P.cup * s * s / hw;
    if (P.wave) z += P.wave * 0.03 * Math.sin(Y * 14 + P.wavePh + sg * 1.3) * Math.pow(s / hw, 2) * (1 - P.roll);
    z += P.ripple * Math.sin(X * 6.5 + P.wavePh) * Math.sin(Y * 4.2 + P.wavePh * 1.7) * Math.min(1, s / (hw * 0.25));
    if (Y > 0) z -= P.droop * Y * Y;
    else z -= P.lobe * Y * Y;                       // basal lobes curl back and down
    let y = Y * (1 - 0.08 * P.droop * Y * Y);
    // gentle twist along the blade
    const tw = P.twist * Y, c = Math.cos(tw), si = Math.sin(tw);
    const xr = x * c - z * si, zr = x * si + z * c;
    pos.setXYZ(k, xr * P.L, y * P.L, zr * P.L);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

// physical leaf material: velvet sheen or waxy clearcoat, light passing through, paler underside, slow flutter
const sharedU = { uTime: { value: 0 }, uLight: { value: 1 }, uLightDir: { value: new THREE.Vector3(0, 1, 0) } };
export const leafUniforms = sharedU;
function leafMaterial(v, tex) {
  const m = new THREE.MeshPhysicalMaterial({
    map: tex.map, alphaMap: tex.alphaMap, normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(v.mat.normalScale, v.mat.normalScale),
    alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide,
    roughness: v.mat.roughness, metalness: 0, envMapIntensity: v.mat.env,
    clearcoat: v.mat.clearcoat || 0, clearcoatRoughness: v.mat.clearcoatRoughness || 0,
    sheen: v.mat.sheen || 0, sheenRoughness: v.mat.sheenRoughness || 0.5, sheenColor: new THREE.Color(v.mat.sheenColor || 0xffffff)
  });
  const U = { uFlutter: { value: 0 }, uPhase: { value: Math.random() * 40 }, uTransl: { value: v.transl } };
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, sharedU, U);
    sh.vertexShader = 'uniform float uTime; uniform float uFlutter; uniform float uPhase;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float edgeF = abs(uv.x - 0.5) * 2.0;
      transformed.z += sin(uTime * 1.9 + uPhase + uv.y * 4.0 + edgeF * 2.0) * uFlutter * 0.0012 * (edgeF * edgeF + uv.y * 0.5);`);
    sh.fragmentShader = 'uniform float uTransl; uniform float uLight; uniform vec3 uLightDir;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        { float l0 = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = max(mix(vec3(l0), diffuseColor.rgb, 1.3), 0.0); }
        if (!gl_FrontFacing) {
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(0.96, 1.02, 0.9), 0.3) * 1.12;
        }`)
      .replace('#include <opaque_fragment>', `
        vec3 Lv = normalize((viewMatrix * vec4(uLightDir, 0.0)).xyz);
        float tr = max(dot(-normal, Lv), 0.0);
        outgoingLight += diffuseColor.rgb * diffuseColor.rgb * tr * tr * uTransl * uLight * 0.35;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'photoleaf-' + (v.mat.sheen ? 'velvet' : 'wax');
  return m;
}

function taperTube(curve, r0, r1, segs, radial = 8) {
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = geo.attributes.position, pt = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, pt);
    const t = i / segs, r = lerp(r0, r1, Math.pow(t, 0.6));
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; q.fromBufferAttribute(p, k).sub(pt).multiplyScalar(r).add(pt); p.setXYZ(k, q.x, q.y, q.z); }
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
export class Plant {
  constructor(variety, opts) {
    this.variety = variety; this.v = VARIETIES[variety];
    this.seed = opts.seed; this.ageOffset = opts.ageOffset || 0; this.facing = opts.facing || 0;
    this.name = opts.name || this.v.short;
    this.group = new THREE.Group(); this.group.position.copy(opts.position);
    this.leaves = new Map();
    const r = rng(this.seed);
    this.emerge = [0];
    for (let k = 1; k < 400; k++) this.emerge.push(this.emerge[k - 1] + lerp(this.v.interval[0], this.v.interval[1], r()));
    this.R = []; for (let k = 0; k < 400; k++) this.R.push([r(), r(), r(), r(), r(), r(), r(), r()]);
    this.petMat = new THREE.MeshPhysicalMaterial({ color: this.v.petColor, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.5 });
    this.sheathMat = new THREE.MeshPhysicalMaterial({ color: this.v.sheathColor, roughness: 0.55, transmission: 0, envMapIntensity: 0.5 });
    // net pot rim and pseudostem
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.0026, 8, 40), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.55 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.002; rim.castShadow = true; this.group.add(rim);
    this.stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.009, 1, 16), this.sheathMat);
    this.stem.castShadow = true; this.group.add(this.stem);
    this.age = -1;
  }

  leafCount(age) { let n = 0; while (n < this.emerge.length && this.emerge[n] <= age) n++; return n; }

  update(simAge, textures) {
    const age = Math.max(0.5, simAge + this.ageOffset);
    if (Math.abs(age - this.age) < 1e-5) return;
    this.age = age;
    const v = this.v, N = this.leafCount(age);
    const stemH = Math.min(0.022, 0.006 + age * 0.00025);
    this.stem.scale.set(1, stemH, 1); this.stem.position.y = stemH / 2 - 0.003;
    this.stemTop = stemH - 0.004;
    const alive = new Set();
    for (let k = Math.max(0, N - v.maxLeaves - 1); k < N; k++) {
      const a = age - this.emerge[k], rank = N - 1 - k;
      let dying = 0;
      if (rank >= v.maxLeaves) { const d = age - this.emerge[k + v.maxLeaves]; if (d > 8) continue; dying = smooth(0, 6, d); }
      alive.add(k);
      let leaf = this.leaves.get(k);
      if (!leaf) { leaf = this._makeLeaf(k, textures); this.leaves.set(k, leaf); }
      this._grow(leaf, k, a, rank, N, dying);
    }
    for (const [k, leaf] of this.leaves) if (!alive.has(k)) {
      this.group.remove(leaf.assembly); leaf.geo.dispose(); leaf.pet.geometry.dispose(); leaf.mat.dispose(); this.leaves.delete(k);
    }
  }

  _makeLeaf(k, textures) {
    const rr = this.R[k], v = this.v;
    const texName = v.tex[Math.floor(rr[5] * v.tex.length)], tex = textures[texName];
    const flip = rr[6] < 0.5;
    const mat = leafMaterial(v, tex);
    // a little natural variation leaf to leaf
    const hj = (rr[7] - 0.5) * 0.06;
    mat.userData.tint = new THREE.Color(0.93 + hj, 0.93 - hj * 0.4, 0.93 - hj);
    const geo = leafGeometry(tex.meta, flip);
    const blade = new THREE.Mesh(geo, mat);
    blade.castShadow = true; blade.receiveShadow = true;
    blade.userData.leafOf = this;
    const pivot = new THREE.Group(); pivot.add(blade);
    const assembly = new THREE.Group(); assembly.add(pivot);
    const pet = new THREE.Mesh(new THREE.BufferGeometry(), this.petMat);
    pet.castShadow = true; pet.receiveShadow = true; assembly.add(pet);
    this.group.add(assembly);
    return { k, assembly, pivot, blade, pet, mat, geo, U: mat.userData.U, q0: new THREE.Quaternion(), last: {}, Lcur: 0, roll: 1, ph: rr[6] * 40, exposure: rr[4] };
  }

  _grow(leaf, k, a, rank, N, dying) {
    const v = this.v, rr = this.R[k];
    const sizeF = 1 - Math.exp(-(k + 1) / 5);
    const Lfull = lerp(v.L[0], v.L[1], sizeF) * (0.9 + rr[0] * 0.2);
    const petFull = lerp(v.petiole[0], v.petiole[1], sizeF) * (0.88 + rr[1] * 0.24);
    const pExt = smooth(0, 4, a), unf = smooth(2.2, 6.5, a), expand = 0.3 + 0.7 * smooth(1.5, 10, a), harden = smooth(5, 15, a);
    const rankF = clamp(rank / Math.max(1, v.maxLeaves - 1), 0, 1);
    const L = Lfull * expand;
    const petLen = Math.max(0.01, petFull * (0.25 + 0.75 * pExt));
    const settle = smooth(1, 8, a);
    let lean = lerp(v.lean[0] * 0.3, lerp(v.lean[0], v.lean[1], rankF) + (rr[2] - 0.5) * 0.22, settle);
    let pitch = lerp(1.4, lerp(v.pitch[0], v.pitch[1], rankF) + (rr[3] - 0.5) * 0.3, smooth(1.5, 7, a));
    lean += dying * 0.4; pitch -= dying * 0.7;
    const az = this.facing + (((k * 0.381966 + rr[4] * 0.1) % 1) - 0.5) * 2.5;   // fan toward the front
    const hdir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    const up = new THREE.Vector3(0, 1, 0);
    const base = new THREE.Vector3(Math.sin(az) * 0.004, this.stemTop * clamp(0.4 + 0.6 * (k - (N - 6)) / 6, 0.3, 1), Math.cos(az) * 0.004);
    const tip = base.clone().addScaledVector(up, petLen * Math.cos(lean)).addScaledVector(hdir, petLen * Math.sin(lean));
    const ctrl = base.clone().addScaledVector(up, petLen * 0.6).addScaledVector(hdir, petLen * Math.sin(lean) * 0.15);
    const last = leaf.last, changed = (x, y) => Math.abs((x || 0) - (y || 0)) > 0.0003;
    if (changed(last.petLen, petLen) || changed(last.lean, lean) || last.az !== az || changed(last.by, base.y)) {
      leaf.pet.geometry.dispose();
      const rB = v.petR * (0.5 + 0.5 * sizeF);
      leaf.pet.geometry = taperTube(new THREE.QuadraticBezierCurve3(base, ctrl, tip), rB * 1.9, rB * 0.75, 20);
      last.petLen = petLen; last.lean = lean; last.az = az; last.by = base.y;
    }
    // the petiole meets the underside of the blade, a hair below the surface
    leaf.pivot.position.copy(tip);
    // blades hang tip-down toward the viewer; keep the tip clear of the tray
    const lim = -Math.asin(clamp((tip.y - 0.012) / Math.max(L, 1e-3), 0, 1));
    pitch = Math.max(pitch, lim);
    const Y = hdir.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    const X = new THREE.Vector3().crossVectors(Y, up).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    leaf.q0.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    leaf.q0.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rr[2] - 0.5) * 0.4));
    leaf.blade.position.set(0, 0, 0.0012);
    const roll = 1 - unf;
    const P = {
      L, roll, ripple: 0.012 * (1 - roll), fold: v.fold * (1 + roll * 2), cup: v.cup * (0.4 + 0.6 * unf), lobe: v.lobe, wave: v.wave, wavePh: rr[0] * 6,
      twist: (rr[1] - 0.5) * 2 * v.twist, droop: v.droop * (0.3 + 0.7 * smooth(3, 10, a)) + dying * 0.35
    };
    if (changed(last.L, L) || changed(last.roll, roll) || changed(last.droop, P.droop)) {
      shapeLeaf(leaf.geo, P);
      last.L = L; last.roll = roll; last.droop = P.droop;
    }
    leaf.Lcur = L; leaf.roll = roll;
    const y = v.young, c = leaf.mat.color, t = leaf.mat.userData.tint;
    c.setRGB(lerp(y[0], 1, harden) * t.r, lerp(y[1], 1, harden) * t.g, lerp(y[2], 1, harden) * t.b);
    if (dying > 0) c.lerp(new THREE.Color(1.5, 1.25, 0.35), dying);
  }

  animate(t, wind) {
    for (const leaf of this.leaves.values()) {
      const ph = leaf.ph, sizeF = Math.min(1.3, leaf.Lcur / 0.09), stiff = 1 - leaf.roll * 0.8;
      const w = wind * (0.65 + 0.35 * leaf.exposure);
      const gust = Math.sin(t * 0.31 + ph) * 0.6 + Math.sin(t * 0.53 + ph * 1.7) * 0.4;
      leaf.assembly.rotation.x = w * (0.012 * Math.sin(t * 0.5 + ph) + 0.014 * gust);
      leaf.assembly.rotation.z = -w * (0.016 + 0.012 * Math.sin(t * 0.41 + ph * 1.3) + 0.01 * gust);
      _e.set(w * sizeF * stiff * (0.06 * Math.sin(t * 1.1 + ph) + 0.03 * Math.sin(t * 1.9 + ph * 2.1) + 0.05 * gust),
        w * stiff * 0.06 * Math.sin(t * 0.8 + ph), w * stiff * 0.04 * Math.sin(t * 1.0 + ph * 0.7));
      _q.setFromEuler(_e);
      leaf.pivot.quaternion.copy(leaf.q0).multiply(_q);
      leaf.U.uFlutter.value = w * stiff * (0.4 + Math.abs(gust) * 0.6);
    }
  }

  status() {
    const age = this.age, N = this.leafCount(age), a = age - this.emerge[N - 1];
    let stage, pct;
    if (a < 2) { stage = 'Emerging'; pct = a / 2; }
    else if (a < 6.5) { stage = 'Unfurling'; pct = smooth(2.2, 6.5, a); }
    else if (a < 10) { stage = 'Expanding'; pct = (a - 6.5) / 3.5; }
    else if (a < 15) { stage = 'Hardening off'; pct = (a - 10) / 5; }
    else { stage = 'Mature'; pct = 1; }
    return { name: this.name, leaves: Math.min(N, this.v.maxLeaves), stage, pct, next: this.emerge[N] - age, leafNo: N };
  }
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
