/* Procedural canvas textures: leaves, wood, plaster, soil, fish, water, sprites */
(function (PC) {
  'use strict';
  const T = (PC.Tex = {});

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  function tex(c, srgb, repeat) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  }
  T.canvas = canvas; T.tex = tex;

  // height canvas -> normal map canvas
  function normalFromHeight(hc, strength, wrap) {
    const w = hc.width, h = hc.height;
    const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
    const out = canvas(w, h), octx = out.getContext('2d');
    const img = octx.createImageData(w, h), d = img.data;
    const H = (x, y) => {
      if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = PC.clamp(x, 0, w - 1); y = PC.clamp(y, 0, h - 1); }
      return src[(y * w + x) * 4] / 255;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      // canvas y goes down, uv v goes up: flip dy sign
      let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    return out;
  }
  T.normalFromHeight = normalFromHeight;

  // ----------------------------------------------------------------------
  T.wood = function () {
    const S = 1024, c = canvas(S), x = c.getContext('2d'), r = PC.rng(7);
    const planks = 6, pw = S / planks;
    for (let p = 0; p < planks; p++) {
      const base = 38 + r() * 14;
      for (let y = 0; y < S; y += 2) {
        const n = PC.noise3(p * 3.1, y * 0.004, 0) * 10 + PC.noise3(p, y * 0.05, 2) * 3;
        x.fillStyle = `rgb(${base + n + 26},${base * 0.62 + n * 0.6 + 12},${base * 0.38 + n * 0.3 + 4})`;
        x.fillRect(p * pw, y, pw, 2);
      }
      // grain
      for (let i = 0; i < 70; i++) {
        x.strokeStyle = `rgba(20,10,4,${0.08 + r() * 0.12})`; x.lineWidth = 0.6 + r() * 1.4;
        x.beginPath(); const gx = p * pw + r() * pw; x.moveTo(gx, 0);
        for (let y = 0; y <= S; y += 32) x.lineTo(gx + Math.sin(y * 0.01 + i) * 3 + PC.noise3(i, y * 0.01, p) * 6, y);
        x.stroke();
      }
      x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(p * pw, 0, 2, S);
      const cut = r() * S; x.fillRect(p * pw, cut, pw, 2);
    }
    const t = tex(c, true, true); return t;
  };

  T.plaster = function () {
    const S = 512, c = canvas(S), x = c.getContext('2d');
    const img = x.createImageData(S, S), d = img.data;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const n = PC.fbm3(i / 60, j / 60, 3.3, 4) * 10 + (Math.random() - 0.5) * 6;
      const k = (j * S + i) * 4;
      d[k] = 74 + n; d[k + 1] = 72 + n; d[k + 2] = 68 + n; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return tex(c, true, true);
  };

  T.soil = function () {
    const S = 256, c = canvas(S), x = c.getContext('2d'), r = PC.rng(4);
    x.fillStyle = '#1b130d'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const v = 18 + r() * 40;
      x.fillStyle = `rgb(${v * 1.15},${v * 0.85},${v * 0.6})`;
      x.beginPath(); x.arc(r() * S, r() * S, 1 + r() * 2.6, 0, 6.283); x.fill();
    }
    return tex(c, true, true);
  };

  T.felt = function () {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    const img = x.createImageData(S, S), d = img.data;
    for (let i = 0; i < S * S; i++) { const n = 26 + Math.random() * 8; d[i * 4] = n; d[i * 4 + 1] = n + 1; d[i * 4 + 2] = n; d[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0);
    return tex(c, true, true);
  };

  T.glow = function (inner, outer) {
    const S = 128, c = canvas(S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, inner || 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, outer || 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return tex(c, false);
  };

  T.bubble = function () {
    const S = 64, c = canvas(S), x = c.getContext('2d');
    const g = x.createRadialGradient(S * 0.5, S * 0.5, S * 0.18, S * 0.5, S * 0.5, S * 0.48);
    g.addColorStop(0, 'rgba(255,255,255,0.15)'); g.addColorStop(0.8, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, 6.283); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.arc(S * 0.38, S * 0.36, S * 0.08, 0, 6.283); x.fill();
    return tex(c, false);
  };

  // neon tetra: u along body (0 tail -> 1 nose), v vertical (0 belly -> 1 back)
  T.neon = function () {
    const W = 256, H = 64, c = canvas(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5a5148'); g.addColorStop(0.35, '#8b8a7e'); g.addColorStop(0.65, '#c9c7bd'); g.addColorStop(1, '#e8e4dc');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // red lower rear
    const rg = x.createLinearGradient(0, 0, W, 0);
    rg.addColorStop(0.0, 'rgba(220,30,30,0.0)'); rg.addColorStop(0.12, 'rgba(222,32,30,0.95)'); rg.addColorStop(0.55, 'rgba(222,32,30,0.95)'); rg.addColorStop(0.62, 'rgba(222,32,30,0)');
    x.fillStyle = rg; x.fillRect(0, H * 0.5, W, H * 0.42);
    // blue stripe
    const bg = x.createLinearGradient(0, H * 0.3, 0, H * 0.5);
    bg.addColorStop(0, 'rgba(40,160,255,0)'); bg.addColorStop(0.3, 'rgba(50,190,255,1)'); bg.addColorStop(0.7, 'rgba(30,120,255,1)'); bg.addColorStop(1, 'rgba(30,120,255,0)');
    x.fillStyle = bg; x.fillRect(W * 0.16, H * 0.3, W * 0.7, H * 0.2);
    // eye
    x.fillStyle = '#0a0a0a'; x.beginPath(); x.arc(W * 0.9, H * 0.48, 4, 0, 6.283); x.fill();
    const em = canvas(W, H), ex = em.getContext('2d');
    ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
    ex.fillStyle = bg; ex.fillRect(W * 0.16, H * 0.3, W * 0.7, H * 0.2);
    return { map: tex(c, true), emissive: tex(em, true) };
  };

  // tileable water normal map
  T.waterNormal = function () {
    const S = 256, hc = canvas(S), x = hc.getContext('2d');
    const img = x.createImageData(S, S), d = img.data, r = PC.rng(9);
    const waves = [];
    for (let i = 0; i < 14; i++) waves.push([1 + Math.floor(r() * 6), Math.floor(r() * 7) - 3, r() * 6.28, 0.3 + r()]);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      let h = 0;
      for (const w of waves) h += Math.sin((i / S) * 6.283 * w[0] + (j / S) * 6.283 * w[1] + w[2]) * w[3] / (w[0] + Math.abs(w[1]));
      const v = 128 + h * 40, k = (j * S + i) * 4;
      d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = tex(normalFromHeight(hc, 3, true), false, true);
    return t;
  };

  T.stone = function () {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    const img = x.createImageData(S, S), d = img.data;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const n = PC.fbm3(i / 18, j / 18, 1.7, 5);
      const vein = Math.abs(PC.noise3(i / 40, j / 9, 5.1)) < 0.03 ? 60 : 0;
      const v = 95 + n * 60 + vein;
      const k = (j * S + i) * 4; d[k] = v * 0.93; d[k + 1] = v; d[k + 2] = v * 1.03; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return tex(c, true, true);
  };
})(window.PC);
