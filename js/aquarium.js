// Rimless planted aquarium in the cabinet's bottom bay, modelled on an Iwagumi layout:
// layered Seiryu stones, a rolling Monte Carlo carpet that sways in the current, dark aqua soil
// against the front glass, a backlit white backdrop, fine bubbles, glass lily pipes, neon tetras
// and cherry shrimp. All underwater surfaces share the water shading in water.js.
import * as THREE from 'three';
import { WU, underwater, motionDepth } from './water.js';
import { rng, noise3, fbm3, smooth, clamp, lerp, hash1, canvas } from './util.js';

export const TK = { w: 0.86, h: 0.38, d: 0.36, y0: -0.505, g: 0.006, water: 0.352 };

const tex = (c, srgb, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
function heightNormal(h, W, H, strength, wrap) {
  const c = canvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
  const at = (i, j) => wrap ? h[((j + H) % H) * W + ((i + W) % W)] : h[clamp(j, 0, H - 1) * W + clamp(i, 0, W - 1)];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * strength, dy = (at(i, j + 1) - at(i, j - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz), k = (j * W + i) * 4;
    d[k] = (nx / l * 0.5 + 0.5) * 255; d[k + 1] = (ny / l * 0.5 + 0.5) * 255; d[k + 2] = (nz / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return tex(c, false, wrap);
}

// ---------------------------------------------------------------- textures
function aquaSoil() {
  const S = 512, r = rng(41), h = new Float32Array(S * S).fill(0);
  const c = canvas(S), x = c.getContext('2d');
  x.fillStyle = '#120b07'; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 5200; k++) {
    const cx = r() * S, cy = r() * S, rad = 3 + r() * 5.5, v = r();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const px = cx + dx * S, py = cy + dy * S;
      if (px < -rad || px > S + rad || py < -rad || py > S + rad) continue;
      const g = x.createRadialGradient(px - rad * 0.3, py - rad * 0.35, rad * 0.1, px, py, rad);
      const b = 22 + v * 26;
      g.addColorStop(0, `rgb(${b * 1.9},${b * 1.35},${b})`); g.addColorStop(0.65, `rgb(${b * 1.25},${b * 0.85},${b * 0.62})`); g.addColorStop(1, `rgb(${b * 0.5},${b * 0.33},${b * 0.24})`);
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 6.283); x.fill();
    }
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const dd = Math.hypot(i, j); if (dd > rad) continue;
      const ii = (Math.floor(cx) + i + S) % S, jj = (Math.floor(cy) + j + S) % S;
      h[jj * S + ii] = Math.max(h[jj * S + ii], Math.sqrt(1 - (dd / rad) ** 2));
    }
  }
  return { map: tex(c, true, true), normalMap: heightNormal(h, S, S, 2.2, true) };
}

function carpetLeaf() {
  const S = 128, c = canvas(S), x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  // leaf blade: slightly obovate, lighter centre, darker rim, faint midrib
  x.save(); x.translate(S / 2, S / 2);
  x.beginPath(); x.ellipse(0, 4, 50, 58, 0, 0, 6.283); x.closePath();
  const g = x.createRadialGradient(-8, -6, 4, 0, 4, 60);
  g.addColorStop(0, '#d6ff8a'); g.addColorStop(0.55, '#9fdc4a'); g.addColorStop(1, '#4f9a22');
  x.fillStyle = g; x.fill();
  x.strokeStyle = 'rgba(70,120,40,0.55)'; x.lineWidth = 3; x.stroke();
  x.strokeStyle = 'rgba(240,255,210,0.5)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, 60); x.lineTo(0, -40); x.stroke();
  x.restore();
  // stem patch in the bottom corner (uv 0.02..0.1)
  x.fillStyle = '#8fbd5a'; x.fillRect(0, S - 12, 12, 12);
  const t = tex(c, true, false); t.generateMipmaps = true; return t;
}

function backdropTex() {
  const c = canvas(64, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f2f6f3'); g.addColorStop(1, '#c9d4cf');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  return tex(c, true, false);
}

function waterNormalTex() {
  const S = 256, h = new Float32Array(S * S), r = rng(9), waves = [];
  for (let i = 0; i < 16; i++) waves.push([1 + Math.floor(r() * 6), Math.floor(r() * 7) - 3, r() * 6.28, 0.3 + r()]);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let v = 0; for (const w of waves) v += Math.sin((i / S) * 6.283 * w[0] + (j / S) * 6.283 * w[1] + w[2]) * w[3] / (w[0] + Math.abs(w[1]));
    h[j * S + i] = v * 0.12;
  }
  return heightNormal(h, S, S, 3, true);
}

function bubbleTex() {
  const S = 64, c = canvas(S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.48);
  g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.8, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, 6.283); x.fill();
  x.fillStyle = 'rgba(255,255,255,1)'; x.beginPath(); x.arc(S * 0.38, S * 0.36, S * 0.09, 0, 6.283); x.fill();
  return tex(c, false, false);
}

function neonTex() {
  const W = 256, H = 64, c = canvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4f463d'); g.addColorStop(0.35, '#8b887c'); g.addColorStop(0.65, '#d3d0c6'); g.addColorStop(1, '#ece8e0');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const rg = x.createLinearGradient(0, 0, W, 0);
  rg.addColorStop(0.0, 'rgba(220,30,30,0)'); rg.addColorStop(0.12, 'rgba(225,30,32,0.95)'); rg.addColorStop(0.55, 'rgba(225,30,32,0.95)'); rg.addColorStop(0.62, 'rgba(225,30,32,0)');
  x.fillStyle = rg; x.fillRect(0, H * 0.5, W, H * 0.42);
  const bg = x.createLinearGradient(0, H * 0.3, 0, H * 0.5);
  bg.addColorStop(0, 'rgba(40,160,255,0)'); bg.addColorStop(0.3, 'rgba(60,200,255,1)'); bg.addColorStop(0.7, 'rgba(30,120,255,1)'); bg.addColorStop(1, 'rgba(30,120,255,0)');
  x.fillStyle = bg; x.fillRect(W * 0.16, H * 0.3, W * 0.7, H * 0.2);
  x.fillStyle = '#0a0a0a'; x.beginPath(); x.arc(W * 0.9, H * 0.48, 4, 0, 6.283); x.fill();
  x.fillStyle = 'rgba(220,220,200,0.9)'; x.beginPath(); x.arc(W * 0.9, H * 0.48, 6, 0, 6.283); x.lineWidth = 1.5; x.strokeStyle = 'rgba(200,200,180,0.8)'; x.stroke();
  const em = canvas(W, H), ex = em.getContext('2d'); ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H); ex.fillStyle = bg; ex.fillRect(W * 0.16, H * 0.3, W * 0.7, H * 0.2);
  return { map: tex(c, true), emissive: tex(em, true) };
}

// ---------------------------------------------------------------- stones
function mergeByPosition(geo) {
  const p = geo.attributes.position, map = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) {
    const key = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
    let k = map.get(key); if (k === undefined) { k = pos.length / 3; pos.push(p.getX(i), p.getY(i), p.getZ(i)); map.set(key, k); }
    idx.push(k);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}

