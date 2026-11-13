// One cabinet compartment: black frame, glass, fabric back panel, LED bar with soft area light,
// hydro tray filled with LECA, and a little round hygrometer.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export const SH = { W: 0.94, D: 0.44, H: 0.42, trayW: 0.84, trayD: 0.28, trayH: 0.065, trayZ: -0.02 };

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function noise2(seed) {
  const p = new Uint8Array(512), r = mulberry(seed);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 256; i++) p[256 + i] = p[i];
  const g = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  const f = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = f(x), v = f(y), a = p[X] + Y, b = p[X + 1] + Y;
    const l = (A, B, t) => A + (B - A) * t;
    return l(l(g(p[a], x, y), g(p[b], x - 1, y), u), l(g(p[a + 1], x, y - 1), g(p[b + 1], x - 1, y - 1), u), v);
  };
}
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function heightToNormal(h, S, strength, wrap) {
  const out = canvas(S), x = out.getContext('2d'), img = x.createImageData(S, S), d = img.data;
  const H = (i, j) => h[((j + S) % S) * S + ((i + S) % S)];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = (H(i + 1, j) - H(i - 1, j)) * strength, dy = (H(i, j + 1) - H(i, j - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz);
    const k = (j * S + i) * 4; d[k] = (nx / l * 0.5 + 0.5) * 255; d[k + 1] = (ny / l * 0.5 + 0.5) * 255; d[k + 2] = (nz / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out); if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// porous fired-clay texture for LECA
function lecaTextures() {
  const S = 256, n = noise2(5), r = mulberry(9), h = new Float32Array(S * S);
  const c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const v = 0.25 * n(i / 30, j / 30) + 0.08 * n(i / 6, j / 6) + 0.05 * n(i / 2, j / 2);
    h[j * S + i] = v;
  }
  for (let k = 0; k < 1100; k++) {          // pores
    const cx = r() * S, cy = r() * S, rad = 0.6 + r() * 1.6;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
      const dd = Math.hypot(i, j); if (dd > rad) continue;
      const ii = (Math.floor(cx) + i + S) % S, jj = (Math.floor(cy) + j + S) % S;
      h[jj * S + ii] -= 0.6 * (1 - dd / rad);
    }
  }
  for (let k = 0; k < S * S; k++) {
    const v = h[k], t = Math.max(0, Math.min(1, 0.55 + v * 0.45));
    d[k * 4] = 100 * t + 62; d[k * 4 + 1] = 68 * t + 42; d[k * 4 + 2] = 54 * t + 34; d[k * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return { map, normalMap: heightToNormal(h, S, 3.5, true) };
}

function fabricTextures() {
  const S = 512, n = noise2(11), h = new Float32Array(S * S);
  const c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const weave = Math.sin(i * 1.6) * 0.5 + Math.sin(j * 1.6) * 0.5;
    const v = weave * 0.25 + n(i / 40, j / 40) * 0.5 + (Math.random() - 0.5) * 0.4;
    h[j * S + i] = v;
    const k = (j * S + i) * 4, g = 22 + v * 6;
    d[k] = g; d[k + 1] = g + 1; d[k + 2] = g + 1; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return { map, normalMap: heightToNormal(h, S, 1.2, true) };
}

export function buildShelf(scene) {
  RectAreaLightUniformsLib.init();
  const out = { lights: [], emissive: [], noDepth: [] };
  const { W, D, H } = SH, hw = W / 2, hd = D / 2;
  const g = new THREE.Group(); scene.add(g);
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x0d0e0f, roughness: 0.38, metalness: 0.6, envMapIntensity: 0.6 });
  const alu = new THREE.MeshPhysicalMaterial({ color: 0x8e9498, roughness: 0.3, metalness: 0.9, envMapIntensity: 0.8 });
  const box = (w, h, d, m, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };

  // frame
  const yb = -0.6;   // cabinet base: the aquarium bay sits below this shelf
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.02, H + 0.02 - yb, 0.02, metal, sx * (hw - 0.01), (H + 0.02 + yb) / 2, sz * (hd - 0.01));
  box(W, 0.02, D, metal, 0, H + 0.01, 0);
  box(W, 0.02, 0.02, metal, 0, -0.012, hd - 0.01);
  // fabric back panel
  const fab = fabricTextures(); fab.map.repeat.set(5, 2.5); fab.normalMap.repeat.set(5, 2.5);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, H + 0.02), new THREE.MeshStandardMaterial({ map: fab.map, normalMap: fab.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95, envMapIntensity: 0.15 }));
  back.position.set(0, H / 2, -hd + 0.012); back.receiveShadow = true; g.add(back);
  // glass shelf and side glass
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xdff3ee, roughness: 0.04, metalness: 0, transmission: 0, transparent: true, opacity: 0.07, envMapIntensity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  const shelf = box(W - 0.03, 0.008, D - 0.02, new THREE.MeshPhysicalMaterial({ color: 0x2d3a36, roughness: 0.08, transparent: true, opacity: 0.85, envMapIntensity: 0.35 }), 0, -0.004, 0);
  shelf.material.depthWrite = true;
  for (const sx of [-1, 1]) { const s = box(0.004, H, D - 0.03, glass, sx * (hw - 0.012), H / 2, 0); s.castShadow = false; s.renderOrder = 10; out.noDepth.push(s); s.userData.noDepth = true; }
  // aquarium bay: side glass, floor and plinth
  for (const sx of [-1, 1]) { const s = box(0.004, 0.5, D - 0.03, glass, sx * (hw - 0.012), -0.27, 0); s.castShadow = false; s.renderOrder = 10; out.noDepth.push(s); s.userData.noDepth = true; }
  box(W - 0.02, 0.012, D - 0.02, metal, 0, -0.514, 0);
  box(W, 0.08, D, metal, 0, -0.56, 0);
  box(W, 0.02, 0.02, metal, 0, -0.514, hd - 0.01);

  // LED bar: aluminium extrusion, diffuser that blooms, rect area light + two soft shadow casters
  const barY = H - 0.012;
  for (const z of [0.09, -0.07]) {
    box(0.84, 0.012, 0.03, alu, 0, barY, z);
    const dm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.96, 0.9).multiplyScalar(6), toneMapped: false });
    const diffuser = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.016), dm);
    diffuser.rotation.x = Math.PI / 2; diffuser.position.set(0, barY - 0.0065, z); g.add(diffuser);
    out.emissive.push(dm);
    const ra = new THREE.RectAreaLight(0xfff4e6, 2.4, 0.82, 0.02);
    ra.position.set(0, barY - 0.008, z); ra.lookAt(0, 0, z); g.add(ra);
    out.lights.push({ light: ra, base: 2.4 });
  }
  for (const x of [-0.2, 0.2]) {
    const sp = new THREE.SpotLight(0xfff2e2, 0, 1.4, 1.25, 1.0, 1.2);
    sp.position.set(x, barY - 0.01, 0.01); sp.target.position.set(x * 0.7, 0, 0); g.add(sp, sp.target);
    sp.castShadow = true; sp.shadow.mapSize.set(2048, 2048); sp.shadow.camera.near = 0.02; sp.shadow.camera.far = 0.8;
    sp.shadow.bias = -0.0004; sp.shadow.normalBias = 0.004; sp.shadow.radius = 6; sp.shadow.blurSamples = 16;
    out.lights.push({ light: sp, base: 0.7 });
  }

  // hydro tray with LECA
  const trayMat = new THREE.MeshPhysicalMaterial({ color: 0x0f1011, roughness: 0.55, clearcoat: 0.2, envMapIntensity: 0.4 });
  const { trayW: tw, trayD: td, trayH: th, trayZ } = SH, t = 0.004;
  const tray = new THREE.Group(); tray.position.set(0, 0, trayZ); g.add(tray);
  box(tw, t, td, trayMat, 0, t / 2, 0, tray);
  box(tw, th, t, trayMat, 0, th / 2, td / 2 - t / 2, tray); box(tw, th, t, trayMat, 0, th / 2, -td / 2 + t / 2, tray);
  box(t, th, td, trayMat, tw / 2 - t / 2, th / 2, 0, tray); box(t, th, td, trayMat, -tw / 2 + t / 2, th / 2, 0, tray);
  box(tw + 0.006, 0.005, 0.008, trayMat, 0, th, td / 2, tray);
  box(tw - 0.01, th - 0.025, td - 0.01, new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 }), 0, (th - 0.025) / 2, 0, tray);
  const lt = lecaTextures();
  const lecaMat = new THREE.MeshPhysicalMaterial({ map: lt.map, normalMap: lt.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.9, envMapIntensity: 0.3, sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x7a5a46) });
  const lecaGeo = new THREE.IcosahedronGeometry(0.0072, 3);
  const r = mulberry(77), step = 0.0118;
  const nx = Math.floor((tw - 0.02) / step), nz = Math.floor((td - 0.02) / step);
  const inst = new THREE.InstancedMesh(lecaGeo, lecaMat, nx * nz * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const n2 = noise2(3);
  let k = 0;
  for (let layer = 0; layer < 2; layer++) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = -tw / 2 + 0.01 + (i + 0.5 + (r() - 0.5) * 0.75 + layer * 0.5) * step;
    const z = -td / 2 + 0.01 + (j + 0.5 + (r() - 0.5) * 0.75 + layer * 0.5) * step;
    if (Math.abs(x) > tw / 2 - 0.009 || Math.abs(z) > td / 2 - 0.009) continue;
    const y = th - 0.014 + layer * 0.006 + n2(x * 30, z * 30) * 0.003;
    const s0 = 0.72 + r() * 0.55;
    sc.set(s0 * (0.88 + r() * 0.24), s0 * (0.8 + r() * 0.24), s0 * (0.88 + r() * 0.24));
    e.set(r() * 6.28, r() * 6.28, r() * 6.28); q.setFromEuler(e);
    p.set(x, y, z); m4.compose(p, q, sc); inst.setMatrixAt(k, m4);
    const v = 0.78 + r() * 0.4; col.setRGB(v, v * (0.95 + r() * 0.08), v * (0.92 + r() * 0.1)); inst.setColorAt(k, col);
    k++;
  }
  inst.count = k; inst.castShadow = true; inst.receiveShadow = true; tray.add(inst);

  // round digital hygrometer (like the one in the real cabinet)
  const lcd = canvas(256), lcdTex = new THREE.CanvasTexture(lcd); lcdTex.colorSpace = THREE.SRGBColorSpace;
  const hyg = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 48), new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.4, clearcoat: 0.4 }));
  body.rotation.x = Math.PI / 2; hyg.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.019, 40), new THREE.MeshPhysicalMaterial({ map: lcdTex, roughness: 0.15, clearcoat: 1, emissive: 0xffffff, emissiveMap: lcdTex, emissiveIntensity: 0.06 }));
  face.position.z = 0.0072; hyg.add(face);
  hyg.position.set(-0.36, 0.034, SH.trayZ + td / 2 + 0.035); hyg.rotation.y = 0.35; hyg.rotation.x = -0.08;
  hyg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(hyg);
  out.updateLCD = (temp, rh) => {
    const x = lcd.getContext('2d');
    x.fillStyle = '#b9c4b2'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#1b201a'; x.textAlign = 'center';
    x.font = '600 34px "IBM Plex Mono", monospace'; x.fillText(temp.toFixed(1) + '°C', 128, 92);
    x.font = '600 96px "IBM Plex Mono", monospace'; x.fillText(String(Math.round(rh)), 118, 186);
    x.font = '600 26px "IBM Plex Mono", monospace'; x.fillText('%', 196, 150);
    lcdTex.needsUpdate = true;
  };
  out.updateLCD(24.4, 84);

  // dark room around the cabinet
  const room = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshStandardMaterial({ color: 0x0a0b0b, roughness: 1, side: THREE.BackSide }));
  room.position.set(0, 1, 1.5); scene.add(room);
  out.group = g;
  return out;
}

// slow-drifting dust motes caught in the light
export function buildMotes(scene) {
  const N = 60, pos = new Float32Array(N * 3), r = mulberry(4), st = [];
  for (let i = 0; i < N; i++) { st.push([r() * 6.28, 0.2 + r() * 0.6, r()]); pos[i * 3] = (r() - 0.5) * 0.8; pos[i * 3 + 1] = 0.08 + r() * 0.34; pos[i * 3 + 2] = (r() - 0.5) * 0.36; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = canvas(32), x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 0.0016, transparent: true, opacity: 0.35, depthWrite: false, color: 0xfff1de, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  return {
    points: pts,
    update(dt, t) {
      for (let i = 0; i < N; i++) {
        const s = st[i];
        pos[i * 3] += Math.sin(t * 0.05 * s[1] + s[0]) * dt * 0.004;
        pos[i * 3 + 1] += (Math.sin(t * 0.07 + s[0] * 2) * 0.5 - 0.15) * dt * 0.003;
        pos[i * 3 + 2] += Math.cos(t * 0.04 * s[1] + s[0]) * dt * 0.003;
        if (pos[i * 3 + 1] < 0.08) pos[i * 3 + 1] = 0.42;
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}
