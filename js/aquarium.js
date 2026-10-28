/* Aquarium: rimless tank, aqua soil, Seiryu stones, HC carpet, water, CO2,
   lily pipes, neon tetra school, cherry shrimp colony, caustics */
(function (PC) {
  'use strict';
  const D = PC.DIM, TK = D.tank;

  // ---- caustic shader injection (shared by soil, rocks, carpet, shrimp) ----
  const CAUSTIC_GLSL = `
    uniform float uTime; uniform float uCaustic;
    varying vec3 vCWPos; varying vec3 vCWN;
    float causticF(vec2 uv, float t){
      vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
      vec2 i = p; float c = 1.0; float inten = 0.005;
      for (int n = 0; n < 4; n++) {
        float tt = t * (1.0 - (3.5 / float(n + 1)));
        i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
      }
      c /= 4.0; c = 1.17 - pow(c, 1.4);
      return pow(abs(c), 8.0);
    }`;
  PC.addCaustics = function (mat, opts) {
    opts = opts || {};
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = PC.shared.time;
      sh.uniforms.uCaustic = PC.shared.caustic;
      if (opts.uniforms) Object.assign(sh.uniforms, opts.uniforms);
      sh.vertexShader = 'uniform float uTime;\nvarying vec3 vCWPos; varying vec3 vCWN;\n' + (opts.vertexHead || '') + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (opts.vertex || ''))
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 cwp = vec4(transformed, 1.0);
          vec3 cwn = objectNormal;
          #ifdef USE_INSTANCING
            cwp = instanceMatrix * cwp; cwn = mat3(instanceMatrix) * cwn;
          #endif
          cwp = modelMatrix * cwp; vCWPos = cwp.xyz;
          vCWN = normalize(mat3(modelMatrix) * cwn);`);
      let fs = sh.fragmentShader;
      if (opts.fragColor) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + opts.fragColor);
      if (opts.fragRough) fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + opts.fragRough);
      if (opts.fragNormal) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + opts.fragNormal);
      sh.fragmentShader = CAUSTIC_GLSL + '\n' + (opts.fragHead || '') + '\n' + fs.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
          float cUp = clamp(vCWN.y * 0.8 + 0.2, 0.0, 1.0);
          float cc = min(causticF(vCWPos.xz * 3.2, uTime * 0.55) + 0.6 * causticF(vCWPos.xz * 4.1 + 0.3, uTime * 0.43), 1.6);
          float inWater = step(vCWPos.y, ${(TK.water).toFixed(3)});
          outgoingLight += diffuseColor.rgb * cc * uCaustic * cUp * inWater * ${(opts.strength || 1.2).toFixed(2)};
          gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
    };
    mat.customProgramCacheKey = () => 'caustic-' + (opts.key || 'base');
    return mat;
  };

  function mergeByPosition(geo) {
    const p = geo.attributes.position, map = new Map(), pos = [], idx = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
      let k = map.get(key);
      if (k === undefined) { k = pos.length / 3; pos.push(x, y, z); map.set(key, k); }
      idx.push(k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  // ---- Seiryu / Ryuoh stone ------------------------------------------------
  // Built like the real thing: a fractured block, split into leaning bedding layers that
  // stick out by different amounts (the parallel slab ridges), cut by deep vertical grooves
  // and cracks, then shaded with baked cavity occlusion and edge wear.
  const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function buildStone(seed, detail, opt) {
    opt = opt || {};
    const lean = opt.lean != null ? opt.lean : 0.9;        // elevation of the long axis (radians)
    const stretch = opt.stretch || 1.3, layers = opt.layers || 7, slab = opt.slab != null ? opt.slab : 1;
    const L = new THREE.Vector3(-Math.cos(lean), Math.sin(lean), 0.12).normalize();   // long axis, rising to the left
    const N = new THREE.Vector3(Math.sin(lean), Math.cos(lean), 0.35).normalize();    // bedding-plane normal
    const geo = mergeByPosition(new THREE.IcosahedronGeometry(1, detail));
    const p = geo.attributes.position, n = p.count, v = new THREE.Vector3(), q = new THREE.Vector3();
    const tone = new Float32Array(n), layerId = new Float32Array(n), edge = new Float32Array(n);
    const pr = PC.rng(seed * 7 + 3), planes = [];
    for (let k = 0; k < 13; k++) {
      const vertical = k < 9;
      const az = pr() * 6.283, el = vertical ? (pr() - 0.5) * 0.6 : 0.5 + pr() * 1.0;
      planes.push([new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)), 0.8 + pr() * 0.22]);
    }
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(p, i).normalize();
      // fractured block
      let r = 1.3;
      for (const [nv, d] of planes) { const c = v.dot(nv); if (c > 0.05) r = Math.min(r, d / c); }
      r *= 1 + 0.08 * PC.fbm3(v.x * 2 + seed, v.y * 2, v.z * 2, 3);
      // bedding layers: each slab protrudes by its own amount, with a sharp lip and a sloping back
      const u = v.dot(N) * layers + 0.55 * PC.noise3(v.x * 1.7 + seed, v.y * 1.7, v.z * 1.7) + 0.15 * PC.noise3(v.x * 6, v.y * 6, v.z * 6 + seed);
      const li = Math.floor(u), f = u - li;
      const out = (hash1(li + seed * 13) - 0.5) * 0.34 * slab;
      const lip = Math.pow(f, 2.2) * 0.16 * slab;            // ramps up, then drops off a cliff at the next layer
      r += out - lip;
      // split lines between layers
      r -= 0.07 * slab * Math.exp(-Math.min(f, 1 - f) * 30);
      // grooves across the layers and fine cracks
      const fis = Math.abs(PC.noise3(v.x * 3.8 + seed * 1.3, v.y * 1.0, v.z * 3.8));
      r -= 0.09 * Math.exp(-fis * 16);
      const ck = Math.abs(PC.noise3(v.x * 9 + 4.1, v.y * 9 + seed, v.z * 9));
      r -= 0.03 * Math.exp(-ck * 30);
      // craggy pitted surface
      const cr = 1 - Math.abs(PC.noise3(v.x * 14 + seed, v.y * 14, v.z * 14));
      r += 0.02 * cr * cr * cr + 0.012 * PC.noise3(v.x * 26, v.y * 26 + seed, v.z * 26);
      // elongate along the leaning axis
      q.copy(v).multiplyScalar(r);
      const along = q.dot(L);
      q.addScaledVector(L, along * (stretch - 1));
      q.multiplyScalar(1 / Math.sqrt(stretch));
      if (q.y < -0.36) q.y = -0.36 - (q.y + 0.36) * 0.08;
      p.setXYZ(i, q.x, q.y, q.z);
      layerId[i] = hash1(li * 3.7 + seed);
      edge[i] = PC.smooth(0.82, 1, f);                       // the protruding lip of each slab
      tone[i] = PC.noise3(v.x * 3 + seed, v.y * 3, v.z * 3);
    }
    geo.computeVertexNormals();
    // cavity: how far each vertex sits below the average of its neighbours
    const idx = geo.index.array, sum = new Float32Array(n * 3), cnt = new Float32Array(n);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      for (const [u, w1, w2] of [[a, b, c], [b, c, a], [c, a, b]]) {
        sum[u * 3] += p.getX(w1) + p.getX(w2); sum[u * 3 + 1] += p.getY(w1) + p.getY(w2); sum[u * 3 + 2] += p.getZ(w1) + p.getZ(w2);
        cnt[u] += 2;
      }
    }
    const nr = geo.attributes.normal, cav = new Float32Array(n);
    let mean = 0;
    for (let i = 0; i < n; i++) {
      const ax = sum[i * 3] / cnt[i] - p.getX(i), ay = sum[i * 3 + 1] / cnt[i] - p.getY(i), az = sum[i * 3 + 2] / cnt[i] - p.getZ(i);
      cav[i] = ax * nr.getX(i) + ay * nr.getY(i) + az * nr.getZ(i);
      mean += Math.abs(cav[i]);
    }
    mean /= n;
    const sharp = Float32Array.from(cav, (c) => PC.clamp(c / (mean * 2.5), -1, 1));
    let ao = sharp.slice();
    for (let pass = 0; pass < 4; pass++) {                    // spread into a soft occlusion term
      const s2 = new Float32Array(n), c2 = new Float32Array(n);
      for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) {
        const u = idx[t + k], w = idx[t + (k + 1) % 3];
        s2[u] += ao[w]; c2[u]++; s2[w] += ao[u]; c2[w]++;
      }
      ao = Float32Array.from(ao, (a, i) => a * 0.4 + 0.6 * s2[i] / c2[i]);
    }
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // charcoal base, each bedding layer a slightly different grey
      let c = 0.034 * (0.7 + 0.7 * layerId[i]) * (1 + 0.25 * tone[i]);
      const concave = PC.smooth(0, 0.6, ao[i]), crevice = PC.smooth(0.2, 0.9, sharp[i]);
      const convex = PC.smooth(0.05, 0.7, -sharp[i]);
      c *= (1 - 0.7 * concave) * (1 - 0.5 * crevice);
      c *= 1 + 1.4 * convex + 0.9 * edge[i] * (1 - concave);   // worn, pale edges on ridges and slab lips
      const up = PC.smooth(0.45, 0.9, nr.getY(i));
      c *= 1 + 0.35 * up;                                      // fine silt settles on upward faces
      c *= 0.5 + 0.5 * PC.smooth(-0.36, -0.12, p.getY(i));     // contact shadow at the base
      let rr = c * 0.94, gg = c * 0.98, bb = c * 1.04;
      // faint algae film in the deepest hollows
      const film = concave * 0.35;
      rr = PC.lerp(rr, c * 0.8, film); gg = PC.lerp(gg, c * 1.05, film); bb = PC.lerp(bb, c * 0.7, film);
      cols[i * 3] = rr; cols[i * 3 + 1] = gg; cols[i * 3 + 2] = bb;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return geo;
  }

  // fine surface detail for the stones, evaluated per pixel in world space
  const ROCK_SHADER = {
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
        vec3 vSigmaX = vec3(dFdx(surf_pos.x), dFdx(surf_pos.y), dFdx(surf_pos.z));
        vec3 vSigmaY = vec3(dFdy(surf_pos.x), dFdy(surf_pos.y), dFdy(surf_pos.z));
        vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
        float fDet = dot(vSigmaX, R1) * faceDir;
        vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
        return normalize(abs(fDet) * surf_norm - vGrad);
      }
      float rkHeight; float rkVein;`,
    fragColor: `
      {
        vec3 rp = vCWPos;
        float fw = length(fwidth(rp));
        float fine = 1.0 - smoothstep(0.0006, 0.0025, fw);
        // white calcite: thin seams plus a sparse branching network
        float vph = dot(rp, normalize(vec3(0.35, 1.0, 0.18))) * 22.0 + rk_snoise(rp * 9.0) * 0.55 + rk_snoise(rp * 40.0) * 0.06;
        float seam = (1.0 - smoothstep(0.006, 0.02, abs(fract(vph) - 0.5))) * smoothstep(0.15, 0.5, rk_snoise(rp * vec3(6.0, 2.5, 6.0) + 3.0));
        float net = (1.0 - smoothstep(0.006, 0.025, abs(rk_snoise(rp * 20.0 + 11.0) + 0.2 * rk_snoise(rp * 60.0)))) * smoothstep(0.5, 0.7, rk_snoise(rp * 6.0 + 21.0));
        rkVein = max(seam, net * 0.9) * (0.55 + 0.45 * fine);
        // pale grey calcite / weathered patches with crisp edges
        float pn = rk_snoise(rp * 15.0 + 5.0) + 0.35 * rk_snoise(rp * 55.0);
        float rkPatch = smoothstep(0.42, 0.5, pn) * smoothstep(0.0, 0.4, rk_snoise(rp * 5.0 + 9.0));
        // hairline cracks and pitting
        float crk = (1.0 - smoothstep(0.0, 0.035, abs(rk_snoise(rp * 30.0 + 2.0)))) * smoothstep(0.35, 0.6, rk_snoise(rp * 6.0 + 1.0)) * fine;
        float pit = smoothstep(0.7, 0.9, rk_snoise(rp * 180.0)) * fine;
        float tone = rk_fbm(rp * 40.0);
        float grain = rk_snoise(rp * 260.0) * fine;
        vec3 c = diffuseColor.rgb * (0.72 + 0.56 * (tone * 0.5 + 0.5));
        c *= 1.0 + 0.1 * grain;
        c = mix(c, vec3(0.15, 0.155, 0.15) * (0.75 + 0.5 * (rk_snoise(rp * 90.0) * 0.5 + 0.5)), rkPatch * 0.55);
        c *= 1.0 - 0.2 * crk;
        c *= 1.0 - 0.3 * pit;
        c = mix(c, vec3(0.5, 0.51, 0.5), rkVein * 0.85);
        diffuseColor.rgb = c;
        float rg = 1.0 - abs(rk_snoise(rp * 75.0)); float rg2 = 1.0 - abs(rk_snoise(rp * 190.0 + 4.0));
        rkHeight = 0.0016 * (0.5 * tone + 0.45 * rg * rg * rg + 0.2 * rg2 * rg2 * fine - crk * 0.5 - pit * 0.5 + rkVein * 0.2 + rkPatch * 0.2);
      }`,
    fragRough: `roughnessFactor = mix(roughnessFactor, 0.5, rkVein * 0.8);`,
    fragNormal: `normal = rk_perturb(-vViewPosition, normal, vec2(dFdx(rkHeight), dFdy(rkHeight)), faceDirection);`
  };

  PC.buildAquarium = function (scene, cabinet) {
    const tank = new THREE.Group(); tank.position.set(0, TK.y0, 0); scene.add(tank);
    const out = { group: tank };
    const g = TK.glass, hw = TK.w / 2, hd = TK.d / 2, H = TK.h;
    const iw = hw - g, id = hd - g;            // inner half extents
    const waterY = TK.water - TK.y0;           // local
    out.inner = { x: iw, z: id, bottom: g, water: waterY };

    // ---- glass ----
    const tg = new THREE.MeshPhysicalMaterial({ color: 0xe8fff8, roughness: 0.02, transparent: true, opacity: 0.07, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide });
    const edge = new THREE.MeshBasicMaterial({ color: 0x7fd8c4, transparent: true, opacity: 0.55, depthWrite: false });
    PC.box(TK.w, 0.005, TK.d, new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9 }), 0, -0.0025, 0, tank);
    const panes = [
      [TK.w, g, TK.d, 0, g / 2, 0], [TK.w, H, g, 0, H / 2, hd - g / 2], [TK.w, H, g, 0, H / 2, -hd + g / 2],
      [g, H, TK.d - 2 * g, hw - g / 2, H / 2, 0], [g, H, TK.d - 2 * g, -hw + g / 2, H / 2, 0]
    ];
    for (const p of panes) { const m = PC.box(p[0], p[1], p[2], tg, p[3], p[4], p[5], tank); m.renderOrder = 30; }
    // optiwhite edges catch the light
    const e = 0.0018;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const m = PC.box(e, H, e, edge, sx * (hw - 0.001), H / 2, sz * (hd - 0.001), tank); m.renderOrder = 31; }
    for (const sz of [-1, 1]) for (const y of [0.0, H]) { const m = PC.box(TK.w, e, e, edge, 0, y, sz * (hd - 0.001), tank); m.renderOrder = 31; }
    for (const sx of [-1, 1]) for (const y of [0.0, H]) { const m = PC.box(e, e, TK.d, edge, sx * (hw - 0.001), y, 0, tank); m.renderOrder = 31; }
    out.edgeMat = edge;

    // frosted backdrop behind the back glass
    const bc = PC.Tex.canvas(64, 256), bx = bc.getContext('2d');
    const bgr = bx.createLinearGradient(0, 0, 0, 256);
    bgr.addColorStop(0, '#d9e6e0'); bgr.addColorStop(0.5, '#9fb9ae'); bgr.addColorStop(1, '#33463f');
    bx.fillStyle = bgr; bx.fillRect(0, 0, 64, 256);
    const backdropMat = new THREE.MeshBasicMaterial({ map: PC.Tex.tex(bc, true), color: 0xffffff });
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(TK.w - 0.004, H - 0.004), backdropMat);
    bd.position.set(0, H / 2, -hd - 0.002); tank.add(bd);
    out.backdropMat = backdropMat;

    // ---- substrate heightfield ----
    const subH = function (x, z) {
      const xn = x / iw, zf = (z + id) / (2 * id); // zf 0 back -> 1 front
      let h = 0.033 + 0.07 * Math.pow(1 - zf, 1.25);
      h += 0.075 * Math.exp(-((xn + 0.72) ** 2 / 0.16 + (zf - 0.35) ** 2 / 0.28));
      h += 0.04 * Math.exp(-((xn - 0.58) ** 2 / 0.14 + (zf - 0.25) ** 2 / 0.22));
      h -= 0.012 * Math.exp(-((xn - 0.12) ** 2 / 0.12 + (zf - 0.72) ** 2 / 0.12));
      h += PC.noise3(x * 18, z * 18, 3.1) * 0.004;
      return g + Math.max(0.02, h);
    };
    out.subH = subH;
    const soilTex = PC.Tex.soil(); soilTex.repeat.set(8, 4);
    const soilMat = PC.addCaustics(new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1, color: 0xbfae9c }), { key: 'soil' });
    {
      const nx = 90, nz = 40, pos = [], uv = [], idx = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const x = -iw + (2 * iw * i) / nx, z = -id + (2 * id * j) / nz;
        pos.push(x, subH(x, z), z); uv.push(i / nx, j / nz);
      }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, soilMat); m.receiveShadow = true; tank.add(m);
      // soil walls seen through the glass
      const wall = (pts) => {
        const p = [], u = [], ix = [];
        pts.forEach(([x, z], k) => { p.push(x, g, z, x, subH(x, z), z); u.push(k / pts.length * 4, 0, k / pts.length * 4, subH(x, z) * 8); });
        for (let k = 0; k < pts.length - 1; k++) { const a = k * 2; ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        const gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        gg.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
        gg.setIndex(ix); gg.computeVertexNormals();
        const mm = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1, color: 0x8a7a6a, side: THREE.DoubleSide }));
        tank.add(mm);
      };
      const front = [], left = [], right = [];
      for (let i = 0; i <= 90; i++) front.push([-iw + (2 * iw * i) / 90, id - 0.0005]);
      for (let i = 0; i <= 30; i++) { left.push([-iw + 0.0005, -id + (2 * id * i) / 30]); right.push([iw - 0.0005, -id + (2 * id * i) / 30]); }
      wall(front); wall(left); wall(right);
    }

    // ---- Seiryu stones ----
    const rockMat = PC.addCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.25 }), Object.assign({ key: 'rock', strength: 0.7 }, ROCK_SHADER));
    rockMat.extensions = { derivatives: true };
    const rocks = [
      [-0.07, -0.05, 0.15, 0.16, 0.1, 0.25, 11, 0.75, 1.55, 5],
      [-0.2, 0.065, 0.09, 0.075, 0.07, -0.2, 12, 0.5, 1.4, 4],
      [-0.12, 0.09, 0.05, 0.04, 0.04, 0.9, 13, 0.4, 1.3, 5],
      [-0.355, -0.1, 0.06, 0.14, 0.05, 0.15, 14, 1.15, 1.45, 4],
      [0.235, 0.035, 0.065, 0.05, 0.05, 0.5, 15, 0.45, 1.35, 4],
      [0.33, -0.1, 0.06, 0.065, 0.045, -0.4, 16, 0.8, 1.3, 4],
      [0.06, 0.09, 0.028, 0.022, 0.028, 0.3, 17, 0.35, 1.25, 4]
    ];
    const rockMeshes = [];
    for (const [x, z, sx, sy, sz, ry, seed, lean, stretch, layers] of rocks) {
      const geo = buildStone(seed, sx > 0.085 ? 6 : 5, { lean, stretch, layers });
      const m = new THREE.Mesh(geo, rockMat);
      m.scale.set(sx, sy, sz); m.rotation.y = ry;
      m.position.set(x, subH(x, z) + sy * 0.25, z);
      // keep every peak under the waterline
      geo.computeBoundingBox();
      const top = m.position.y + geo.boundingBox.max.y * sy;
      if (top > waterY - 0.035) m.scale.y *= (waterY - 0.035 - m.position.y) / (top - m.position.y);
      m.castShadow = true; m.receiveShadow = true;
      tank.add(m); rockMeshes.push(m);
    }

    // ---- ground grid: max(substrate, rock tops) ----
    const cell = 0.006, gx = Math.ceil((2 * iw) / cell), gz = Math.ceil((2 * id) / cell);
    const rockTop = new Float32Array(gx * gz).fill(-1);
    const tmp = new THREE.Vector3();
    for (const m of rockMeshes) {
      m.updateMatrix();
      const p = m.geometry.attributes.position;
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
        const k = j * gx + i; if (copy[k] > 0) continue;
        let n = 0, s = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = copy[(j + dj) * gx + i + di]; if (q > 0) { n++; s += q; } }
        if (n >= 5) rockTop[k] = s / n;
      }
    }
    const rockAt = (x, z) => {
      const ci = Math.floor((x + iw) / cell), cj = Math.floor((z + id) / cell);
      if (ci < 0 || cj < 0 || ci >= gx || cj >= gz) return -1;
      return rockTop[cj * gx + ci];
    };
    const ground = (x, z) => Math.max(subH(x, z), rockAt(x, z));
    out.ground = ground; out.rockAt = rockAt;
    const carpetThick = (x, z) => 0.012 + 0.024 * (0.5 + 0.5 * PC.fbm3(x * 9, z * 9, 2.2, 3)) * (0.6 + 0.4 * (1 - Math.abs(x) / iw));
    out.carpetTop = (x, z) => subH(x, z) + carpetThick(x, z);

    // ---- small Seiryu chips scattered around the main stones ----
    {
      const cg = buildStone(91, 3, { lean: 0.5, stretch: 1.3, layers: 4, slab: 0.8 });
      const NCH = 190, chips = new THREE.InstancedMesh(cg, rockMat, NCH);
      const r = PC.rng(808), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), pp = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
      let k = 0, tries = 0;
      while (k < NCH && tries < 5000) {
        tries++;
        const rk = rocks[Math.floor(r() * 6)];
        const ang = r() * 6.283, rad = Math.max(rk[2], rk[4]) * (0.95 + Math.pow(r(), 1.6) * 0.9);
        const x = rk[0] + Math.cos(ang) * rad, z = rk[1] + Math.sin(ang) * rad * 0.8;
        if (Math.abs(x) > iw - 0.01 || Math.abs(z) > id - 0.01) continue;
        const sh = subH(x, z); if (rockAt(x, z) > sh + 0.003) continue;
        const size = 0.0035 + Math.pow(r(), 2.2) * 0.012;
        eu.set(r() * 0.6, r() * 6.28, r() * 0.6); q.setFromEuler(eu);
        sc.set(size * (0.8 + r() * 0.5), size * (0.6 + r() * 0.5), size * (0.8 + r() * 0.5));
        pp.set(x, sh + carpetThick(x, z) * 0.5 + sc.y * 0.2, z);
        m4.compose(pp, q, sc); chips.setMatrixAt(k, m4);
        const v = 0.85 + r() * 0.35; col.setRGB(v, v, v); chips.setColorAt(k, col);
        k++;
      }
      chips.count = k; chips.castShadow = true; chips.receiveShadow = true; tank.add(chips);
    }

    // ---- HC carpet ----
    {
      const N = 52000;
      const leaf = new THREE.CircleGeometry(0.0033, 6); leaf.rotateX(-Math.PI / 2);
      leaf.scale(1, 1, 0.8);
      const mat = PC.addCaustics(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, side: THREE.DoubleSide, envMapIntensity: 0.12 }), {
        key: 'carpet', strength: 0.55,
        vertex: `
          #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
          transformed.x += sin(uTime * 1.6 + ip.x * 40.0 + ip.y * 25.0) * 0.00035;
          transformed.z += cos(uTime * 1.3 + ip.y * 35.0) * 0.00025;
          #endif`
      });
      const inst = new THREE.InstancedMesh(leaf, mat, N);
      const r = PC.rng(5), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
      let k = 0, tries = 0;
      while (k < N && tries < N * 4) {
        tries++;
        const x = (r() * 2 - 1) * (iw - 0.002), z = (r() * 2 - 1) * (id - 0.002);
        const sh = subH(x, z), rt = rockAt(x, z);
        if (rt > sh + 0.004) continue;
        const thick = carpetThick(x, z);
        const t = Math.pow(r(), 0.4);
        const y = sh + t * thick;
        eu.set((r() - 0.5) * 1.6, r() * 6.28, (r() - 0.5) * 1.6); q.setFromEuler(eu);
        const sc = 0.75 + r() * 0.55; s.set(sc, sc, sc);
        p.set(x, y, z); m4.compose(p, q, s); inst.setMatrixAt(k, m4);
        c.setHSL(0.255 + r() * 0.04, 0.78 + r() * 0.15, 0.13 + t * 0.17 + r() * 0.05);
        inst.setColorAt(k, c);
        k++;
      }
      inst.count = k; inst.frustumCulled = false; inst.receiveShadow = true;
      tank.add(inst);
    }

    // ---- water ----
    const wn = PC.Tex.waterNormal(); wn.repeat.set(3, 1.4);
    const surfMat = new THREE.MeshPhysicalMaterial({ color: 0xa8dcd0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(iw * 2, id * 2), surfMat);
    surf.rotation.x = -Math.PI / 2; surf.position.y = waterY; surf.renderOrder = 25; tank.add(surf);
    out.waterNormal = wn;
    const volF = new THREE.MeshBasicMaterial({ color: 0x3f9c86, transparent: true, opacity: 0.07, depthWrite: false });
    const vol = new THREE.Mesh(new THREE.BoxGeometry(iw * 2 - 0.002, waterY - g, id * 2 - 0.002), volF);
    vol.position.y = g + (waterY - g) / 2; vol.renderOrder = 24; tank.add(vol);
    out.volMat = volF;

    // ---- equipment: lily pipes, CO2 diffuser, pump ----
    const pipeGlass = new THREE.MeshPhysicalMaterial({ color: 0xd8f5ee, roughness: 0.04, transparent: true, opacity: 0.32, envMapIntensity: 2, depthWrite: false });
    const tubeM = (pts, r, mat) => {
      const c = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)));
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, 40, r, 12, false), mat); m.renderOrder = 26; tank.add(m); return m;
    };
    // inflow
    tubeM([[0.39, 0.12, -0.14], [0.39, waterY + 0.03, -0.14], [0.395, H + 0.015, -0.15], [0.41, H + 0.02, -0.175], [0.43, H - 0.02, -0.2]], 0.0065, pipeGlass);
    const strainer = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 16, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xcfeee6, roughness: 0.2, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    strainer.position.set(0.39, 0.155, -0.14); strainer.renderOrder = 26; tank.add(strainer);
    // outflow (lily)
    tubeM([[0.43, H - 0.02, -0.2], [0.415, H + 0.02, -0.165], [0.4, H + 0.01, -0.1], [0.4, waterY - 0.02, -0.085], [0.385, waterY - 0.035, -0.08], [0.36, waterY - 0.035, -0.078]], 0.0065, pipeGlass);
    const lily = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.0065, 0.022, 20, 1, true), pipeGlass);
    lily.rotation.z = Math.PI / 2; lily.position.set(0.348, waterY - 0.035, -0.078); lily.renderOrder = 26; tank.add(lily);
    // CO2 diffuser front-left
    const dPos = new THREE.Vector3(-iw + 0.03, 0.2, id - 0.05);
    const diff = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.03, 20, 1, true), pipeGlass);
    diff.rotation.z = Math.PI / 2; diff.position.copy(dPos); diff.renderOrder = 26; tank.add(diff);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 24), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.9 }));
    disc.rotation.y = Math.PI / 2; disc.position.copy(dPos).add(new THREE.Vector3(0.012, 0, 0)); tank.add(disc);
    tubeM([[dPos.x - 0.012, dPos.y, dPos.z], [-iw + 0.006, dPos.y + 0.02, dPos.z], [-iw + 0.006, H + 0.012, dPos.z - 0.01], [-hw - 0.01, H + 0.01, dPos.z - 0.02], [-hw - 0.012, H - 0.04, dPos.z - 0.02]], 0.0022, pipeGlass);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.003, 20), pipeGlass);
    cup.rotation.z = Math.PI / 2; cup.position.set(-iw + 0.002, dPos.y, dPos.z); tank.add(cup);
    // hydro pump hidden back-right
    const pumpY = subH(0.4, -0.155);
    PC.box(0.04, 0.045, 0.032, new THREE.MeshStandardMaterial({ color: 0x111213, roughness: 0.5 }), 0.4, pumpY + 0.02, -0.155, tank);

    // ---- CO2 mist ----
    {
      const N = 220, pos = new Float32Array(N * 3), st = [];
      const r = PC.rng(21);
      for (let i = 0; i < N; i++) { st.push({ age: r() * 6, sp: 0.03 + r() * 0.05, dx: 0.004 + r() * 0.01, ph: r() * 6.28, o: [r() - 0.5, r() - 0.5] }); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ map: PC.Tex.bubble(), size: 0.0026, transparent: true, depthWrite: false, opacity: 0.85 });
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 27; tank.add(pts);
      out.updateBubbles = function (dt, t) {
        for (let i = 0; i < N; i++) {
          const b = st[i]; b.age += dt;
          let x = dPos.x + 0.014 + b.age * b.dx * 3 + Math.sin(t * 3 + b.ph) * 0.002 + b.o[0] * 0.012;
          let y = dPos.y + b.o[1] * 0.012 + b.age * b.sp + b.age * b.age * 0.004;
          let z = dPos.z + b.o[1] * 0.01 + Math.cos(t * 2.3 + b.ph) * 0.002 - b.age * 0.004;
          if (y > waterY - 0.002 || b.age > 12) { b.age = 0; }
          pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        }
        geo.attributes.position.needsUpdate = true;
      };
    }

    // ---- fine bubbles: oxygen pearling off the carpet, micro-bubbles from the
    //      lily pipe outflow, and air pulled under by the hydro return trickle ----
    {
      const MAX = 1400, pos = new Float32Array(MAX * 3), aSize = new Float32Array(MAX), aAlpha = new Float32Array(MAX);
      const B = []; for (let i = 0; i < MAX; i++) B.push({ alive: false });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
      const U = { uTex: { value: PC.Tex.bubble() }, uScale: { value: 600 }, uTint: { value: new THREE.Color(1, 1, 1) } };
      const mat = new THREE.ShaderMaterial({
        uniforms: U, transparent: true, depthWrite: false,
        vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;
          void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
            gl_PointSize = max(1.5, aSize * uScale / max(0.02, -mv.z)); vA = aAlpha * min(1.0, aSize * uScale / max(0.02, -mv.z) / 1.5); }`,
        fragmentShader: `uniform sampler2D uTex; uniform vec3 uTint; varying float vA;
          void main(){ vec4 t = texture2D(uTex, gl_PointCoord); float a = t.a * vA; if (a < 0.01) discard; gl_FragColor = vec4(uTint * t.rgb, a); }`
      });
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 27; tank.add(pts);

      const rb = PC.rng(77);
      const lilyOut = new THREE.Vector3(0.336, waterY - 0.035, -0.078);
      const tr = cabinet.trickleOrigin.clone(); tr.y = waterY - 0.004;
      let cursor = 0, accP = 0, accF = 0, accT = 0, photo = -1;
      const spawn = (type) => {
        for (let n = 0; n < MAX; n++) {
          cursor = (cursor + 1) % MAX; const b = B[cursor];
          if (b.alive) continue;
          b.alive = true; b.type = type; b.age = 0; b.ph = rb() * 6.28; b.wob = 0.0006 + rb() * 0.0012;
          if (type === 0) {        // pearl: clings to a leaf, swells, lets go
            let x, z, tries = 0;
            do { x = (rb() * 2 - 1) * (iw - 0.01); z = (rb() * 2 - 1) * (id - 0.01); tries++; } while (rockAt(x, z) > subH(x, z) + 0.004 && tries < 8);
            b.x = x; b.z = z; b.y = out.carpetTop(x, z) - rb() * 0.008;
            b.cling = 1.5 + rb() * 6; b.s0 = 0.0009 + rb() * 0.0006; b.s1 = b.s0 * (1.6 + rb() * 0.8);
            b.vx = 0; b.vy = 0; b.vz = 0;
          } else if (type === 1) { // outflow micro-bubbles
            b.x = lilyOut.x; b.y = lilyOut.y + (rb() - 0.5) * 0.008; b.z = lilyOut.z + (rb() - 0.5) * 0.008;
            b.vx = -0.12 - rb() * 0.1; b.vy = (rb() - 0.5) * 0.02; b.vz = (rb() - 0.3) * 0.05;
            b.cling = 0; b.s0 = b.s1 = 0.0004 + rb() * 0.0005;
          } else {                 // trickle entrainment
            b.x = tr.x + (rb() - 0.5) * 0.006; b.y = tr.y; b.z = tr.z + (rb() - 0.5) * 0.006;
            b.vx = (rb() - 0.5) * 0.04; b.vy = -0.06 - rb() * 0.1; b.vz = (rb() - 0.5) * 0.04;
            b.cling = 0; b.s0 = b.s1 = 0.0005 + rb() * 0.0009;
          }
          return;
        }
      };
      out.updateFineBubbles = function (dt, t, tankLight) {
        dt = Math.min(dt, 0.05);
        if (photo < 0) photo = tankLight;
        photo += (tankLight - photo) * Math.min(1, dt / 40);   // pearling builds up after lights-on
        accP += dt * 34 * photo; accF += dt * 26; accT += dt * 22;
        while (accP >= 1) { accP--; spawn(0); }
        while (accF >= 1) { accF--; spawn(1); }
        while (accT >= 1) { accT--; spawn(2); }
        for (let i = 0; i < MAX; i++) {
          const b = B[i];
          if (!b.alive) { aAlpha[i] = 0; continue; }
          b.age += dt;
          let size = b.s1;
          if (b.age < b.cling) {
            size = PC.lerp(b.s0, b.s1, b.age / b.cling);
          } else {
            const term = 0.025 + size * 40;                     // bigger bubbles rise faster
            b.vy += (term - b.vy) * Math.min(1, dt * (b.type === 2 ? 3 : 2));
            const drag = Math.exp(-dt * 2.2); b.vx *= drag; b.vz *= drag;
            b.x += b.vx * dt + Math.sin(t * 9 + b.ph) * b.wob * dt * 8;
            b.y += b.vy * dt;
            b.z += b.vz * dt + Math.cos(t * 7 + b.ph) * b.wob * dt * 8;
            if (Math.abs(b.x) > iw - 0.002) b.vx *= -0.5;
            if (Math.abs(b.z) > id - 0.002) b.vz *= -0.5;
          }
          if (b.y > waterY - 0.0015 || b.age > 40) { b.alive = false; aAlpha[i] = 0; continue; }
          pos[i * 3] = b.x; pos[i * 3 + 1] = b.y; pos[i * 3 + 2] = b.z;
          aSize[i] = size; aAlpha[i] = (b.type === 0 ? 0.95 : 0.75) * PC.smooth(0, 0.15, b.age + (b.type === 0 ? 1 : 0));
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true;
        if (PC.shared.tint) U.uTint.value.copy(PC.shared.tint);
      };
      out.resizeBubbles = function (camera, renderer) {
        U.uScale.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];
      };
    }

    // ---- trickle from hydro return + ripples ----
    {
      const o = cabinet.trickleOrigin.clone(); o.y -= TK.y0;
      const len = o.y - waterY;
      const sc = PC.Tex.canvas(16, 128), sx = sc.getContext('2d');
      for (let y = 0; y < 128; y++) { const a = 0.25 + 0.5 * Math.abs(Math.sin(y * 0.4) * Math.sin(y * 0.13)); sx.fillStyle = `rgba(230,250,245,${a})`; sx.fillRect(0, y, 16, 1); }
      const st = PC.Tex.tex(sc, false, true);
      const sMat = new THREE.MeshBasicMaterial({ map: st, transparent: true, opacity: 0.7, depthWrite: false });
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0026, len, 8, 1, true), sMat);
      stream.position.set(o.x, waterY + len / 2, o.z); stream.renderOrder = 28; tank.add(stream);
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const rm = new THREE.MeshBasicMaterial({ color: 0xe8fffa, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.004, 0.0052, 28), rm);
        ring.rotation.x = -Math.PI / 2; ring.position.set(o.x, waterY + 0.0005, o.z); ring.renderOrder = 28; tank.add(ring);
        rings.push({ ring, rm, off: i / 3 });
      }
      out.updateTrickle = function (dt, t, on) {
        stream.visible = on;
        st.offset.y -= dt * 3.2;
        for (const r of rings) {
          const ph = (t * 0.9 + r.off) % 1;
          r.ring.visible = on;
          r.ring.scale.setScalar(1 + ph * 5);
          r.rm.opacity = 0.45 * (1 - ph);
        }
      };
    }

    // ---- neon tetras ----
    out.fish = buildFish(tank, out);
    // ---- cherry shrimp ----
    out.shrimp = buildShrimp(tank, out);
    return out;
  };

  // =======================================================================
  function buildFish(tank, aq) {
    const N = 30;
    const body = new THREE.SphereGeometry(1, 18, 12); body.rotateX(Math.PI / 2);
    const p = body.attributes.position, uv = body.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const f = z < 0 ? 0.32 + 0.68 * Math.pow(1 + z, 0.8) : 1 - 0.28 * z * z;
      const belly = y < 0 ? 1.08 : 0.92;
      uv.setXY(i, (z + 1) / 2, (y + 1) / 2);
      p.setXYZ(i, x * f * 0.0016, y * f * 0.0029 * belly, z * 0.0098);
    }
    body.computeVertexNormals();
    const bn = body.toNonIndexed();
    const pos = Array.from(bn.attributes.position.array), nor = Array.from(bn.attributes.normal.array), uvs = Array.from(bn.attributes.uv.array);
    const tri = (a, b, c) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) { nor.push(1, 0, 0); uvs.push(0.03, 0.62); } };
    tri([0, 0.0003, -0.008], [0, 0.0036, -0.0168], [0, 0.0005, -0.0136]);
    tri([0, -0.0003, -0.008], [0, -0.0005, -0.0136], [0, -0.0036, -0.0168]);
    tri([0, 0.0025, -0.0005], [0, 0.0054, -0.0035], [0, 0.0024, -0.0042]);
    tri([0, -0.0024, -0.002], [0, -0.0044, -0.0055], [0, -0.0017, -0.0075]);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const aPhase = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    const aAmp = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    aPhase.setUsage(THREE.DynamicDrawUsage); aAmp.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPhase', aPhase); geo.setAttribute('aAmp', aAmp);

    const tx = PC.Tex.neon();
    const mat = new THREE.MeshStandardMaterial({ map: tx.map, emissive: 0x3fbfff, emissiveMap: tx.emissive, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide });
    PC.addCaustics(mat, {
      key: 'fish', strength: 0.5,
      vertexHead: 'attribute float aPhase; attribute float aAmp;\n',
      vertex: `
        float bend = smoothstep(0.004, -0.017, position.z);
        transformed.x += sin(aPhase - position.z * 240.0) * 0.0021 * bend * aAmp;`
    });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.frustumCulled = false; mesh.castShadow = false;
    tank.add(mesh);

    const r = PC.rng(31), I = aq.inner;
    const fish = [];
    for (let i = 0; i < N; i++) {
      fish.push({
        p: new THREE.Vector3(0.1 + (r() - 0.5) * 0.2, 0.25 + (r() - 0.5) * 0.06, (r() - 0.5) * 0.15),
        v: new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize().multiplyScalar(0.04),
        phase: r() * 6.28, pers: 0.85 + r() * 0.3, size: 0.85 + r() * 0.3
      });
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), zero = new THREE.Vector3(), tgt = new THREE.Vector3();
    const acc = new THREE.Vector3(), sep = new THREE.Vector3(), ali = new THREE.Vector3(), coh = new THREE.Vector3(), d = new THREE.Vector3(), goal = new THREE.Vector3();

    function update(dt, t) {
      dt = Math.min(dt, 0.05);
      goal.set(0.28 * Math.sin(t * 0.045) + 0.1 * Math.sin(t * 0.11), 0.24 + 0.05 * Math.sin(t * 0.07), 0.08 * Math.sin(t * 0.06 + 1));
      for (let i = 0; i < N; i++) {
        const f = fish[i]; acc.set(0, 0, 0); sep.set(0, 0, 0); ali.set(0, 0, 0); coh.set(0, 0, 0);
        let n = 0;
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          d.subVectors(f.p, fish[j].p); const dist = d.length();
          if (dist < 0.022) sep.addScaledVector(d, 1 / Math.max(dist * dist, 1e-5));
          if (dist < 0.1) { ali.add(fish[j].v); coh.add(fish[j].p); n++; }
        }
        acc.addScaledVector(sep, 0.0009);
        if (n) {
          ali.divideScalar(n).sub(f.v).multiplyScalar(0.9);
          coh.divideScalar(n).sub(f.p).multiplyScalar(0.7);
          acc.add(ali).add(coh);
        }
        d.subVectors(goal, f.p); acc.addScaledVector(d, 0.35);
        // walls / floor / surface
        const m = 0.045;
        if (f.p.x > I.x - m) acc.x -= (f.p.x - (I.x - m)) * 30;
        if (f.p.x < -I.x + m) acc.x += (-I.x + m - f.p.x) * 30;
        if (f.p.z > I.z - m) acc.z -= (f.p.z - (I.z - m)) * 30;
        if (f.p.z < -I.z + m) acc.z += (-I.z + m - f.p.z) * 30;
        const gy = aq.ground(f.p.x, f.p.z) + 0.03;
        if (f.p.y < gy) acc.y += (gy - f.p.y) * 40;
        if (f.p.y > I.water - 0.02) acc.y -= (f.p.y - (I.water - 0.02)) * 40;
        // look ahead for rocks
        const ax = f.p.x + f.v.x * 0.6, az = f.p.z + f.v.z * 0.6;
        if (aq.ground(ax, az) + 0.02 > f.p.y) { acc.y += 0.25; acc.x -= f.v.x * 1.5; acc.z -= f.v.z * 1.5; }
        acc.x += PC.noise3(t * 0.5, i, 0) * 0.08; acc.z += PC.noise3(t * 0.5, i, 4) * 0.08;
        acc.clampLength(0, 0.35);
        f.v.addScaledVector(acc, dt);
        f.v.y *= 0.96;
        const sp = f.v.length(), maxS = 0.1 * f.pers, minS = 0.022;
        if (sp > maxS) f.v.multiplyScalar(maxS / sp); else if (sp < minS) f.v.multiplyScalar(minS / Math.max(sp, 1e-5));
        f.p.addScaledVector(f.v, dt);
        const spd = f.v.length();
        f.phase += dt * (14 + spd * 260);
        aPhase.array[i] = f.phase; aAmp.array[i] = 0.5 + spd * 12;
        tgt.copy(f.v).normalize().negate();
        m4.lookAt(zero, tgt, up); q.setFromRotationMatrix(m4);
        s.setScalar(f.size);
        m4.compose(f.p, q, s); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true; aPhase.needsUpdate = true; aAmp.needsUpdate = true;
    }
    return { mesh, update };
  }

  // =======================================================================
  function buildShrimp(tank, aq) {
    // colony: 24 founders, then clutches of shrimplets on a logistic curve toward ~96
    const N = 96, FOUNDERS = 24, CAP = 96, RATE = 0.04, GESTATION = 18;
    const birthDay = [];
    for (let i = 0; i < N; i++) {
      if (i < FOUNDERS) { birthDay.push(-60 - i); continue; }
      const n = i + 1, A = CAP / FOUNDERS - 1;
      const d = GESTATION - Math.log((CAP / Math.min(n, CAP - 0.5) - 1) / A) / RATE;
      birthDay.push(Math.ceil(d / 9) * 9 + (i % 4) * 0.4);
    }
    const pos = [], nor = [], col = [], part = [];
    const add = (geo, mtx, c, pt) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.applyMatrix4(mtx);
      const pa = g.attributes.position.array, na = g.attributes.normal.array;
      for (let i = 0; i < pa.length; i += 3) { pos.push(pa[i], pa[i + 1], pa[i + 2]); nor.push(na[i], na[i + 1], na[i + 2]); col.push(c[0], c[1], c[2]); part.push(pt); }
    };
    const M = (x, y, z, sx, sy, sz, rx, ry, rz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx, sy, sz));
    const sph = new THREE.SphereGeometry(1, 12, 8);
    const red = [0.78, 0.06, 0.04], deep = [0.6, 0.03, 0.03], pale = [0.85, 0.25, 0.2];
    add(sph, M(0, 0.0036, 0.0042, 0.0028, 0.003, 0.0048), red, 0);
    const seg = [[0.0004, 0.0037, 0.0026, 0.0028], [-0.0024, 0.0035, 0.0024, 0.0026], [-0.005, 0.0031, 0.0021, 0.0023], [-0.0074, 0.0026, 0.0017, 0.0019], [-0.0093, 0.002, 0.0013, 0.0015]];
    seg.forEach(([z, y, w, h], i) => add(sph, M(0, y, z, w, h, 0.0017, 0.15 * i, 0, 0), i % 2 ? red : deep, 0));
    // tail fan
    const fan = new THREE.ConeGeometry(1, 1, 3); fan.scale(1, 1, 0.12);
    for (const a of [-0.5, 0, 0.5]) add(fan, M(0, 0.0017, -0.0118, 0.0013, 0.0034, 0.0013, Math.PI / 2 + 0.25, 0, a), pale, 0);
    // rostrum & eyes
    add(new THREE.ConeGeometry(1, 1, 6), M(0, 0.0043, 0.0098, 0.00045, 0.0035, 0.00045, Math.PI / 2 - 0.15, 0, 0), red, 0);
    for (const sx of [-1, 1]) add(sph, M(sx * 0.0017, 0.0044, 0.0083, 0.0006, 0.0006, 0.0006), [0.02, 0.02, 0.02], 0);
    // antennae
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 4, 6);
    for (const sx of [-1, 1]) {
      const m = new THREE.Matrix4().makeTranslation(0, 0.5, 0);
      m.premultiply(new THREE.Matrix4().makeScale(0.00012, 0.019, 0.00012));
      m.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.25, 0, -sx * 0.45)));
      m.premultiply(new THREE.Matrix4().makeTranslation(sx * 0.0008, 0.0042, 0.0088));
      add(cyl, m, pale, 2);
    }
    // walking legs
    for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) {
      const z = 0.0068 - i * 0.0016;
      const m = new THREE.Matrix4().makeTranslation(0, -0.5, 0);
      m.premultiply(new THREE.Matrix4().makeScale(0.00018, 0.0042, 0.00018));
      m.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.1 - i * 0.08, 0, sx * 0.75)));
      m.premultiply(new THREE.Matrix4().makeTranslation(sx * 0.0012, 0.0026, z));
      add(cyl, m, pale, 1);
    }
    // swimmerets
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) add(cyl, M(sx * 0.0008, 0.0012, -0.001 - i * 0.0022, 0.00022, 0.0018, 0.00022, 0.3, 0, sx * 0.2), pale, 1);
    // egg clutch carried under the abdomen (shown only on berried females)
    const egg = new THREE.SphereGeometry(1, 6, 4), er = PC.rng(3);
    for (let i = 0; i < 16; i++) add(egg, M((er() - 0.5) * 0.0024, 0.0011 + er() * 0.0008, -0.0012 - er() * 0.0055, 0.00055, 0.00055, 0.00055), [0.85, 0.72, 0.18], 3);

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    const aLeg = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); aLeg.setUsage(THREE.DynamicDrawUsage);
    const aWalk = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); aWalk.setUsage(THREE.DynamicDrawUsage);
    const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    const aBerried = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); aBerried.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aLeg', aLeg); geo.setAttribute('aWalk', aWalk); geo.setAttribute('aSeed', aSeed); geo.setAttribute('aBerried', aBerried);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.05, emissive: 0x2a0402 });
    PC.addCaustics(mat, {
      key: 'shrimp', strength: 0.5,
      vertexHead: 'attribute float aPart; attribute float aLeg; attribute float aWalk; attribute float aSeed; attribute float aBerried;\n',
      vertex: `
        if (aPart > 2.5) transformed = mix(vec3(0.0, 0.0018, -0.004), transformed, aBerried);
        if (aPart > 0.5 && aPart < 1.5) {
          float side = sign(position.x);
          transformed.z += sin(aLeg + position.z * 1800.0 + side * 1.7) * 0.0011 * aWalk * clamp((0.003 - position.y) / 0.003, 0.0, 1.0);
          transformed.y += max(0.0, sin(aLeg + position.z * 1800.0 + side * 1.7 + 1.57)) * 0.0006 * aWalk;
          transformed.z += sin(uTime * 9.0 + aSeed + position.z * 2000.0) * 0.0003 * step(position.z, 0.0);
        }
        if (aPart > 1.5 && aPart < 2.5) {
          float k = clamp((position.z - 0.009) / 0.016, 0.0, 1.0);
          transformed.x += sin(uTime * 2.2 + aSeed + k * 3.0) * 0.003 * k;
          transformed.y += cos(uTime * 1.7 + aSeed * 1.3) * 0.002 * k;
        }`
    });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.frustumCulled = false; mesh.castShadow = false; tank.add(mesh);

    const r = PC.rng(55), I = aq.inner, list = [];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      let x, z;
      do { x = (r() * 2 - 1) * (I.x - 0.03); z = (r() * 2 - 1) * (I.z - 0.03); } while (false);
      list.push({ x, z, yOff: 0, h: r() * 6.28, state: 'graze', timer: r() * 4, sp: 0, legs: 0, size: 0.8 + r() * 0.35, vy: 0, born: i < FOUNDERS, hue: r(), sat: r(), lit: r(), female: r() < 0.55 });
      aSeed.array[i] = r() * 10;
      c.setHSL(0.995 + list[i].hue * 0.02, 0.8 + list[i].sat * 0.15, 0.62 + list[i].lit * 0.3); mesh.setColorAt(i, c);
    }
    let alive = FOUNDERS, colourTimer = 0;
    mesh.count = alive;
    function population(days) { let n = 0; while (n < N && birthDay[n] <= days) n++; return n; }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), n = new THREE.Vector3(), fwd = new THREE.Vector3(), xa = new THREE.Vector3(), pos3 = new THREE.Vector3(), sc = new THREE.Vector3();
    function update(dt, t, days) {
      dt = Math.min(dt, 0.05);
      alive = population(days);
      mesh.count = alive;
      colourTimer -= dt;
      const recolour = colourTimer <= 0; if (recolour) colourTimer = 1;
      for (let i = 0; i < alive; i++) {
        const s = list[i];
        const age = days - birthDay[i];
        if (!s.born) {
          // drop the shrimplet next to a mother
          const mom = list[(i * 7) % FOUNDERS];
          s.x = PC.clamp(mom.x + (r() - 0.5) * 0.03, -I.x + 0.02, I.x - 0.02); s.z = PC.clamp(mom.z + (r() - 0.5) * 0.03, -I.z + 0.02, I.z - 0.02);
          s.born = true;
        }
        const grown = PC.smooth(0, 50, age);
        if (recolour) {
          c.setHSL(0.995 + s.hue * 0.02, PC.lerp(0.25, 0.8 + s.sat * 0.15, grown), PC.lerp(0.8, 0.62 + s.lit * 0.3, grown));
          mesh.setColorAt(i, c);
          aBerried.array[i] = s.female && age > 45 && ((days + i * 7) % 32) < 20 ? 1 : 0;
        }
        s.timer -= dt;
        if (s.timer <= 0) {
          const roll = r();
          if (s.state === 'swim') { s.state = 'graze'; s.timer = 2 + r() * 5; }
          else if (roll < 0.06) { s.state = 'swim'; s.timer = 1.2 + r() * 1.5; s.vy = 0.05 + r() * 0.04; }
          else if (roll < 0.55) { s.state = 'walk'; s.timer = 1 + r() * 3; s.turn = (r() - 0.5) * 1.2; }
          else { s.state = 'graze'; s.timer = 2 + r() * 6; }
        }
        let target = 0, walk = 0;
        if (s.state === 'walk') { target = 0.009; walk = 1; s.h += s.turn * dt; }
        else if (s.state === 'graze') { target = 0; walk = 0.35; s.h += Math.sin(t * 1.3 + i) * 0.15 * dt; }
        else { target = 0.03; walk = 0.6; }
        s.sp = PC.lerp(s.sp, target, Math.min(1, dt * 4));
        let nx = s.x + Math.sin(s.h) * s.sp * dt, nz = s.z + Math.cos(s.h) * s.sp * dt;
        if (Math.abs(nx) > I.x - 0.012 || Math.abs(nz) > I.z - 0.012) { s.h += Math.PI * (0.6 + r() * 0.4); nx = s.x; nz = s.z; }
        const gh = aq.ground(nx, nz), gh0 = aq.ground(s.x, s.z);
        if (s.state !== 'swim' && gh - gh0 > 0.02) { s.h += 1.5; nx = s.x; nz = s.z; }
        s.x = nx; s.z = nz;
        if (s.state === 'swim') { s.yOff += s.vy * dt; s.vy -= 0.06 * dt; if (s.yOff < 0) { s.yOff = 0; } }
        else { s.yOff = Math.max(0, s.yOff - dt * 0.03); }
        s.legs += dt * (walk * 14 + 2);
        aLeg.array[i] = s.legs; aWalk.array[i] = walk;
        // orient to ground slope
        const e = 0.006, g0 = aq.ground(s.x, s.z);
        n.set(aq.ground(s.x - e, s.z) - aq.ground(s.x + e, s.z), 2 * e, aq.ground(s.x, s.z - e) - aq.ground(s.x, s.z + e)).normalize();
        if (s.yOff > 0.003) n.lerp(new THREE.Vector3(0, 1, 0), 0.7).normalize();
        fwd.set(Math.sin(s.h), 0, Math.cos(s.h)); fwd.addScaledVector(n, -fwd.dot(n)).normalize();
        xa.crossVectors(n, fwd);
        m4.makeBasis(xa, n, fwd); q.setFromRotationMatrix(m4);
        pos3.set(s.x, g0 + s.yOff + 0.0004, s.z); sc.setScalar(s.size * (0.3 + 0.7 * grown));
        m4.compose(pos3, q, sc); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true; aLeg.needsUpdate = true; aWalk.needsUpdate = true;
      if (recolour) { if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; aBerried.needsUpdate = true; }
    }
    return { mesh, update, count: () => alive, population };
  }
})(window.PC);