// A fractured block split into leaning bedding layers (the parallel slab ridges of Seiryu / Ryuoh stone),
// cut by grooves and cracks, with baked cavity occlusion and worn edges.
function buildStone(seed, detail, o) {
  const lean = o.lean, stretch = o.stretch, layers = o.layers, slab = o.slab ?? 1;
  const L = new THREE.Vector3(-Math.cos(lean), Math.sin(lean), 0.1).normalize();
  const N = new THREE.Vector3(Math.sin(lean), Math.cos(lean), 0.3).normalize();
  const geo = mergeByPosition(new THREE.IcosahedronGeometry(1, detail));
  const p = geo.attributes.position, n = p.count, v = new THREE.Vector3(), q = new THREE.Vector3();
  const tone = new Float32Array(n), layerId = new Float32Array(n), edge = new Float32Array(n);
  const pr = rng(seed * 7 + 3), planes = [];
  for (let k = 0; k < 15; k++) {
    const vert = k < 10, az = pr() * 6.283, el = vert ? (pr() - 0.5) * 0.6 : 0.5 + pr() * 1.0;
    planes.push([new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)), 0.78 + pr() * 0.24]);
  }
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let r = 1.3;
    for (const [nv, d] of planes) { const c = v.dot(nv); if (c > 0.05) r = Math.min(r, d / c); }
    r *= 1 + 0.07 * fbm3(v.x * 2 + seed, v.y * 2, v.z * 2, 3);
    const u = v.dot(N) * layers + 0.5 * noise3(v.x * 1.7 + seed, v.y * 1.7, v.z * 1.7) + 0.12 * noise3(v.x * 6, v.y * 6, v.z * 6 + seed);
    const li = Math.floor(u), f = u - li;
    r += (hash1(li + seed * 13) - 0.5) * 0.42 * slab - Math.pow(f, 2.6) * 0.21 * slab;
    r -= 0.08 * slab * Math.exp(-Math.min(f, 1 - f) * 40);
    r -= 0.1 * Math.exp(-Math.abs(noise3(v.x * 3.8 + seed * 1.3, v.y * 1.0, v.z * 3.8)) * 16);
    r -= 0.03 * Math.exp(-Math.abs(noise3(v.x * 9 + 4.1, v.y * 9 + seed, v.z * 9)) * 30);
    const cr = 1 - Math.abs(noise3(v.x * 15 + seed, v.y * 15, v.z * 15));
    r += 0.022 * cr * cr * cr + 0.01 * noise3(v.x * 28, v.y * 28 + seed, v.z * 28);
    q.copy(v).multiplyScalar(r);
    const along = q.dot(L); q.addScaledVector(L, along * (stretch - 1)); q.multiplyScalar(1 / Math.sqrt(stretch));
    if (q.y < -0.36) q.y = -0.36 - (q.y + 0.36) * 0.08;
    p.setXYZ(i, q.x, q.y, q.z);
    layerId[i] = hash1(li * 3.7 + seed); edge[i] = smooth(0.84, 1, f); tone[i] = noise3(v.x * 3 + seed, v.y * 3, v.z * 3);
  }
  geo.computeVertexNormals();
  const idx = geo.index.array, sum = new Float32Array(n * 3), cnt = new Float32Array(n);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    for (const [uu, w1, w2] of [[a, b, c], [b, c, a], [c, a, b]]) {
      sum[uu * 3] += p.getX(w1) + p.getX(w2); sum[uu * 3 + 1] += p.getY(w1) + p.getY(w2); sum[uu * 3 + 2] += p.getZ(w1) + p.getZ(w2); cnt[uu] += 2;
    }
  }
  const nr = geo.attributes.normal, cav = new Float32Array(n); let mean = 0;
  for (let i = 0; i < n; i++) {
    cav[i] = (sum[i * 3] / cnt[i] - p.getX(i)) * nr.getX(i) + (sum[i * 3 + 1] / cnt[i] - p.getY(i)) * nr.getY(i) + (sum[i * 3 + 2] / cnt[i] - p.getZ(i)) * nr.getZ(i);
    mean += Math.abs(cav[i]);
  }
  mean /= n;
  const sharp = Float32Array.from(cav, (c) => clamp(c / (mean * 2.5), -1, 1));
  let ao = sharp.slice();
  for (let pass = 0; pass < 4; pass++) {
    const s2 = new Float32Array(n), c2 = new Float32Array(n);
    for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const uu = idx[t + k], w = idx[t + (k + 1) % 3]; s2[uu] += ao[w]; c2[uu]++; s2[w] += ao[uu]; c2[w]++; }
    ao = Float32Array.from(ao, (a, i) => a * 0.4 + 0.6 * s2[i] / c2[i]);
  }
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let c = 0.03 * (0.7 + 0.8 * layerId[i]) * (1 + 0.25 * tone[i]);
    const concave = smooth(0, 0.6, ao[i]), crevice = smooth(0.2, 0.9, sharp[i]), convex = smooth(0.05, 0.7, -sharp[i]);
    c *= (1 - 0.72 * concave) * (1 - 0.5 * crevice);
    c *= 1 + 2.2 * convex + 1.6 * edge[i] * (1 - concave);
    c *= 1 + 0.35 * smooth(0.45, 0.9, nr.getY(i));
    c *= 0.5 + 0.5 * smooth(-0.36, -0.12, p.getY(i));
    const film = concave * 0.35;
    cols[i * 3] = lerp(c * 0.94, c * 0.8, film); cols[i * 3 + 1] = lerp(c * 0.98, c * 1.05, film); cols[i * 3 + 2] = lerp(c * 1.04, c * 0.7, film);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

const ROCK = {
  key: 'rock', caustic: 0.75,
  fragHead: `
    vec3 rk_m289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
    vec4 rk_m289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
    vec4 rk_perm(vec4 x){return rk_m289(((x*34.0)+1.0)*x);}
    float rk_snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
      i = rk_m289(i);
      vec4 p = rk_perm(rk_perm(rk_perm(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      vec3 ns = 0.142857142857 * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
      vec4 nrm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3));
      p0 *= nrm.x; p1 *= nrm.y; p2 *= nrm.z; p3 *= nrm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
    float rk_fbm(vec3 p){ return 0.55 * rk_snoise(p) + 0.3 * rk_snoise(p * 2.07 + 3.1) + 0.15 * rk_snoise(p * 4.13 + 7.7); }
    vec3 rk_perturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
      vec3 vSigmaX = dFdx(surf_pos), vSigmaY = dFdy(surf_pos);
      vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
      float fDet = dot(vSigmaX, R1) * faceDir;
      vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
      return normalize(abs(fDet) * surf_norm - vGrad);
    }
    float rkHeight; float rkVein; float rkPearl;`,
  color: `{
      vec3 rp = vWPos;
      float fine = 1.0 - smoothstep(0.0006, 0.0025, length(fwidth(rp)));
      float vph = dot(rp, normalize(vec3(0.35, 1.0, 0.18))) * 22.0 + rk_snoise(rp * 9.0) * 0.55 + rk_snoise(rp * 40.0) * 0.06;
      float seam = (1.0 - smoothstep(0.004, 0.014, abs(fract(vph) - 0.5))) * smoothstep(0.15, 0.5, rk_snoise(rp * vec3(6.0, 2.5, 6.0) + 3.0));
      float net = (1.0 - smoothstep(0.006, 0.025, abs(rk_snoise(rp * 20.0 + 11.0) + 0.2 * rk_snoise(rp * 60.0)))) * smoothstep(0.5, 0.7, rk_snoise(rp * 6.0 + 21.0));
      rkVein = max(seam, net * 0.35) * (0.55 + 0.45 * fine);
      float pn = rk_snoise(rp * 15.0 + 5.0) + 0.35 * rk_snoise(rp * 55.0);
      float patchW = smoothstep(0.42, 0.5, pn) * smoothstep(0.0, 0.4, rk_snoise(rp * 5.0 + 9.0));
      float crk = (1.0 - smoothstep(0.0, 0.035, abs(rk_snoise(rp * 30.0 + 2.0)))) * smoothstep(0.35, 0.6, rk_snoise(rp * 6.0 + 1.0)) * fine;
      float pit = smoothstep(0.7, 0.9, rk_snoise(rp * 180.0)) * fine;
      float tone = rk_fbm(rp * 40.0);
      vec3 c = diffuseColor.rgb * (0.85 + 0.3 * (tone * 0.5 + 0.5));
      c *= 1.0 + 0.06 * rk_snoise(rp * 260.0) * fine;
      c = mix(c, vec3(0.13, 0.135, 0.13) * (0.75 + 0.5 * (rk_snoise(rp * 90.0) * 0.5 + 0.5)), patchW * 0.4);
      c *= (1.0 - 0.15 * crk) * (1.0 - 0.15 * pit);
      c *= vec3(0.96, 0.98, 1.04);
      c = mix(c, vec3(0.62, 0.63, 0.62), rkVein * 0.9);
      diffuseColor.rgb = c;
      rkPearl = smoothstep(0.86, 0.93, rk_snoise(rp * 700.0)) * smoothstep(0.1, 0.5, rk_snoise(rp * 12.0 + 4.0)) * fine;
      // fine parallel bedding laminae plus crystalline grain, instead of a blobby bump
      float lam = dot(rp, normalize(vec3(0.55, 1.0, 0.15))) * 240.0 + rk_snoise(rp * 18.0) * 2.0;
      float lamAA = 1.0 - smoothstep(0.08, 0.3, fwidth(lam));
      float strata = mix(0.5, abs(fract(lam) - 0.5) * 2.0, lamAA);
      float grain = rk_snoise(rp * 520.0) * fine;
      c *= 0.92 + 0.12 * strata;
      rkHeight = 0.0011 * (0.45 * tone + 0.35 * strata * smoothstep(-0.2, 0.4, rk_snoise(rp * 7.0)) + 0.12 * grain - crk * 0.6 - pit * 0.4 + rkVein * 0.15) + rkPearl * 0.0006;
    }`,
  rough: 'roughnessFactor = mix(roughnessFactor, 0.45, rkVein * 0.8); roughnessFactor = mix(roughnessFactor, 0.05, rkPearl);',
  normal: 'normal = rk_perturb(-vViewPosition, normal, vec2(dFdx(rkHeight), dFdy(rkHeight)), faceDirection);',
  post: 'outgoingLight += vec3(0.85, 0.95, 1.0) * rkPearl * 0.55 * uWaterLight;'
};

