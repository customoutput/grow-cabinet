/* Core helpers: namespace, seeded random, noise, math, dimensions, clock */
window.PC = window.PC || {};
(function (PC) {
  'use strict';

  PC.DAY = 86400000;
  // Day 0 of the cabinet's life on this site. Plants are already established
  // (START_AGE days old) on this date, then keep growing in real time.
  PC.EPOCH = new Date(2026, 9, 27, 0, 0, 0).getTime();
  PC.START_AGE = 30;

  PC.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  PC.lerp = (a, b, t) => a + (b - a) * t;
  PC.smooth = (e0, e1, x) => {
    const t = PC.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // mulberry32
  PC.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  PC.hashStr = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // ---- value noise -------------------------------------------------------
  const PERM = new Uint8Array(512);
  (function () {
    const r = PC.rng(1337), p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  })();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function grad3(h, x, y, z) {
    const u = (h & 15) < 8 ? x : y;
    const v = (h & 15) < 4 ? y : ((h & 15) === 12 || (h & 15) === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  // Perlin 3D, range about -1..1
  PC.noise3 = function (x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z;
    const B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
    const L = PC.lerp;
    return L(
      L(L(grad3(PERM[AA], x, y, z), grad3(PERM[BA], x - 1, y, z), u),
        L(grad3(PERM[AB], x, y - 1, z), grad3(PERM[BB], x - 1, y - 1, z), u), v),
      L(L(grad3(PERM[AA + 1], x, y, z - 1), grad3(PERM[BA + 1], x - 1, y, z - 1), u),
        L(grad3(PERM[AB + 1], x, y - 1, z - 1), grad3(PERM[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  };
  PC.noise1 = (x) => PC.noise3(x, 0.37, 0.71);
  PC.fbm3 = function (x, y, z, oct) {
    let a = 0.5, f = 1, s = 0;
    for (let i = 0; i < (oct || 4); i++) { s += a * PC.noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
    return s;
  };

  // ---- cabinet layout (meters) ------------------------------------------
  PC.DIM = {
    W: 1.04, D: 0.48, H: 2.02,
    inW: 1.0, inD: 0.44,
    plinth: 0.08,
    tank: { w: 0.9, h: 0.4, d: 0.38, y0: 0.085, glass: 0.006, water: 0.465 },
    shelves: [0.62, 1.08, 1.54],   // glass shelf surfaces
    ceiling: 1.985,
    trayH: 0.07, trayW: 0.86, trayD: 0.3, trayZ: -0.03
  };

  // ---- tiny THREE helpers ------------------------------------------------
  PC.box = function (w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(m);
    return m;
  };
  PC.shared = { time: { value: 0 }, caustic: { value: 1 }, plantLight: { value: 1 } };
})(window.PC);
