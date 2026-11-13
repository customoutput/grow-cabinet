// Camera pipeline: MSAA beauty pass, alpha-aware depth prepass, contact AO, depth of field,
// bloom on the LEDs, filmic tone mapping, then vignette, slight lens fringing and grain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const DEPTH_HEAD = `
  #include <packing>
  uniform sampler2D tDepth; uniform float cameraNear; uniform float cameraFar;
  float viewZAt(vec2 uv) { return perspectiveDepthToViewZ(unpackRGBAToDepth(texture2D(tDepth, uv)), cameraNear, cameraFar); }
`;

export function createPost(renderer, scene, camera, opts = {}) {
  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const msaa = renderer.capabilities.isWebGL2 ? 4 : 0;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: msaa }));
  composer.setPixelRatio(1);

  // ---- depth prepass that respects leaf cut-outs ----
  const depthRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType });
  const plainDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  const depthMats = new WeakMap(), saved = [];
  function depthMatFor(mat, o) {
    if (o && o.customDepthMaterial) return o.customDepthMaterial;
    if (!mat.alphaMap) return plainDepth;
    let d = depthMats.get(mat);
    if (!d) { d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: mat.alphaMap, alphaTest: 0.5, side: THREE.DoubleSide }); depthMats.set(mat, d); }
    return d;
  }
  function renderDepth() {
    scene.traverse((o) => {
      if (!o.isMesh && !o.isPoints) return;
      if (o.isPoints || o.userData.noDepth || (o.material.transparent && !o.material.alphaMap)) { if (o.visible) { saved.push([o, null]); o.visible = false; } return; }
      saved.push([o, o.material]); o.material = depthMatFor(o.material, o);
    });
    const bg = scene.background, au = renderer.shadowMap.autoUpdate;
    scene.background = null; renderer.shadowMap.autoUpdate = false;
    const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setClearColor(0xffffff, 1);
    renderer.setRenderTarget(depthRT); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
    renderer.setClearColor(cc, ca); scene.background = bg; renderer.shadowMap.autoUpdate = au;
    for (const [o, m] of saved) { if (m) o.material = m; else o.visible = true; }
    saved.length = 0;
  }

  // ---- ambient occlusion (half resolution, depth-aware blur) ----
  const aoRT = new THREE.WebGLRenderTarget(size.x >> 1, size.y >> 1, { type: THREE.HalfFloatType });
  const aoBlurRT = aoRT.clone();
  const aoMat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: depthRT.texture }, cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
      projInv: { value: new THREE.Matrix4() }, projScale: { value: 1 }, radius: { value: 0.028 }, resolution: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: DEPTH_HEAD + `
      uniform mat4 projInv; uniform float projScale; uniform float radius; uniform vec2 resolution; varying vec2 vUv;
      vec3 viewPos(vec2 uv) { float z = viewZAt(uv); vec4 c = projInv * vec4(uv * 2.0 - 1.0, 0.0, 1.0); vec3 r = c.xyz / c.w; return r * (z / r.z); }
      float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      void main() {
        float d = unpackRGBAToDepth(texture2D(tDepth, vUv));
        if (d > 0.9999) { gl_FragColor = vec4(1.0); return; }
        vec3 P = viewPos(vUv);
        vec3 N = normalize(cross(dFdx(P), dFdy(P)));
        float rpx = radius * projScale / -P.z;
        float occ = 0.0; float rot = ign(gl_FragCoord.xy) * 6.2831;
        for (int i = 0; i < 14; i++) {
          float fi = float(i);
          float a = fi * 2.39996 + rot; float rr = (fi + 0.5) / 14.0;
          vec2 o = vec2(cos(a), sin(a)) * rr * rpx / resolution;
          vec3 S = viewPos(vUv + o);
          vec3 v = S - P; float vv = dot(v, v);
          float fall = max(0.0, 1.0 - vv / (radius * radius * 4.0));
          occ += max(0.0, dot(v, N) - 0.0015 * -P.z) / (vv + 0.00002) * fall * 0.0006;
        }
        float ao = clamp(1.0 - occ / 14.0 * 26.0, 0.0, 1.0);
        gl_FragColor = vec4(vec3(ao), 1.0);
      }`
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tAO: { value: aoRT.texture }, tDepth: { value: depthRT.texture }, cameraNear: { value: camera.near }, cameraFar: { value: camera.far }, texel: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: DEPTH_HEAD + `
      uniform sampler2D tAO; uniform vec2 texel; varying vec2 vUv;
      void main() {
        float z0 = viewZAt(vUv); float s = 0.0, w = 0.0;
        for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
          vec2 uv = vUv + vec2(float(x), float(y)) * texel;
          float wz = exp(-abs(viewZAt(uv) - z0) * 120.0);
          float wk = wz * (1.0 - 0.12 * float(abs(x) + abs(y)));
          s += texture2D(tAO, uv).r * wk; w += wk;
        }
        gl_FragColor = vec4(vec3(s / max(w, 1e-4)), 1.0);
      }`
  });
  const aoQuad = new FullScreenQuad(aoMat), blurQuad = new FullScreenQuad(blurMat);

  // ---- composer passes ----
  composer.addPass(new RenderPass(scene, camera));
  const aoApply = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tAO: { value: aoBlurRT.texture }, strength: { value: 0.85 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tAO; uniform float strength; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); float ao = texture2D(tAO, vUv).r; gl_FragColor = vec4(c.rgb * mix(1.0, ao, strength), c.a); }`
  });
  aoApply.uniforms.tAO.value = aoBlurRT.texture;
  composer.addPass(aoApply);

  const dof = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: depthRT.texture }, cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
      focus: { value: 0.6 }, aperture: { value: 7.0 }, maxCoc: { value: 10.0 }, resolution: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: DEPTH_HEAD + `
      uniform sampler2D tDiffuse; uniform float focus; uniform float aperture; uniform float maxCoc; uniform vec2 resolution; varying vec2 vUv;
      float coc(float z) { float d = -z; return clamp(abs(d - focus) / d * aperture * resolution.y / 900.0, 0.0, maxCoc * resolution.y / 900.0); }
      void main() {
        float zc = viewZAt(vUv); float cc = coc(zc);
        vec3 acc = texture2D(tDiffuse, vUv).rgb; float wsum = 1.0;
        const int TAPS = 44;
        for (int i = 1; i < TAPS; i++) {
          float fi = float(i);
          float r = sqrt(fi / float(TAPS)) * maxCoc * resolution.y / 900.0;
          float a = fi * 2.39996;
          vec2 uv = vUv + vec2(cos(a), sin(a)) * r / resolution;
          float zs = viewZAt(uv); float cs = coc(zs);
          if (zs < zc) cs = min(cs, cc * 1.6 + 0.5);       // keep far blur from bleeding over sharp foreground
          float w = smoothstep(r - 1.0, r + 1.0, cs);
          acc += texture2D(tDiffuse, uv).rgb * w; wsum += w;
        }
        gl_FragColor = vec4(acc / wsum, 1.0);
      }`
  });
  dof.uniforms.tDepth.value = depthRT.texture;
  composer.addPass(dof);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.35, 0.55, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.035 }, vignette: { value: 0.42 }, fringe: { value: 0.0016 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float grain; uniform float vignette; uniform float fringe; varying vec2 vUv;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d, d);
        vec3 c;
        c.r = texture2D(tDiffuse, vUv - d * fringe * r2 * 4.0).r;
        c.g = texture2D(tDiffuse, vUv).g;
        c.b = texture2D(tDiffuse, vUv + d * fringe * r2 * 4.0).b;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(c, c * vec3(1.02, 1.0, 0.97), smoothstep(0.4, 0.9, l));       // warm highlights
        c = mix(c, c * vec3(0.96, 1.0, 1.03), 1.0 - smoothstep(0.05, 0.35, l)); // cool shadows
        c *= 1.0 - vignette * smoothstep(0.08, 0.55, r2);
        float g = hash(vUv * 1024.0 + fract(time) * 37.0) - 0.5;
        c += g * grain * (1.0 - l * 0.6);
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  composer.addPass(grade);

  const api = {
    composer, cinematic: true,
    setFocus(dist) { dof.uniforms.focus.value = dist; },
    setCinematic(on) { api.cinematic = on; dof.enabled = on; grade.uniforms.grain.value = on ? 0.035 : 0.0; grade.uniforms.fringe.value = on ? 0.0016 : 0.0; grade.uniforms.vignette.value = on ? 0.42 : 0.2; },
    setSize(w, h) {
      composer.setSize(w, h); depthRT.setSize(w, h); aoRT.setSize(w >> 1, h >> 1); aoBlurRT.setSize(w >> 1, h >> 1);
      bloom.resolution.set(w, h);
      dof.uniforms.resolution.value.set(w, h); aoMat.uniforms.resolution.value.set(w >> 1, h >> 1);
      blurMat.uniforms.texel.value.set(2 / w, 2 / h);
    },
    render(t) {
      aoMat.uniforms.projInv.value.copy(camera.projectionMatrixInverse);
      aoMat.uniforms.projScale.value = (aoRT.height * 0.5) * camera.projectionMatrix.elements[5];
      renderDepth();
      renderer.setRenderTarget(aoRT); aoQuad.render(renderer);
      renderer.setRenderTarget(aoBlurRT); blurQuad.render(renderer);
      renderer.setRenderTarget(null);
      grade.uniforms.time.value = t;
      composer.render();
    }
  };
  api.setSize(size.x, size.y);
  return api;
}