// ---------------------------------------------------------------- main build
export function buildAquarium(scene, opts = {}) {
  const lowEnd = !!opts.lowEnd;
  const tank = new THREE.Group(); tank.position.y = TK.y0; scene.add(tank);
  const { w, h, d, g } = TK, hw = w / 2, hd = d / 2, iw = hw - g, id = hd - g, waterY = TK.water;
  WU.uBoxMin.value.set(-iw, TK.y0 + g, -id); WU.uBoxMax.value.set(iw, TK.y0 + waterY, id);
  const out = { group: tank, lights: [], emissive: [] };

  // ---- glass: low-iron panes, green-tinted edges, silicone seams ----
  const pane = new THREE.MeshPhysicalMaterial({ color: 0xeefcf7, roughness: 0.02, transparent: true, opacity: 0.03, envMapIntensity: 0.22, depthWrite: false, side: THREE.DoubleSide, specularIntensity: 1 });
  const edgeM = new THREE.MeshPhysicalMaterial({ color: 0x8fe3cf, emissive: 0x3d9c86, emissiveIntensity: 0.35, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
  const add = (geo, m, x, y, z, ro) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (ro != null) o.renderOrder = ro; tank.add(o); return o; };
  const B = (a, b, c) => new THREE.BoxGeometry(a, b, c);
  add(B(w, g, d), new THREE.MeshPhysicalMaterial({ color: 0x9fd8c8, roughness: 0.05, transparent: true, opacity: 0.2, envMapIntensity: 0.2, depthWrite: false }), 0, g / 2, 0, 30);
  for (const [gw, gh, gd, x, y, z] of [[w, h, g, 0, h / 2, hd - g / 2], [w, h, g, 0, h / 2, -hd + g / 2], [g, h, d - 2 * g, hw - g / 2, h / 2, 0], [g, h, d - 2 * g, -hw + g / 2, h / 2, 0]]) add(B(gw, gh, gd), pane, x, y, z, 30).userData.noDepth = true;
  const e = 0.0032;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(B(e, h, e), edgeM, sx * (hw - e / 2), h / 2, sz * (hd - e / 2), 31);
  for (const sz of [-1, 1]) for (const y of [g / 2, h - 0.0015]) add(B(w, e, e), edgeM, 0, y, sz * (hd - e / 2), 31);
  for (const sx of [-1, 1]) for (const y of [g / 2, h - 0.0015]) add(B(e, e, d), edgeM, sx * (hw - e / 2), y, 0, 31);
  // leveling mat under the tank
  add(B(w + 0.004, 0.005, d + 0.004), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 }), 0, -0.0025, 0);

  // ---- backlit white backdrop (seen through the water, so it picks up the water tint) ----
  const backdropMat = underwater(new THREE.MeshBasicMaterial({ map: backdropTex(), color: new THREE.Color(1.5, 1.5, 1.5) }), { key: 'backdrop', caustic: 0 });
  const bd = add(new THREE.PlaneGeometry(w + 0.04, h + 0.05), backdropMat, 0, h / 2 + 0.01, -hd - 0.014);
  out.backdropMat = backdropMat;
  const backLight = new THREE.RectAreaLight(0xf4fbf8, 1.6, w, h * 0.8); backLight.position.set(0, h / 2, -hd - 0.01); backLight.lookAt(0, h / 2, 1); tank.add(backLight);
  out.lights.push({ light: backLight, base: 1.6 });

  // ---- substrate: rolling dunes, higher at the back ----
  const subH = (x, z) => {
    const xn = x / iw, zf = (z + id) / (2 * id);
    let y = 0.046 + 0.065 * Math.pow(1 - zf, 1.2);
    y += 0.05 * Math.exp(-((xn + 0.62) ** 2 / 0.12 + (zf - 0.38) ** 2 / 0.3));
    y += 0.032 * Math.exp(-((xn - 0.58) ** 2 / 0.09 + (zf - 0.32) ** 2 / 0.22));
    y += 0.014 * Math.exp(-((xn - 0.05) ** 2 / 0.05 + (zf - 0.55) ** 2 / 0.06));
    y -= 0.01 * Math.exp(-((xn - 0.28) ** 2 / 0.05 + (zf - 0.85) ** 2 / 0.06));
    y += noise3(x * 18, z * 18, 3.1) * 0.003;
    return g + Math.max(0.03, y);
  };
  const carpetThick = (x, z) => 0.015 + 0.012 * (0.5 + 0.5 * fbm3(x * 9, z * 9, 2.2, 3)) + 0.005 * Math.exp(-((x / iw + 0.6) ** 2 / 0.1));
  const soil = aquaSoil(); soil.map.repeat.set(9, 4); soil.normalMap.repeat.set(9, 4);
  const soilMat = underwater(new THREE.MeshStandardMaterial({ map: soil.map, normalMap: soil.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.92, color: 0xbba89a }), { key: 'soil', caustic: 0.8 });
  {
    const nx = 100, nz = 44, pos = [], uv = [], ix = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = -iw + (2 * iw * i) / nx, z = -id + (2 * id * j) / nz; pos.push(x, subH(x, z), z); uv.push(i / nx, j / nz); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, dd = c + 1; ix.push(a, c, b, b, c, dd); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(ix); sg.computeVertexNormals();
    const m = new THREE.Mesh(sg, soilMat); m.receiveShadow = true; tank.add(m);
    // cross-section against the glass: granules in layers, a little darker where roots run
    const wallMat = underwater(new THREE.MeshStandardMaterial({ map: soil.map, normalMap: soil.normalMap, roughness: 0.95, color: new THREE.Color(1.6, 1.45, 1.35), side: THREE.DoubleSide, envMapIntensity: 0.15 }), { key: 'soilwall', caustic: 0, post: 'outgoingLight += diffuseColor.rgb * 0.35 * uWaterLight;' });
    const wall = (pts, inward) => {
      const p = [], u = [], ii = [];
      pts.forEach(([x, z], k) => { const top = subH(x, z); p.push(x, g, z, x, top, z); const s = k / (pts.length - 1) * (inward ? 4 : 9); u.push(s, 0, s, top * 11); });
      for (let k = 0; k < pts.length - 1; k++) { const a = k * 2; ii.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); wg.setIndex(ii); wg.computeVertexNormals();
      tank.add(new THREE.Mesh(wg, wallMat));
    };
    const f = [], l = [], r = [];
    for (let i = 0; i <= 120; i++) f.push([-iw + (2 * iw * i) / 120, id - 0.0004]);
    for (let i = 0; i <= 40; i++) { l.push([-iw + 0.0004, -id + (2 * id * i) / 40]); r.push([iw - 0.0004, -id + (2 * id * i) / 40]); }
    wall(f); wall(l, true); wall(r, true);
  }

  // ---- stones ----
  const rockMat = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, envMapIntensity: 0.3 }), ROCK);
  // x, z, sx, sy, sz, rotY, seed, lean, stretch, layers
  const rocks = [
    [-0.1, -0.045, 0.17, 0.2, 0.1, 0.12, 11, 0.6, 1.75, 8],
    [-0.27, 0.0, 0.1, 0.13, 0.075, -0.22, 12, 0.55, 1.55, 6],
    [0.13, -0.07, 0.085, 0.14, 0.07, 0.45, 15, 1.08, 1.35, 6],
    [-0.31, 0.1, 0.05, 0.034, 0.04, 0.6, 13, 0.4, 1.3, 3],
    [-0.02, 0.105, 0.036, 0.026, 0.03, 1.1, 17, 0.35, 1.25, 3],
    [0.075, 0.06, 0.032, 0.024, 0.028, 0.2, 18, 0.5, 1.2, 3],
    [0.27, 0.065, 0.052, 0.034, 0.04, -0.5, 16, 0.6, 1.3, 3],
    [0.31, -0.09, 0.05, 0.06, 0.04, -0.3, 19, 0.9, 1.3, 4]
  ];
  const rockMeshes = [];
  for (const [x, z, sx, sy, sz, ry, seed, lean, stretch, layers] of rocks) {
    const geo = buildStone(seed, sx > 0.09 ? 6 : 5, { lean, stretch, layers });
    const m = new THREE.Mesh(geo, rockMat);
    m.scale.set(sx, sy, sz); m.rotation.y = ry; m.position.set(x, subH(x, z) + sy * 0.25, z);
    geo.computeBoundingBox();
    const top = m.position.y + geo.boundingBox.max.y * sy;
    if (top > waterY - 0.04) m.scale.y *= (waterY - 0.04 - m.position.y) / (top - m.position.y);
    m.castShadow = true; m.receiveShadow = true; tank.add(m); rockMeshes.push(m);
  }
  // rock-top height grid for carpet placement and animals
  const cell = 0.005, gx = Math.ceil((2 * iw) / cell), gz = Math.ceil((2 * id) / cell), rockTop = new Float32Array(gx * gz).fill(-1), tmp = new THREE.Vector3();
  for (const m of rockMeshes) {
    m.updateMatrix(); const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      tmp.fromBufferAttribute(p, i).applyMatrix4(m.matrix);
      const ci = Math.floor((tmp.x + iw) / cell), cj = Math.floor((tmp.z + id) / cell);
      if (ci < 0 || cj < 0 || ci >= gx || cj >= gz) continue;
      const k = cj * gx + ci; if (tmp.y > rockTop[k]) rockTop[k] = tmp.y;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const copy = rockTop.slice();
    for (let j = 1; j < gz - 1; j++) for (let i = 1; i < gx - 1; i++) {
      const k = j * gx + i; if (copy[k] > 0) continue; let nn = 0, s = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = copy[(j + dj) * gx + i + di]; if (q > 0) { nn++; s += q; } }
      if (nn >= 5) rockTop[k] = s / nn;
    }
  }
  const rockAt = (x, z) => { const ci = Math.floor((x + iw) / cell), cj = Math.floor((z + id) / cell); return (ci < 0 || cj < 0 || ci >= gx || cj >= gz) ? -1 : rockTop[cj * gx + ci]; };
  const carpetTop = (x, z) => subH(x, z) + carpetThick(x, z);
  const ground = (x, z) => Math.max(carpetTop(x, z), rockAt(x, z));
  out.ground = ground; out.inner = { x: iw, z: id, water: waterY };

  // broken stone chips around the bases, half buried in the carpet
  {
    const cg = buildStone(91, 3, { lean: 0.5, stretch: 1.3, layers: 4, slab: 0.8 });
    const NCH = 240, chips = new THREE.InstancedMesh(cg, rockMat, NCH), r = rng(808);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), pp = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    let k = 0, tries = 0;
    while (k < NCH && tries < 6000) {
      tries++;
      const rk = rocks[Math.floor(r() * rocks.length)], ang = r() * 6.283, rad = Math.max(rk[2], rk[4]) * (0.9 + Math.pow(r(), 1.7) * 1.0);
      const x = rk[0] + Math.cos(ang) * rad, z = rk[1] + Math.sin(ang) * rad * 0.8;
      if (Math.abs(x) > iw - 0.01 || Math.abs(z) > id - 0.01) continue;
      const sh = subH(x, z); if (rockAt(x, z) > sh + 0.003) continue;
      const size = 0.003 + Math.pow(r(), 2.4) * 0.013;
      eu.set(r() * 0.6, r() * 6.28, r() * 0.6); q.setFromEuler(eu);
      sc.set(size * (0.8 + r() * 0.5), size * (0.6 + r() * 0.5), size * (0.8 + r() * 0.5));
      pp.set(x, sh + carpetThick(x, z) * 0.45 + sc.y * 0.2, z); m4.compose(pp, q, sc); chips.setMatrixAt(k, m4);
      const vv = 0.85 + r() * 0.4; col.setRGB(vv, vv, vv); chips.setColorAt(k, col); k++;
    }
    chips.count = k; chips.castShadow = true; chips.receiveShadow = true; tank.add(chips);
  }

  // ---- Monte Carlo carpet: instanced sprigs, each a stem with a spiral of round leaves ----
  {
    const SH = 0.02;
    const sp = [], su = [], sH = [], sPh = [], sidx = [];
    const quad = (a, b, c, dd, uvs, hs, ph) => {
      const base = sp.length / 3;
      for (const v of [a, b, c, dd]) sp.push(v.x, v.y, v.z);
      su.push(...uvs); sH.push(...hs); for (let i = 0; i < 4; i++) sPh.push(ph);
      sidx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // stem: two crossed strips using the stem patch of the texture
    const sw = 0.00035, stUV = [0.01, 0.01, 0.08, 0.01, 0.08, 0.08, 0.01, 0.08];
    quad(V(-sw, 0, 0), V(sw, 0, 0), V(sw, SH * 0.92, 0), V(-sw, SH * 0.92, 0), stUV, [0, 0, 0.92, 0.92], 0);
    quad(V(0, 0, -sw), V(0, 0, sw), V(0, SH * 0.92, sw), V(0, SH * 0.92, -sw), stUV, [0, 0, 0.92, 0.92], 0);
    const NL = 7;
    for (let l = 0; l < NL; l++) {
      const t = l / (NL - 1), y = SH * lerp(0.42, 0.97, t), a = l * 2.4, size = 0.0036 * lerp(0.75, 1.15, t);
      const tilt = lerp(0.55, 0.15, t) + (hash1(l * 7.1) - 0.5) * 0.3;     // upper leaves lie flatter
      const out = V(Math.cos(a), 0, Math.sin(a)), side = V(-Math.sin(a), 0, Math.cos(a));
      const fwd = out.clone().multiplyScalar(Math.cos(tilt)).add(V(0, Math.sin(tilt), 0)).normalize();
      const b0 = V(0, y, 0).addScaledVector(out, 0.0003);
      const p0 = b0.clone().addScaledVector(side, -size / 2), p1 = b0.clone().addScaledVector(side, size / 2);
      const p2 = p1.clone().addScaledVector(fwd, size * 1.05), p3 = p0.clone().addScaledVector(fwd, size * 1.05);
      const hh = y / SH;
      quad(p0, p1, p2, p3, [0.12, 0.98, 0.88, 0.98, 0.88, 0.04, 0.12, 0.04], [hh, hh, hh + 0.05, hh + 0.05], hash1(l * 3.3) * 6.28);
    }
    const sprig = new THREE.BufferGeometry();
    sprig.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sprig.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
    sprig.setAttribute('aH', new THREE.Float32BufferAttribute(sH, 1));
    sprig.setAttribute('aPh', new THREE.Float32BufferAttribute(sPh, 1));
    sprig.setIndex(sidx); sprig.computeVertexNormals();
    // bend normals upward so the carpet reads as a soft, lit canopy
    const nn = sprig.attributes.normal; for (let i = 0; i < nn.count; i++) { const ny = Math.abs(nn.getY(i)) + 0.6; nn.setXYZ(i, nn.getX(i) * 0.5, ny, nn.getZ(i) * 0.5); }
    sprig.normalizeNormals();

    const motionOpts = {
      key: 'carpet', vertexHead: 'attribute float aH; attribute float aPh; varying float vH;\n', local: 'vH = aH;',
      motion: `
        float ph = dot(instO.xz, vec2(11.0, 3.0)) - uTime * 0.75;
        float gust = 0.55 + 0.45 * sin(ph) * sin(ph * 0.37 + 1.3);
        vec2 f = uFlow * 0.0016 * gust + vec2(sin(uTime * 1.6 + aPh + instO.x * 40.0), cos(uTime * 1.25 + aPh * 1.3 + instO.z * 40.0)) * 0.00028;
        float hk = aH * aH;
        wpos.xz += f * hk;
        wpos.y -= dot(f, f) * 160.0 * hk;`
    };
    const leafTex = carpetLeaf();
    const carpetMat = underwater(new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, envMapIntensity: 0.35 }),
      Object.assign({}, motionOpts, {
        caustic: 0.55, fragHead: 'varying float vH;\n',
        color: 'diffuseColor.rgb *= mix(0.22, 1.0, smoothstep(0.3, 1.0, vH));',
        post: 'outgoingLight += diffuseColor.rgb * 0.22 * smoothstep(0.5, 1.0, vH) * uWaterLight;'
      }));
    const NS = lowEnd ? 11000 : 27000;
    const carpet = new THREE.InstancedMesh(sprig, carpetMat, NS);
    carpet.customDepthMaterial = motionDepth(motionOpts, leafTex);
    const r = rng(5), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pp = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
    let k = 0, tries = 0;
    while (k < NS && tries < NS * 3) {
      tries++;
      const x = (r() * 2 - 1) * (iw - 0.0015), z = (r() * 2 - 1) * (id - 0.0015);
      const sh = subH(x, z); if (rockAt(x, z) > sh + 0.002) continue;
      const top = sh + carpetThick(x, z), layer = r();
      const s = 0.8 + r() * 0.45;
      const topY = top - (layer < 0.55 ? r() * 0.003 : 0.004 + r() * 0.007);
      q.setFromAxisAngle(Y, r() * 6.283);
      const lean = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.35, 0, (r() - 0.5) * 0.35)); q.premultiply(lean);
      sc.set(s, s, s); pp.set(x, topY - SH * s * 0.97, z);
      m4.compose(pp, q, sc); carpet.setMatrixAt(k, m4);
      const depthK = clamp((topY - sh) / (top - sh + 1e-4), 0, 1);
      col.setHSL(0.255 + r() * 0.03 - (1 - depthK) * 0.02, 0.85 + r() * 0.15, 0.24 + 0.16 * depthK + r() * 0.05);
      carpet.setColorAt(k, col); k++;
    }
    carpet.count = k; carpet.receiveShadow = true; carpet.castShadow = false; carpet.frustumCulled = false; tank.add(carpet);
    out.carpet = carpet;
  }

  // ---- water surface (reflects from above, silvers out from below at grazing angles) ----
  const wn = waterNormalTex();
  const surfU = { tN: { value: wn }, uTime: WU.uTime, uLight: WU.uWaterLight };
  const surfMat = new THREE.ShaderMaterial({
    uniforms: surfU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D tN; uniform float uTime; uniform float uLight; varying vec2 vUv; varying vec3 vW;
      void main(){
        vec2 uv = vUv * vec2(3.0, 1.3);
        vec3 n1 = texture2D(tN, uv + vec2(uTime * 0.018, uTime * 0.007)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(tN, uv * 1.7 - vec2(uTime * 0.011, -uTime * 0.013)).xyz * 2.0 - 1.0;
        vec3 n = normalize(vec3((n1.xy + n2.xy) * 0.35, 1.0)).xzy;
        vec3 v = normalize(cameraPosition - vW);
        float below = step(cameraPosition.y, vW.y);
        vec3 nn = below > 0.5 ? -n : n;
        float cosv = abs(dot(nn, v));
        float fres = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
        vec3 L = normalize(vec3(0.1, 1.0, 0.25));
        float spec = pow(max(dot(reflect(-L, n), v), 0.0), 180.0) * (1.0 - below);
        vec3 sky = vec3(0.92, 0.98, 0.96) * uLight;
        float tir = below * smoothstep(0.35, 0.12, cosv);
        float a = mix(0.05 + fres * 0.8, 0.9, tir) + spec;
        vec3 c = mix(sky, vec3(0.78, 0.88, 0.84) * uLight, tir) + spec * 2.0;
        gl_FragColor = vec4(c, clamp(a, 0.0, 0.95));
        #include <colorspace_fragment>
      }`
  });
  const surf = add(new THREE.PlaneGeometry(iw * 2, id * 2, 1, 1), surfMat, 0, waterY, 0, 25);
  surf.rotation.x = -Math.PI / 2; surf.userData.noDepth = true;
  // meniscus where the surface meets the glass
  const menM = new THREE.MeshBasicMaterial({ color: 0xeefaf6, transparent: true, opacity: 0.5, depthWrite: false });
  add(B(iw * 2, 0.0016, 0.0006), menM, 0, waterY - 0.0006, id - 0.0004, 26).userData.noDepth = true;
  add(B(iw * 2, 0.0016, 0.0006), menM, 0, waterY - 0.0006, -id + 0.0004, 26).userData.noDepth = true;
  for (const sx of [-1, 1]) add(B(0.0006, 0.0016, id * 2), menM, sx * (iw - 0.0004), waterY - 0.0006, 0, 26).userData.noDepth = true;

  // ---- glassware: lily pipe outflow, slotted inflow, CO2 diffuser, tubing ----
  const glassW = new THREE.MeshPhysicalMaterial({ color: 0xf2fffb, roughness: 0.03, transparent: true, opacity: 0.16, envMapIntensity: 0.7, depthWrite: false, specularIntensity: 1, side: THREE.DoubleSide });
  const tubeAt = (pts, r, m, segs = 60) => { const c = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'centripetal'); const o = add(new THREE.TubeGeometry(c, segs, r, 14, false), m, 0, 0, 0, 27); o.userData.noDepth = m.transparent; return o; };
  // outflow: over the back rim, down, then the lily bell facing left just under the surface
  tubeAt([[0.37, h + 0.07, -hd - 0.03], [0.37, h + 0.035, -hd - 0.012], [0.37, h + 0.02, -hd + 0.01], [0.37, waterY + 0.01, -hd + 0.03], [0.37, waterY - 0.035, -hd + 0.035], [0.355, waterY - 0.045, -hd + 0.04], [0.335, waterY - 0.045, -hd + 0.042]], 0.0062, glassW);
  const lily = add(new THREE.LatheGeometry([0.0062, 0.0075, 0.01, 0.014, 0.019].map((rr, i) => new THREE.Vector2(rr, i * 0.006)), 28), glassW, 0.335, waterY - 0.045, -hd + 0.042, 27);
  lily.rotation.z = Math.PI / 2; lily.userData.noDepth = true;
  // inflow: vertical with a slotted strainer near the soil
  tubeAt([[0.395, h + 0.07, -hd - 0.03], [0.395, h + 0.035, -hd - 0.012], [0.395, h + 0.02, -hd + 0.012], [0.395, 0.17, -hd + 0.02], [0.395, 0.13, -hd + 0.02]], 0.0062, glassW);
  {
    const sc = canvas(64, 256), sx = sc.getContext('2d'); sx.fillStyle = '#fff'; sx.fillRect(0, 0, 64, 256); sx.fillStyle = '#000';
    for (let i = 0; i < 8; i++) sx.fillRect(i * 8 + 2, 20, 3, 216);
    const strainerM = new THREE.MeshPhysicalMaterial({ color: 0xf2fffb, roughness: 0.05, transparent: true, opacity: 0.45, alphaMap: tex(sc, false, true), envMapIntensity: 2, depthWrite: false, side: THREE.DoubleSide });
    strainerM.alphaMap.repeat.set(4, 1);
    add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.075, 32, 1, false), strainerM, 0.395, 0.095, -hd + 0.02, 27).userData.noDepth = true;
  }
  // CO2: tube down the left inside wall, U bend, glass diffuser with ceramic disc and red cap
  const dPos = new THREE.Vector3(-iw + 0.03, 0.15, id - 0.035);
  tubeAt([[-hw - 0.02, h + 0.06, id - 0.02], [-hw + 0.004, h + 0.02, id - 0.02], [-iw + 0.006, h - 0.02, id - 0.022], [-iw + 0.006, dPos.y - 0.03, id - 0.024], [-iw + 0.012, dPos.y - 0.045, id - 0.028], [dPos.x - 0.008, dPos.y - 0.045, dPos.z], [dPos.x, dPos.y - 0.03, dPos.z], [dPos.x, dPos.y - 0.012, dPos.z]], 0.0028, glassW);
  add(new THREE.CylinderGeometry(0.009, 0.009, 0.022, 32, 1, true), glassW, dPos.x, dPos.y, dPos.z, 27).userData.noDepth = true;
  const disc = add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.0025, 32), underwater(new THREE.MeshStandardMaterial({ color: 0xf1f0ea, roughness: 0.95 }), { key: 'plain', caustic: 0.3 }), dPos.x, dPos.y + 0.0105, dPos.z);
  const cap = add(new THREE.CylinderGeometry(0.0098, 0.0098, 0.004, 32, 1, true), underwater(new THREE.MeshStandardMaterial({ color: 0x8a2a1c, roughness: 0.55 }), { key: 'plain', caustic: 0.3 }), dPos.x, dPos.y + 0.0105, dPos.z);
  // suction cups
  for (const [x, y, z, ry] of [[-iw + 0.003, dPos.y, dPos.z - 0.0, Math.PI / 2], [0.395, 0.2, -id + 0.003, 0], [0.37, waterY - 0.08, -id + 0.003, 0]]) {
    const c = add(new THREE.CylinderGeometry(0.0075, 0.0045, 0.006, 24), new THREE.MeshPhysicalMaterial({ color: 0xf6f8f6, roughness: 0.4, transparent: true, opacity: 0.6, depthWrite: false }), x, y, z, 27);
    c.rotation.set(Math.PI / 2, ry, 0); c.userData.noDepth = true;
  }
  // black pump hose up to the plant shelf (the aquarium feeds the hydro tray)
  const hoseM = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.4 });
  tubeAt([[0.37, h + 0.07, -hd - 0.03], [0.37, h + 0.1, -hd - 0.045], [0.3, h + 0.13, -hd - 0.05], [0.25, 0.505 - 0.02, -hd - 0.04]], 0.0072, hoseM).castShadow = true;
  tubeAt([[0.395, h + 0.07, -hd - 0.03], [0.4, h + 0.1, -hd - 0.05], [0.41, h + 0.12, -hd - 0.06], [0.415, 0.505 - 0.015, -hd - 0.06]], 0.0072, hoseM).castShadow = true;

  // ---- tank lighting: LED bar under the plant shelf, soft area light + two shadow casters ----
  const ledY = -TK.y0 - 0.022;   // just under the plant shelf, in tank-local coordinates
  for (const z of [0.07, -0.06]) {
    const alu = new THREE.Mesh(B(0.8, 0.01, 0.026), new THREE.MeshPhysicalMaterial({ color: 0x8e9498, roughness: 0.3, metalness: 0.9 }));
    alu.position.set(0, ledY + 0.006, z); tank.add(alu);
    const dm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.98, 1).multiplyScalar(6), toneMapped: false });
    const diff = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.014), dm); diff.rotation.x = Math.PI / 2; diff.position.set(0, ledY, z); tank.add(diff);
    out.emissive.push(dm);
    const ra = new THREE.RectAreaLight(0xf3f8ff, 3.2, 0.78, 0.02); ra.position.set(0, ledY - 0.002, z); ra.lookAt(0, -1, z); tank.add(ra);
    out.lights.push({ light: ra, base: 3.2 });
  }
  for (const x of [-0.2, 0.2]) {
    const s = new THREE.SpotLight(0xf6faff, 0, 1.0, 1.1, 0.9, 1.1);
    s.position.set(x, ledY - 0.004, 0.0); s.target.position.set(x * 0.8, 0, 0); tank.add(s, s.target);
    s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.camera.near = 0.05; s.shadow.camera.far = 0.8; s.shadow.bias = -0.0004; s.shadow.normalBias = 0.004; s.shadow.radius = 5;
    out.lights.push({ light: s, base: 1.4 });
  }

  // ---- bubbles: carpet + stone pearling, CO2 mist, outflow micro-bubbles, suspended specks ----
  {
    const MAX = lowEnd ? 1500 : 2600, pos = new Float32Array(MAX * 3), aSize = new Float32Array(MAX), aAlpha = new Float32Array(MAX), Bb = [];
    for (let i = 0; i < MAX; i++) Bb.push({ alive: false });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    const U = { uTex: { value: bubbleTex() }, uScale: { value: 600 }, uLight: WU.uWaterLight };
    const mat = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          float px = aSize * uScale / max(0.02, -mv.z); gl_PointSize = max(1.2, px); vA = aAlpha * clamp(px / 1.2, 0.25, 1.0); }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uLight; varying float vA;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord); float a = t.a * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.95, 1.0, 0.98) * (0.6 + 0.4 * uLight), a); }`
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 26; tank.add(pts);
    const rb = rng(77), lilyOut = new THREE.Vector3(0.315, waterY - 0.045, -hd + 0.042), diffTop = dPos.clone().add(new THREE.Vector3(0, 0.012, 0));
    let cursor = 0; const acc = [0, 0, 0, 0]; let photo = -1;
    const spawn = (type) => {
      for (let nn = 0; nn < MAX; nn++) {
        cursor = (cursor + 1) % MAX; const b = Bb[cursor]; if (b.alive) continue;
        b.alive = true; b.type = type; b.age = 0; b.ph = rb() * 6.28; b.wob = 0.0005 + rb() * 0.001; b.vx = 0; b.vy = 0; b.vz = 0; b.cling = 0;
        if (type === 0) {          // pearl on a carpet leaf or stone face: swells, then lets go
          let x, z, onRock = rb() < 0.25, tries = 0;
          do { x = (rb() * 2 - 1) * (iw - 0.01); z = (rb() * 2 - 1) * (id - 0.01); tries++; } while (onRock ? rockAt(x, z) < subH(x, z) + 0.01 && tries < 20 : rockAt(x, z) > subH(x, z) + 0.004 && tries < 8);
          b.x = x; b.z = z; b.y = onRock ? rockAt(x, z) - rb() * 0.03 : carpetTop(x, z) - rb() * 0.006;
          if (onRock) { b.z += 0.006; }
          b.cling = 2 + rb() * 8; b.s0 = 0.0006 + rb() * 0.0005; b.s1 = b.s0 * (1.6 + rb() * 0.9);
        } else if (type === 1) {   // CO2 mist off the diffuser
          b.x = diffTop.x + (rb() - 0.5) * 0.012; b.y = diffTop.y; b.z = diffTop.z + (rb() - 0.5) * 0.012;
          b.vx = 0.01 + rb() * 0.02; b.vy = 0.01 + rb() * 0.02; b.s0 = b.s1 = 0.0003 + rb() * 0.0004;
        } else if (type === 2) {   // micro-bubbles thrown out by the lily pipe
          b.x = lilyOut.x; b.y = lilyOut.y + (rb() - 0.5) * 0.01; b.z = lilyOut.z + (rb() - 0.5) * 0.01;
          b.vx = -0.12 - rb() * 0.1; b.vy = (rb() - 0.5) * 0.02; b.vz = rb() * 0.06; b.s0 = b.s1 = 0.0003 + rb() * 0.0004;
        } else {                   // tiny suspended specks drifting in the current
          b.x = (rb() * 2 - 1) * iw; b.y = 0.08 + rb() * (waterY - 0.1); b.z = (rb() * 2 - 1) * id; b.s0 = b.s1 = 0.00018 + rb() * 0.0002; b.life = 20 + rb() * 30;
        }
        return;
      }
    };
    for (let i = 0; i < 700; i++) spawn(3);
    out.updateBubbles = (dt, t, light) => {
      dt = Math.min(dt, 0.05);
      if (photo < 0) photo = light;
      photo += (light - photo) * Math.min(1, dt / 40);
      acc[0] += dt * 46 * photo; acc[1] += dt * 60 * light; acc[2] += dt * 30; acc[3] += dt * 18;
      for (let ty = 0; ty < 4; ty++) while (acc[ty] >= 1) { acc[ty]--; spawn(ty); }
      for (let i = 0; i < MAX; i++) {
        const b = Bb[i]; if (!b.alive) { aAlpha[i] = 0; continue; }
        b.age += dt; let size = b.s1;
        // current: along the top right-to-left, back along the bottom
        const fy = (b.y / waterY) * 2 - 1, cx = -0.035 * fy, cz = 0.006 * Math.sin(b.x * 6 + t * 0.2);
        if (b.age < b.cling) size = lerp(b.s0, b.s1, b.age / b.cling);
        else {
          const rise = b.type === 3 ? 0.002 : 0.022 + size * 42;
          b.vy += (rise - b.vy) * Math.min(1, dt * 2.5);
          const drag = Math.exp(-dt * 2.0);
          b.vx = b.vx * drag + cx * (1 - drag); b.vz = b.vz * drag + cz * (1 - drag);
          b.x += b.vx * dt + Math.sin(t * 9 + b.ph) * b.wob * dt * 7;
          b.y += b.vy * dt + (b.type === 3 ? Math.sin(t * 0.7 + b.ph) * 0.0006 * dt : 0);
          b.z += b.vz * dt + Math.cos(t * 7 + b.ph) * b.wob * dt * 7;
          if (Math.abs(b.x) > iw - 0.002) { b.x = Math.sign(b.x) * (iw - 0.002); b.vx *= -0.4; }
          if (Math.abs(b.z) > id - 0.002) { b.z = Math.sign(b.z) * (id - 0.002); b.vz *= -0.4; }
        }
        if (b.y > waterY - 0.0015 || b.age > (b.life || 40)) { b.alive = false; aAlpha[i] = 0; if (b.type === 3) spawn(3); continue; }
        pos[i * 3] = b.x; pos[i * 3 + 1] = b.y; pos[i * 3 + 2] = b.z; aSize[i] = size;
        aAlpha[i] = (b.type === 0 ? 0.95 : b.type === 3 ? 0.5 : 0.75) * smooth(0, 0.3, b.age + (b.type === 0 ? 1 : 0)) * (b.type === 3 ? smooth(0, 3, b.life - b.age) : 1);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true;
    };
    out.resizeBubbles = (camera, renderer) => { U.uScale.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5]; };
  }

  // ---- soft light shafts in the water ----
  {
    const c = canvas(64, 256), x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 256);
    const hx = x.createLinearGradient(0, 0, 64, 0); hx.addColorStop(0, 'rgba(0,0,0,1)'); hx.addColorStop(0.5, 'rgba(0,0,0,0)'); hx.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = hx; x.fillRect(0, 0, 64, 256);
    const st = tex(c, false, false), shafts = [], r = rng(31);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.MeshBasicMaterial({ map: st, color: 0xf0fbf6, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const s = add(new THREE.PlaneGeometry(0.03 + r() * 0.05, waterY - 0.06), m, -0.35 + i * 0.14 + r() * 0.04, (waterY + 0.06) / 2, -0.06 + r() * 0.1, 24);
      s.rotation.z = 0.12 + r() * 0.06; s.userData.noDepth = true; shafts.push({ m, ph: r() * 6.28, sp: 0.15 + r() * 0.2 });
    }
    out.updateShafts = (t, light) => { for (const s of shafts) s.m.opacity = (0.025 + 0.03 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph))) * light; };
  }

  out.fish = buildFish(tank, out);
  out.shrimp = buildShrimp(tank, out);
  out.update = (dt, t, light) => {
    WU.uTime.value = t; WU.uWaterLight.value = 0.1 + 0.9 * light; WU.uCaustic.value = 0.05 + 0.75 * light;
    for (const L of out.lights) L.light.intensity = L.base * light;
    for (const m of out.emissive) m.color.setRGB(0.95, 0.98, 1).multiplyScalar(0.2 + 5.8 * light);
    backdropMat.color.setScalar(0.12 + 1.38 * light);
    out.fish.update(dt, t); out.shrimp.update(dt, t); out.updateBubbles(dt, t, light); out.updateShafts(t, light);
  };
  return out;
}

