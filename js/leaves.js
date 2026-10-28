/* Variegated leaf textures. Every variety gets its own outline, vein layout, surface relief
   and colour pattern; each texture variant is a different leaf, so no two leaves on a plant match. */
(function (PC) {
  'use strict';
  const T = PC.Tex;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sm = PC.smooth, N3 = PC.noise3;
  const fbm = (x, y, o, oct) => { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * N3(x * f, y * f, o + i * 3.1); f *= 2.07; a *= 0.5; } return s; };

  // ---- outlines: right half as cubic beziers, X -1..1 across, Y -back..1 along the midrib ----
  const SHAPES = {
    monstera: { back: 0.2, curves: [[0.42, 1.0, 0.96, 0.78, 0.99, 0.36], [1.02, -0.02, 0.78, -0.2, 0.44, -0.2], [0.2, -0.19, 0.06, -0.06, 0, 0]] },
    billietiae: { back: 0.12, curves: [[0.2, 0.9, 0.62, 0.72, 0.8, 0.42], [0.93, 0.2, 1.0, 0.0, 0.72, -0.11], [0.45, -0.13, 0.12, -0.05, 0, 0]] },
    peltate: { back: 0.16, curves: [[0.28, 0.93, 0.95, 0.72, 1.0, 0.34], [1.03, 0.0, 0.82, -0.15, 0.42, -0.16], [0.2, -0.165, 0.06, -0.1, 0, -0.06]] },
    cordate: { back: 0.24, curves: [[0.36, 0.96, 0.98, 0.74, 1.0, 0.34], [1.02, -0.04, 0.82, -0.24, 0.46, -0.24], [0.2, -0.24, 0.05, -0.08, 0, 0]] },
    latte: { back: 0.15, curves: [[0.42, 1.0, 0.95, 0.7, 0.98, 0.3], [1.0, -0.02, 0.8, -0.15, 0.4, -0.15], [0.18, -0.155, 0.05, -0.1, 0, -0.05]] },
    veitchii: { back: 0.08, curves: [[0.15, 0.86, 0.7, 0.62, 0.92, 0.3], [1.04, 0.06, 0.86, -0.08, 0.5, -0.08], [0.24, -0.08, 0.06, -0.02, 0, 0]] },
    warocq: { back: 0.06, curves: [[0.12, 0.86, 0.62, 0.6, 0.86, 0.28], [1.02, 0.06, 0.86, -0.06, 0.5, -0.06], [0.22, -0.065, 0.05, -0.02, 0, 0]] }
  };

  // ---- variety specs ----
  const SPECS = {
    bulbasaur: {
      shape: 'monstera', aspect: 0.92, angle: 0.75, pattern: 'mint', base: ['#163d14', '#215019'],
      veins: { n: 7, start: 0.06, end: 0.86, rise: 0.17, w: 2.4, mid: 7, color: 'rgba(195,228,165,0.55)', midColor: 'rgba(210,235,180,0.9)' },
      relief: { depth: 105, strength: 1.6 }, fen: true, variants: 2, coverage: [-0.02, 0.1, -0.12, 0.05]
    },
    tigerMint: {
      shape: 'monstera', aspect: 0.92, angle: 0.75, pattern: 'mintWhite', base: ['#183f15', '#24531b'],
      veins: { n: 7, start: 0.06, end: 0.86, rise: 0.17, w: 2.4, mid: 7, color: 'rgba(205,230,180,0.55)', midColor: 'rgba(225,238,200,0.9)' },
      relief: { depth: 105, strength: 1.6 }, fen: true, variants: 2, coverage: [0.05, -0.05, 0.12, 0.0]
    },
    billietiae: {
      shape: 'billietiae', aspect: 0.33, angle: 0.5, pattern: 'sector', base: ['#1d4a18', '#2b5c20'],
      veins: { n: 13, start: 0.04, end: 0.93, rise: 0.11, w: 1.3, mid: 5, color: 'rgba(205,220,140,0.45)', midColor: 'rgba(232,230,170,0.95)' },
      relief: { depth: 112, strength: 1.3 }, variants: 6, coverage: [0.25, 0.1, 0.35, 0.2, 0.15, 0.3]
    },
    dragonScale: {
      shape: 'peltate', aspect: 0.74, angle: 0.95, pattern: 'mintSpeckle', base: ['#163617', '#285424'],
      veins: { n: 5, start: 0.12, end: 0.82, rise: 0.2, w: 3.2, mid: 6, color: 'rgba(28,62,30,0.85)', midColor: 'rgba(225,238,215,0.9)', basal: 2, radiate: true },
      relief: { depth: 40, strength: 3.4, scale: true }, variants: 6, coverage: [-0.28, 0.0, 0.18, 0.32, -0.1, 0.1]
    },
    marbleMonstera: {
      shape: 'monstera', aspect: 0.92, angle: 0.75, pattern: 'marble', base: ['#123a14', '#1f4c1b'], res: 896, minMat: 2,
      veins: { n: 8, start: 0.06, end: 0.86, rise: 0.16, w: 2.2, mid: 7, color: 'rgba(205,225,170,0.5)', midColor: 'rgba(222,236,196,0.9)' },
      relief: { depth: 105, strength: 1.6 }, fen: true, variants: 3, coverage: [0.12, 0.22, 0.05]
    },
    blackVelvetXL: {
      shape: 'cordate', aspect: 0.86, angle: 0.85, pattern: 'pink', base: ['#0f1a11', '#172419'], res: 896,
      veins: { n: 4, start: 0.16, end: 0.78, rise: 0.3, w: 3.2, mid: 6, color: 'rgba(218,230,212,0.9)', midColor: 'rgba(230,238,222,1)', glow: 4, basal: 2 },
      relief: { depth: 55, strength: 2.2, quilt: true }, variants: 6, coverage: [0.25, 0.05, 0.4, 0.15, 0.3, -0.05]
    },
    blackVelvetPink: {
      shape: 'cordate', aspect: 0.86, angle: 0.85, pattern: 'pink', base: ['#0f1a11', '#172419'],
      veins: { n: 4, start: 0.16, end: 0.78, rise: 0.3, w: 3.2, mid: 6, color: 'rgba(218,230,212,0.9)', midColor: 'rgba(230,238,222,1)', glow: 4, basal: 2 },
      relief: { depth: 55, strength: 2.2, quilt: true }, variants: 6, coverage: [0.25, 0.05, 0.4, 0.15, 0.3, -0.05]
    },
    peachLatte: {
      shape: 'latte', aspect: 0.7, angle: 0.95, pattern: 'latte', base: ['#3a472b', '#4b5436'],
      veins: { n: 5, start: 0.12, end: 0.82, rise: 0.2, w: 2.6, mid: 5, color: 'rgba(60,52,38,0.55)', midColor: 'rgba(210,175,150,0.7)', basal: 2, radiate: true },
      relief: { depth: 45, strength: 3.0, scale: true }, variants: 6, coverage: [-0.1, 0.05, 0.15, -0.2, 0.0, 0.1]
    },
    veitchii: {
      shape: 'veitchii', aspect: 0.3, angle: 0.62, pattern: 'plain', base: ['#2e5c24', '#3c6e2d'],
      veins: { n: 21, start: 0.02, end: 0.95, rise: 0.09, w: 1.6, mid: 5, color: 'rgba(170,205,125,0.55)', midColor: 'rgba(200,228,160,0.9)' },
      relief: { depth: 70, strength: 3.6, corr: 10.5 }, variants: 4, coverage: [0, 0, 0, 0]
    },
    warocqueanum: {
      shape: 'warocq', aspect: 0.27, angle: 0.55, pattern: 'velvet', base: ['#0f2817', '#17361e'],
      veins: { n: 9, start: 0.06, end: 0.9, rise: 0.16, w: 1.2, mid: 5, color: 'rgba(190,215,185,0.45)', midColor: 'rgba(222,236,216,1)', glow: 3, collective: true },
      relief: { depth: 60, strength: 2.0, quilt: true }, variants: 4, coverage: [0, 0, 0, 0]
    }
  };
  T.LEAF_SPECS = SPECS;

  function bez(p0, p1, p2, p3, t) { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; }
  function halfWidth(shape) {
    const Nb = 240, back = shape.back, tbl = new Float32Array(Nb + 1);
    let px = 0, py = 1;
    for (const c of shape.curves) {
      for (let i = 0; i <= 80; i++) {
        const t = i / 80, x = bez(px, c[0], c[2], c[4], t), y = bez(py, c[1], c[3], c[5], t);
        const b = Math.round(((y + back) / (1 + back)) * Nb);
        if (b >= 0 && b <= Nb) tbl[b] = Math.max(tbl[b], x);
      }
      px = c[4]; py = c[5];
    }
    for (let i = 1; i < Nb; i++) if (tbl[i] === 0 && tbl[i - 1] > 0) {
      let j = i; while (j < Nb && tbl[j] === 0) j++;
      for (let k = i; k < j; k++) tbl[k] = PC.lerp(tbl[i - 1], tbl[j], (k - i + 1) / (j - i + 1));
    }
    return (Y) => { const f = PC.clamp((Y + back) / (1 + back), 0, 1) * Nb, i = Math.floor(f); return PC.lerp(tbl[i], tbl[Math.min(Nb, i + 1)], f - i); };
  }

  // per-pixel colour pattern
  function patternColor(spec, v, x, y, X, Y) {
    const ax = Math.abs(x), side = X < 0 ? -1 : 1, ca = Math.cos(spec.angle), sa = Math.sin(spec.angle);
    const along = ax * ca + y * sa, across = y * ca - ax * sa, o = v.o, th = v.th;
    const b0 = hex(spec.base[0]), b1 = hex(spec.base[1]);
    let dark = mix(b0, b1, 0.5 + 0.5 * N3(x * 3 + o, y * 3, 0.3));
    switch (spec.pattern) {
      case 'mint': case 'mintWhite': {
        const n = 0.6 * fbm(across * 13 + o, along * 3.2 + o, 1.7, 3) + 0.45 * N3(across * 4 + o, along * 1.5, 4.4) + 0.25 * N3(x * 30, y * 9 + o, 8.8);
        let m = sm(th - 0.05, th + 0.05, n);
        const med = sm(th - 0.28, th - 0.05, n);
        const sp = N3(x * 75 + o, y * 75, 9.1);
        const sp2 = N3(x * 140 + o, y * 140, 3.3);
        if (m > 0.5 && (sp > 0.4 || sp2 > 0.5)) m = 0.12; else if (m < 0.5 && (sp < -0.42 || sp2 < -0.48)) m = 0.85;
        const mintC = mix(hex('#a6cf83'), hex('#d3e8b2'), 0.5 + 0.5 * N3(x * 6 + o, y * 6, 2.2));
        let c = mix(dark, hex('#4f8a3a'), med * 0.55);
        c = mix(c, mintC, m);
        if (spec.pattern === 'mintWhite') {
          const w = sm(0.18, 0.34, N3(across * 1.6 + o * 2, along * 0.6 + side * 3.7, 6.6) + 0.15 * fbm(across * 12, along * 3 + o, 2.1, 2));
          const wf = sm(0.18, 0.3, fbm(across * 9, along * 3 + o, 7.7, 2) + w * 0.5);
          c = mix(c, hex('#eceedd'), Math.max(w * 0.95, wf * 0.6 * w));
        }
        return c;
      }
      case 'sector': {
        let s = N3(across * 1.5 + o, along * 0.7 + side * 2.3, 5.5);
        if (v.type === 'half' && side === v.halfSide) s += 0.75;
        const st = fbm(across * 11 + o, along * 1.6, 2.9, 2);
        const lime = hex('#b4d15a'), cream = hex('#ede7a8'), medium = hex('#6f9e3e');
        let c = dark;
        if (v.type === 'lime') c = mix(hex('#93b844'), hex('#bcd468'), 0.5 + 0.5 * N3(x * 4, y * 4 + o, 1));
        c = mix(c, medium, sm(th - 0.2, th, st) * 0.7);
        c = mix(c, lime, sm(th, th + 0.08, st));
        c = mix(c, cream, sm(0.12, 0.2, s));
        const fl = N3(x * 60 + o, y * 25, 3.3);
        if (fl > 0.5) c = mix(c, dark, 0.8); else if (fl < -0.55) c = mix(c, lime, 0.7);
        return c;
      }
      case 'mintSpeckle': {
        const mint = mix(hex('#c9dfb6'), hex('#e6efd9'), 0.5 + 0.5 * N3(x * 5 + o, y * 5, 8));
        const b = fbm(x * 6 + o, y * 6, 3.9, 3) + 0.2 * N3(x * 18, y * 18 + o, 1.1);
        let d = sm(th - 0.05, th + 0.05, b);
        const sp = N3(x * 55 + o, y * 55, 2.4), sp2 = N3(x * 120, y * 120 + o, 6.2);
        if (d < 0.5) {
          if (sp > 0.4) d = 1; else if (sp > 0.3) d = 0.5;
          if (sp2 > 0.55) d = Math.max(d, 0.85);
        } else if (sp2 < -0.5) d = 0.15;
        dark = mix(dark, hex('#3f7232'), 0.35 + 0.35 * N3(x * 9, y * 9 + o, 0.2));
        return mix(mint, dark, d);
      }
      case 'pink': {
        let p = fbm(across * 3.2 + o, along * 1.4 + side * 1.7, 3.3, 3);
        if (v.type === 'half' && side === v.halfSide) p += 0.55;
        let pk = sm(th - 0.04, th + 0.04, p);
        const st = fbm(across * 14 + o, along * 3, 9.9, 2);
        pk = Math.max(pk, sm(th - 0.02, th + 0.05, p + st * 0.45) * 0.9);
        pk *= 0.75 + 0.25 * sm(-0.4, 0.2, N3(x * 22 + o, y * 22, 4.1));
        const pinkC = mix(mix(hex('#c99288'), hex('#e3bdb2'), 0.5 + 0.5 * N3(x * 4 + o, y * 4, 3)), hex('#ead6cc'), sm(0.3, 0.6, N3(x * 7, y * 7, o)) * 0.6);
        let c = mix(dark, pinkC, pk);
        const fl = N3(x * 65 + o, y * 65, 5.5);
        if (pk > 0.5 && fl > 0.5) c = mix(c, hex('#2b3a2c'), 0.85);
        return c;
      }
      case 'latte': {
        const n1 = fbm(x * 5 + o, y * 5, 2.2, 3), n2 = fbm(x * 11, y * 11 + o, 6.6, 2), sp = N3(x * 60, y * 60 + o, 7.3);
        let c = mix(hex('#2c3a22'), hex('#4f5634'), sm(-0.3, 0.3, n2));
        c = mix(c, mix(hex('#b38e72'), hex('#c9a389'), 0.5 + 0.5 * n2), sm(th - 0.05, th + 0.05, n1));
        c = mix(c, mix(hex('#e2a596'), hex('#f2d3c6'), 0.5 + 0.5 * N3(x * 8, y * 8, o)), sm(th + 0.08, th + 0.18, n1 + n2 * 0.45));
        if (sp > 0.45) c = mix(c, hex('#3e4a2e'), 0.75); else if (sp < -0.5) c = mix(c, hex('#dcae9f'), 0.7);
        return c;
      }
      case 'marble': {
        // Thai-constellation style: cream flecks and streaks marbled through deep green
        const warp = N3(x * 3 + o, y * 3, 5.5) * 0.35;
        const big = fbm(across * 4 + o + warp, along * 1.8, 6.1, 3);
        const streak = fbm(across * 22 + o, along * 5 + warp, 3.7, 3);
        const fleck = N3(x * 95 + o, y * 40, 1.9), dust = N3(x * 190, y * 190 + o, 8.4);
        let m = sm(th - 0.04, th + 0.04, big) * 0.95;
        m = Math.max(m, sm(0.18, 0.3, streak + big * 0.4) * 0.85);
        if (fleck > 0.42) m = Math.max(m, 0.9); else if (dust > 0.5) m = Math.max(m, 0.7);
        if (m > 0.6 && fleck < -0.55) m = 0.2;
        dark = mix(hex('#123a14'), hex('#1f4c1b'), 0.5 + 0.5 * N3(x * 5, y * 5 + o, 0.4));
        const cream = mix(hex('#e9e5c6'), hex('#d3dca8'), 0.5 + 0.5 * N3(x * 7 + o, y * 7, 2.6));
        return mix(mix(dark, hex('#4e7f3a'), sm(th - 0.25, th - 0.04, big) * 0.4), cream, m);
      }
      case 'plain': return mix(dark, hex('#4a7d36'), 0.25 + 0.25 * N3(x * 2, y * 8 + o, 1.3));
      case 'velvet': default: return mix(dark, hex('#1f4426'), 0.3 * (0.5 + 0.5 * N3(x * 4, y * 4 + o, 2.6)));
    }
  }

  function build(variety, idx, maturity, shared) {
    const spec = SPECS[variety], shape = SHAPES[spec.shape], back = shape.back, hw = halfWidth(shape);
    const Hp = spec.res || 512, LW = Hp / 512;
    const Wp = Math.max(128, Math.min(Hp, Math.round((Hp * spec.aspect) / (1 + back) / 32) * 32));
    const P = (X, Y, s) => { s = s || 1; return [(Wp / 2 + X * (Wp / 2 - 4)) * s, (4 + ((1 - Y) / (1 + back)) * (Hp - 8)) * s]; };
    const rnd = PC.rng(PC.hashStr(variety) + idx * 977 + maturity * 31);
    const vr = PC.rng(PC.hashStr(variety) + 5); // vein layout shared by all leaves of a variety

    function outline(ctx, s) {
      ctx.beginPath(); let p = P(0, 1, s); ctx.moveTo(p[0], p[1]);
      const c = shape.curves;
      for (const q of c) { const a = P(q[0], q[1], s), b = P(q[2], q[3], s), e = P(q[4], q[5], s); ctx.bezierCurveTo(a[0], a[1], b[0], b[1], e[0], e[1]); }
      for (let i = c.length - 1; i >= 0; i--) {
        const q = c[i], prev = i > 0 ? [c[i - 1][4], c[i - 1][5]] : [0, 1];
        const a = P(-q[2], q[3], s), b = P(-q[0], q[1], s), e = P(-prev[0], prev[1], s);
        ctx.bezierCurveTo(a[0], a[1], b[0], b[1], e[0], e[1]);
      }
      ctx.closePath();
    }

    // vein layout
    const V = spec.veins, veins = [], latYs = [];
    for (let i = 0; i < V.n; i++) latYs.push(V.start + (i / Math.max(1, V.n - 1)) * (V.end - V.start) + (vr() - 0.5) * 0.02);
    for (const side of [-1, 1]) {
      for (const y0 of latYs) {
        const y1 = Math.min(0.98, y0 + V.rise), xe = hw(y1) * 0.9;
        veins.push({ pts: [[0, y0], [side * xe * 0.45, y0 + V.rise * 0.25], [side * xe, y1]], w: V.w });
      }
      const lx = shape.curves[1][4], ly = shape.curves[1][5];
      for (let b = 0; b < (V.basal || 0); b++) {
        const f = b / Math.max(1, V.basal);
        const ty = PC.lerp(ly * 0.85, 0.18, f), tx = (b === 0 ? lx * 0.85 : hw(ty) * 0.85);
        veins.push({ pts: [[0, 0], [side * tx * 0.5, (ty) * 0.25], [side * tx, ty]], w: V.w * 1.1 });
      }
      if (V.collective) veins.push({ cubic: true, pts: [[0, 0.01], [side * hw(0.1) * 0.95, 0.1], [side * hw(0.55) * 0.82, 0.62], [side * 0.03, 0.97]], w: V.w * 1.15 });
    }
    function strokeVeins(ctx, s, heightMode) {
      ctx.lineCap = 'round';
      for (const v of veins) {
        ctx.lineWidth = v.w * s * LW * (heightMode ? 2.4 : 1);
        ctx.beginPath(); const a = P(v.pts[0][0], v.pts[0][1], s); ctx.moveTo(a[0], a[1]);
        if (v.cubic) { const b = P(...v.pts[1], s), c = P(...v.pts[2], s), d = P(...v.pts[3], s); ctx.bezierCurveTo(b[0], b[1], c[0], c[1], d[0], d[1]); }
        else { const b = P(...v.pts[1], s), c = P(...v.pts[2], s); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); }
        ctx.stroke();
      }
    }
    function strokeMidrib(ctx, s, heightMode) {
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.lineWidth = V.mid * s * LW * (1 - k * 0.3) * (heightMode ? 2 : 1);
        ctx.beginPath(); const a = P(0, spec.shape === 'peltate' || spec.shape === 'latte' ? 0 : -0.02, s), b = P(0, 0.97 - k * 0.25, s);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }

    // ---- colour ----
    const cv = { o: rnd() * 40 + idx * 13.7, th: spec.coverage[idx % spec.coverage.length] + (rnd() - 0.5) * 0.06, type: null, halfSide: rnd() < 0.5 ? -1 : 1 };
    if (spec.pattern === 'sector') cv.type = idx % 6 === 1 ? 'half' : idx % 6 === 4 ? 'lime' : null;
    if (spec.pattern === 'pink') cv.type = idx % 6 === 2 ? 'half' : null;
    const w2 = Wp >> 1, h2 = Hp >> 1;
    const lo = T.canvas(w2, h2), lx = lo.getContext('2d'), img = lx.createImageData(w2, h2), d = img.data;
    for (let j = 0; j < h2; j++) {
      const Y = 1 - ((j * 2 - 4) / (Hp - 8)) * (1 + back);
      for (let i = 0; i < w2; i++) {
        const X = (i * 2 - Wp / 2) / (Wp / 2 - 4);
        const c = patternColor(spec, cv, X * spec.aspect * 0.5, Y, X, Y);
        const k = (j * w2 + i) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
    }
    lx.putImageData(img, 0, 0);
    const cc = T.canvas(Wp, Hp), cx = cc.getContext('2d');
    cx.imageSmoothingEnabled = true; cx.drawImage(lo, 0, 0, Wp, Hp);
    if (V.glow) { cx.save(); cx.shadowColor = V.color; cx.shadowBlur = V.glow * LW; cx.strokeStyle = V.color; strokeVeins(cx, 1); cx.restore(); }
    cx.strokeStyle = V.color; strokeVeins(cx, 1);
    cx.strokeStyle = V.midColor; strokeMidrib(cx, 1);
    cx.save(); outline(cx, 1); cx.lineWidth = 2.5 * LW; cx.strokeStyle = 'rgba(190,200,140,0.3)'; cx.stroke(); cx.restore();

    if (shared) return { map: T.tex(cc, true), alphaMap: shared.alphaMap, normalMap: shared.normalMap, back, aspect: spec.aspect, angle: spec.angle, corr: shared.corr };
    // ---- mask ----
    const mc = T.canvas(Wp, Hp), mx = mc.getContext('2d');
    mx.fillStyle = '#000'; mx.fillRect(0, 0, Wp, Hp); mx.fillStyle = '#fff'; outline(mx, 1); mx.fill();
    if (spec.fen && maturity > 0) fenestrate(mx, P, hw, latYs, V.rise, maturity, rnd, Wp);

    // ---- relief ----
    const R = spec.relief, hc = T.canvas(w2, h2), hx = hc.getContext('2d'), himg = hx.createImageData(w2, h2), hd = himg.data;
    const ca = Math.cos(spec.angle), sa = Math.sin(spec.angle);
    for (let j = 0; j < h2; j++) {
      const Y = 1 - ((j * 2 - 4) / (Hp - 8)) * (1 + back);
      for (let i = 0; i < w2; i++) {
        const X = (i * 2 - Wp / 2) / (Wp / 2 - 4), x = X * spec.aspect * 0.5, ax = Math.abs(x);
        let h = 0.55;
        if (R.scale) { const g = Math.abs(N3(x * 16, y16(Y), 4.2)); h -= 0.24 * Math.exp(-g * 13); h += 0.06 * N3(x * 34, Y * 34, 1.9); }
        if (R.corr) { const acr = Y * ca - ax * sa; h += 0.32 * Math.sin(acr * Math.PI * 2 * R.corr); }
        if (R.quilt) h += 0.12 * fbm(x * 9, Y * 9, 2.8, 2);
        const v = PC.clamp(h, 0, 1) * 255, k = (j * w2 + i) * 4;
        hd[k] = hd[k + 1] = hd[k + 2] = v; hd[k + 3] = 255;
      }
    }
    hx.putImageData(himg, 0, 0);
    try { hx.filter = 'blur(1.5px)'; } catch (e) { }
    hx.strokeStyle = `rgb(${R.depth},${R.depth},${R.depth})`;
    strokeVeins(hx, 0.5, true); strokeMidrib(hx, 0.5, true);
    hx.filter = 'none';
    const nc = T.normalFromHeight(hc, R.strength);

    return {
      map: T.tex(cc, true), alphaMap: T.tex(mc, false), normalMap: T.tex(nc, false),
      back, aspect: spec.aspect, angle: spec.angle, corr: R.corr || 0
    };
  }
  const y16 = (Y) => Y * 16;

  function fenestrate(mx, P, hw, latYs, rise, maturity, rnd, Wp) {
    mx.fillStyle = '#000';
    const ys = latYs.slice().sort((a, b) => a - b);
    for (const side of [-1, 1]) {
      for (let i = 0; i < ys.length - 1; i++) {
        const ym = (ys[i] + ys[i + 1]) / 2 + 0.01;
        if (ym > 0.8) continue;
        const y1 = Math.min(0.97, ym + rise), dirx = hw(y1) * 0.9, diry = rise;
        const L = Math.hypot(dirx, diry), ux = dirx / L, uy = diry / L;
        const doSplit = maturity >= 2 && ym > 0.05 && rnd() < (maturity === 3 ? 0.95 : 0.75);
        const fi = maturity === 3 ? 0.36 : 0.52;
        if (doSplit) {
          const ax = side * dirx * fi, ay = ym + diry * fi, bx = side * dirx * 1.5, by = ym + diry * 1.5;
          const wi = 0.016, wo = 0.05 + rnd() * 0.02, px = -uy * side, py = ux;
          const pts = [[ax + px * wi, ay + py * wi], [bx + px * wo, by + py * wo], [bx - px * wo, by - py * wo], [ax - px * wi, ay - py * wi]];
          mx.beginPath(); pts.forEach((p, k) => { const q = P(p[0], p[1]); k ? mx.lineTo(q[0], q[1]) : mx.moveTo(q[0], q[1]); }); mx.closePath(); mx.fill();
          const c = P(ax, ay); mx.beginPath(); mx.arc(c[0], c[1], wi * Wp * 0.45, 0, 6.283); mx.fill();
        }
        if ((maturity === 1 && rnd() < 0.55 && ym > 0.15 && ym < 0.7) || (maturity >= 2 && rnd() < 0.7 && ym > 0.1)) {
          const f = doSplit ? fi * 0.45 : 0.3 + rnd() * 0.15, c = P(side * dirx * f, ym + diry * f);
          mx.save(); mx.translate(c[0], c[1]); mx.rotate(-Math.atan2(diry, side * dirx * 0.5));
          mx.beginPath(); mx.ellipse(0, 0, Wp * (0.03 + rnd() * 0.02) * (maturity === 1 ? 0.7 : 1), Wp * 0.011, 0, 0, 6.283); mx.fill(); mx.restore();
        }
      }
    }
  }

  // ---- cache: one array of leaf texture sets per variety ----
  const cache = {};
  T.getVarietySets = function (variety) {
    if (cache[variety]) return cache[variety];
    const spec = SPECS[variety], sets = [];
    if (spec.fen) { for (let m = spec.minMat || 0; m < 4; m++) for (let v = 0; v < spec.variants; v++) sets.push(build(variety, m * spec.variants + v, m)); }
    else {
      // shape and relief are shared, colour differs per leaf
      const first = build(variety, 0, 0); sets.push(first);
      for (let v = 1; v < spec.variants; v++) sets.push(build(variety, v, 0, first));
    }
    cache[variety] = sets;
    return sets;
  };
})(window.PC);