// ---------------------------------------------------------------- neon tetras
function buildFish(tank, aq) {
  const N = 26;
  const body = new THREE.SphereGeometry(1, 20, 12); body.rotateX(Math.PI / 2);
  const p = body.attributes.position, uv = body.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = z < 0 ? 0.32 + 0.68 * Math.pow(1 + z, 0.8) : 1 - 0.28 * z * z, belly = y < 0 ? 1.08 : 0.92;
    uv.setXY(i, (z + 1) / 2, (y + 1) / 2);
    p.setXYZ(i, x * f * 0.0016, y * f * 0.0029 * belly, z * 0.0098);
  }
  body.computeVertexNormals();
  const bn = body.toNonIndexed();
  const pos = Array.from(bn.attributes.position.array), nor = Array.from(bn.attributes.normal.array), uvs = Array.from(bn.attributes.uv.array), fin = new Array(pos.length / 3).fill(0);
  const tri = (a, b, c) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) { nor.push(1, 0, 0); uvs.push(0.03, 0.62); fin.push(1); } };
  tri([0, 0.0003, -0.008], [0, 0.0036, -0.0168], [0, 0.0005, -0.0136]);
  tri([0, -0.0003, -0.008], [0, -0.0005, -0.0136], [0, -0.0036, -0.0168]);
  tri([0, 0.0025, -0.0005], [0, 0.0054, -0.0035], [0, 0.0024, -0.0042]);
  tri([0, -0.0024, -0.002], [0, -0.0044, -0.0055], [0, -0.0017, -0.0075]);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setAttribute('aFin', new THREE.Float32BufferAttribute(fin, 1));
  const aPhase = new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage);
  const aAmp = new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPhase', aPhase); geo.setAttribute('aAmp', aAmp);
  const tx = neonTex();
  const mat = underwater(new THREE.MeshPhysicalMaterial({ map: tx.map, emissive: 0x3fbfff, emissiveMap: tx.emissive, emissiveIntensity: 0.5, roughness: 0.3, clearcoat: 0.6, iridescence: 0.4, side: THREE.DoubleSide, transparent: false }), {
    key: 'fish', caustic: 0.35, vertexHead: 'attribute float aPhase; attribute float aAmp; attribute float aFin; varying float vFin;\n',
    local: `float bend = smoothstep(0.004, -0.017, position.z); transformed.x += sin(aPhase - position.z * 240.0) * 0.0021 * bend * aAmp; vFin = aFin;`,
    fragHead: 'varying float vFin;\n', color: 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.8, 0.78), vFin * 0.5);'
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.frustumCulled = false; tank.add(mesh);
  const r = rng(31), I = aq.inner, fish = [];
  for (let i = 0; i < N; i++) fish.push({ p: new THREE.Vector3(0.1 + (r() - 0.5) * 0.2, 0.24 + (r() - 0.5) * 0.05, (r() - 0.5) * 0.15), v: new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize().multiplyScalar(0.04), phase: r() * 6.28, pers: 0.85 + r() * 0.3, size: 0.85 + r() * 0.3 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), zero = new THREE.Vector3(), tgt = new THREE.Vector3();
  const acc = new THREE.Vector3(), sep = new THREE.Vector3(), ali = new THREE.Vector3(), coh = new THREE.Vector3(), d = new THREE.Vector3(), goal = new THREE.Vector3();
  function update(dt, t) {
    dt = Math.min(dt, 0.05);
    goal.set(0.26 * Math.sin(t * 0.045) + 0.1 * Math.sin(t * 0.11), 0.25 + 0.04 * Math.sin(t * 0.07), 0.07 * Math.sin(t * 0.06 + 1));
    for (let i = 0; i < N; i++) {
      const f = fish[i]; acc.set(0, 0, 0); sep.set(0, 0, 0); ali.set(0, 0, 0); coh.set(0, 0, 0); let n = 0;
      for (let j = 0; j < N; j++) {
        if (i === j) continue; d.subVectors(f.p, fish[j].p); const dist = d.length();
        if (dist < 0.022) sep.addScaledVector(d, 1 / Math.max(dist * dist, 1e-5));
        if (dist < 0.1) { ali.add(fish[j].v); coh.add(fish[j].p); n++; }
      }
      acc.addScaledVector(sep, 0.0009);
      if (n) { ali.divideScalar(n).sub(f.v).multiplyScalar(0.9); coh.divideScalar(n).sub(f.p).multiplyScalar(0.7); acc.add(ali).add(coh); }
      d.subVectors(goal, f.p); acc.addScaledVector(d, 0.35);
      const m = 0.045;
      if (f.p.x > I.x - m) acc.x -= (f.p.x - (I.x - m)) * 30; if (f.p.x < -I.x + m) acc.x += (-I.x + m - f.p.x) * 30;
      if (f.p.z > I.z - m) acc.z -= (f.p.z - (I.z - m)) * 30; if (f.p.z < -I.z + m) acc.z += (-I.z + m - f.p.z) * 30;
      const gy = aq.ground(f.p.x, f.p.z) + 0.03; if (f.p.y < gy) acc.y += (gy - f.p.y) * 40;
      if (f.p.y > I.water - 0.02) acc.y -= (f.p.y - (I.water - 0.02)) * 40;
      if (aq.ground(f.p.x + f.v.x * 0.6, f.p.z + f.v.z * 0.6) + 0.02 > f.p.y) { acc.y += 0.25; acc.x -= f.v.x * 1.5; acc.z -= f.v.z * 1.5; }
      acc.x += noise3(t * 0.5, i, 0) * 0.08; acc.z += noise3(t * 0.5, i, 4) * 0.08;
      acc.clampLength(0, 0.35); f.v.addScaledVector(acc, dt); f.v.y *= 0.96;
      const sp = f.v.length(), maxS = 0.1 * f.pers; if (sp > maxS) f.v.multiplyScalar(maxS / sp); else if (sp < 0.022) f.v.multiplyScalar(0.022 / Math.max(sp, 1e-5));
      f.p.addScaledVector(f.v, dt);
      const spd = f.v.length(); f.phase += dt * (14 + spd * 260);
      aPhase.array[i] = f.phase; aAmp.array[i] = 0.5 + spd * 12;
      tgt.copy(f.v).normalize().negate(); m4.lookAt(zero, tgt, up); q.setFromRotationMatrix(m4); s.setScalar(f.size);
      m4.compose(f.p, q, s); mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true; aPhase.needsUpdate = true; aAmp.needsUpdate = true;
  }
  return { mesh, update, count: N };
}

// ---------------------------------------------------------------- cherry shrimp
function buildShrimp(tank, aq) {
  const N = 24, pos = [], nor = [], col = [], part = [];
  const addG = (geo, mtx, c, pt) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(mtx);
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    for (let i = 0; i < pa.length; i += 3) { pos.push(pa[i], pa[i + 1], pa[i + 2]); nor.push(na[i], na[i + 1], na[i + 2]); col.push(c[0], c[1], c[2]); part.push(pt); }
  };
  const M = (x, y, z, sx, sy, sz, rx, ry, rz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx, sy, sz));
  const sph = new THREE.SphereGeometry(1, 14, 10), red = [0.8, 0.06, 0.04], deep = [0.6, 0.03, 0.03], pale = [0.88, 0.3, 0.24];
  addG(sph, M(0, 0.0036, 0.0042, 0.0028, 0.003, 0.0048), red, 0);
  [[0.0004, 0.0037, 0.0026, 0.0028], [-0.0024, 0.0035, 0.0024, 0.0026], [-0.005, 0.0031, 0.0021, 0.0023], [-0.0074, 0.0026, 0.0017, 0.0019], [-0.0093, 0.002, 0.0013, 0.0015]]
    .forEach(([z, y, w, hh], i) => addG(sph, M(0, y, z, w, hh, 0.0017, 0.15 * i, 0, 0), i % 2 ? red : deep, 0));
  const fan = new THREE.ConeGeometry(1, 1, 3); fan.scale(1, 1, 0.12);
  for (const a of [-0.5, 0, 0.5]) addG(fan, M(0, 0.0017, -0.0118, 0.0013, 0.0034, 0.0013, Math.PI / 2 + 0.25, 0, a), pale, 0);
  addG(new THREE.ConeGeometry(1, 1, 6), M(0, 0.0043, 0.0098, 0.00045, 0.0035, 0.00045, Math.PI / 2 - 0.15, 0, 0), red, 0);
  for (const sx of [-1, 1]) addG(sph, M(sx * 0.0017, 0.0044, 0.0083, 0.0006, 0.0006, 0.0006), [0.02, 0.02, 0.02], 0);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 4, 6);
  for (const sx of [-1, 1]) {
    const m = new THREE.Matrix4().makeTranslation(0, 0.5, 0);
    m.premultiply(new THREE.Matrix4().makeScale(0.00012, 0.019, 0.00012)); m.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.25, 0, -sx * 0.45))); m.premultiply(new THREE.Matrix4().makeTranslation(sx * 0.0008, 0.0042, 0.0088));
    addG(cyl, m, pale, 2);
  }
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) {
    const m = new THREE.Matrix4().makeTranslation(0, -0.5, 0);
    m.premultiply(new THREE.Matrix4().makeScale(0.00018, 0.0042, 0.00018)); m.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.1 - i * 0.08, 0, sx * 0.75))); m.premultiply(new THREE.Matrix4().makeTranslation(sx * 0.0012, 0.0026, 0.0068 - i * 0.0016));
    addG(cyl, m, pale, 1);
  }
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) addG(cyl, M(sx * 0.0008, 0.0012, -0.001 - i * 0.0022, 0.00022, 0.0018, 0.00022, 0.3, 0, sx * 0.2), pale, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  const aLeg = new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage);
  const aWalk = new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage);
  const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  geo.setAttribute('aLeg', aLeg); geo.setAttribute('aWalk', aWalk); geo.setAttribute('aSeed', aSeed);
  const mat = underwater(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, clearcoat: 0.8, emissive: 0x2a0402 }), {
    key: 'shrimp', caustic: 0.4, vertexHead: 'attribute float aPart; attribute float aLeg; attribute float aWalk; attribute float aSeed;\n',
    local: `
      if (aPart > 0.5 && aPart < 1.5) {
        float side = sign(position.x);
        transformed.z += sin(aLeg + position.z * 1800.0 + side * 1.7) * 0.0011 * aWalk * clamp((0.003 - position.y) / 0.003, 0.0, 1.0);
        transformed.y += max(0.0, sin(aLeg + position.z * 1800.0 + side * 1.7 + 1.57)) * 0.0006 * aWalk;
        transformed.z += sin(uTime * 9.0 + aSeed + position.z * 2000.0) * 0.0003 * step(position.z, 0.0);
      }
      if (aPart > 1.5) {
        float k = clamp((position.z - 0.009) / 0.016, 0.0, 1.0);
        transformed.x += sin(uTime * 2.2 + aSeed + k * 3.0) * 0.003 * k;
        transformed.y += cos(uTime * 1.7 + aSeed * 1.3) * 0.002 * k;
      }`
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.frustumCulled = false; tank.add(mesh);
  const r = rng(55), I = aq.inner, list = [], c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    list.push({ x: (r() * 2 - 1) * (I.x - 0.03), z: (r() * 2 - 1) * (I.z - 0.03), yOff: 0, h: r() * 6.28, state: 'graze', timer: r() * 4, sp: 0, legs: 0, size: 0.8 + r() * 0.35, vy: 0 });
    aSeed.array[i] = r() * 10; c.setHSL(0.995 + r() * 0.02, 0.8 + r() * 0.15, 0.62 + r() * 0.3); mesh.setColorAt(i, c);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), n = new THREE.Vector3(), fwd = new THREE.Vector3(), xa = new THREE.Vector3(), p3 = new THREE.Vector3(), sc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function update(dt, t) {
    dt = Math.min(dt, 0.05);
    for (let i = 0; i < N; i++) {
      const s = list[i]; s.timer -= dt;
      if (s.timer <= 0) {
        const roll = r();
        if (s.state === 'swim') { s.state = 'graze'; s.timer = 2 + r() * 5; }
        else if (roll < 0.06) { s.state = 'swim'; s.timer = 1.2 + r() * 1.5; s.vy = 0.05 + r() * 0.04; }
        else if (roll < 0.55) { s.state = 'walk'; s.timer = 1 + r() * 3; s.turn = (r() - 0.5) * 1.2; }
        else { s.state = 'graze'; s.timer = 2 + r() * 6; }
      }
      let target = 0, walk = 0;
      if (s.state === 'walk') { target = 0.009; walk = 1; s.h += s.turn * dt; }
      else if (s.state === 'graze') { walk = 0.35; s.h += Math.sin(t * 1.3 + i) * 0.15 * dt; }
      else { target = 0.03; walk = 0.6; }
      s.sp = lerp(s.sp, target, Math.min(1, dt * 4));
      let nx = s.x + Math.sin(s.h) * s.sp * dt, nz = s.z + Math.cos(s.h) * s.sp * dt;
      if (Math.abs(nx) > I.x - 0.012 || Math.abs(nz) > I.z - 0.012) { s.h += Math.PI * (0.6 + r() * 0.4); nx = s.x; nz = s.z; }
      if (s.state !== 'swim' && aq.ground(nx, nz) - aq.ground(s.x, s.z) > 0.02) { s.h += 1.5; nx = s.x; nz = s.z; }
      s.x = nx; s.z = nz;
      if (s.state === 'swim') { s.yOff += s.vy * dt; s.vy -= 0.06 * dt; if (s.yOff < 0) s.yOff = 0; } else s.yOff = Math.max(0, s.yOff - dt * 0.03);
      s.legs += dt * (walk * 14 + 2); aLeg.array[i] = s.legs; aWalk.array[i] = walk;
      const e = 0.006, g0 = aq.ground(s.x, s.z);
      n.set(aq.ground(s.x - e, s.z) - aq.ground(s.x + e, s.z), 2 * e, aq.ground(s.x, s.z - e) - aq.ground(s.x, s.z + e)).normalize();
      if (s.yOff > 0.003) n.lerp(UP, 0.7).normalize();
      fwd.set(Math.sin(s.h), 0, Math.cos(s.h)); fwd.addScaledVector(n, -fwd.dot(n)).normalize(); xa.crossVectors(n, fwd);
      m4.makeBasis(xa, n, fwd); q.setFromRotationMatrix(m4);
      p3.set(s.x, g0 + s.yOff - 0.002, s.z); sc.setScalar(s.size); m4.compose(p3, q, sc); mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true; aLeg.needsUpdate = true; aWalk.needsUpdate = true;
  }
  return { mesh, update, count: N };
}
