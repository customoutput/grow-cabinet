// Underwater shading shared by everything inside the tank:
//  - light absorbed along the real path through the water box (reds fade first), with in-scatter haze
//  - animated caustics on upward-facing surfaces
//  - optional world-space vertex motion (carpet sway, fish) that also drives the depth/shadow passes
import * as THREE from 'three';

export const WU = {
  uTime: { value: 0 },
  uBoxMin: { value: new THREE.Vector3() },
  uBoxMax: { value: new THREE.Vector3() },
  uWaterLight: { value: 1 },
  uCaustic: { value: 1 },
  uFlow: { value: new THREE.Vector2(1, 0.15) }
};

const CAUSTIC = `
  float causticF(vec2 uv, float t) {
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

const FRAG_HEAD = `
  uniform float uTime; uniform vec3 uBoxMin; uniform vec3 uBoxMax; uniform float uWaterLight; uniform float uCaustic;
  varying vec3 vWPos; varying vec3 vWNrm;
  ${CAUSTIC}
  float waterPath(vec3 p, vec3 c) {
    vec3 d = c - p;
    vec3 dd = mix(d, vec3(1e-6), step(abs(d), vec3(1e-6)));
    vec3 inv = 1.0 / dd;
    vec3 t0 = (uBoxMin - p) * inv, t1 = (uBoxMax - p) * inv;
    vec3 tn = min(t0, t1), tf = max(t0, t1);
    float a = max(max(tn.x, tn.y), max(tn.z, 0.0));
    float b = min(min(tf.x, tf.y), min(tf.z, 1.0));
    return max(b - a, 0.0) * length(d);
  }`;

const VERT_HEAD = `uniform float uTime; uniform vec2 uFlow; varying vec3 vWPos; varying vec3 vWNrm;\n`;

// replaces project_vertex so that motion happens in world space after instancing
function projectWithMotion(motion) {
  return `
    vec4 wpos = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      wpos = instanceMatrix * wpos;
      vec3 instO = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    #else
      vec3 instO = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #endif
    wpos = modelMatrix * wpos;
    ${motion || ''}
    vWPos = wpos.xyz;
    vec4 mvPosition = viewMatrix * wpos;
    gl_Position = projectionMatrix * mvPosition;`;
}

export function patchVertex(sh, opts) {
  Object.assign(sh.uniforms, WU);
  sh.vertexShader = VERT_HEAD + (opts.vertexHead || '') + '\n' + sh.vertexShader
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (opts.local || ''))
    .replace('#include <project_vertex>', projectWithMotion(opts.motion))
    .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
      { vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWNrm = normalize(mat3(modelMatrix) * wn); }`)
    .replace('void main() {', 'void main() {\n vWNrm = vec3(0.0, 1.0, 0.0);');
}

// opts: { key, caustic (strength), fog (bool, default true), motion, local, vertexHead, fragHead, color, rough, normal, post }
export function underwater(mat, opts = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    patchVertex(sh, opts);
    let fs = sh.fragmentShader;
    if (opts.color) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + opts.color);
    if (opts.rough) fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + opts.rough);
    if (opts.normal) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + opts.normal);
    const cs = (opts.caustic ?? 0.9).toFixed(3);
    fs = fs.replace('#include <opaque_fragment>', `
      {
        vec3 wp = vWPos;
        float inWater = step(wp.y, uBoxMax.y) * step(uBoxMin.x, wp.x) * step(wp.x, uBoxMax.x) * step(uBoxMin.z, wp.z) * step(wp.z, uBoxMax.z);
        float up = clamp(normalize(vWNrm).y * 0.85 + 0.15, 0.0, 1.0);
        float cc = min(causticF(wp.xz * 3.4, uTime * 0.5) + 0.6 * causticF(wp.xz * 4.3 + 0.37, uTime * 0.41), 1.6);
        outgoingLight += diffuseColor.rgb * cc * up * inWater * uCaustic * ${cs};
        ${opts.post || ''}
        ${opts.fog === false ? '' : `
        float L = waterPath(wp, cameraPosition);
        vec3 absorb = exp(-L * vec3(1.1, 0.38, 0.62));
        vec3 haze = vec3(0.60, 0.80, 0.70) * uWaterLight;
        outgoingLight = outgoingLight * absorb + haze * (1.0 - exp(-L * 0.55));`}
      }
      #include <opaque_fragment>`);
    sh.fragmentShader = FRAG_HEAD + '\n' + (opts.fragHead || '') + '\n' + fs;
  };
  mat.customProgramCacheKey = () => 'uw-' + (opts.key || 'base');
  return mat;
}

// depth material that moves exactly like its colour material (shadows + post depth prepass)
export function motionDepth(opts, alphaMap) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: alphaMap || null, alphaTest: alphaMap ? 0.5 : 0, side: THREE.DoubleSide });
  d.onBeforeCompile = (sh) => patchVertex(sh, opts);
  d.customProgramCacheKey = () => 'uwd-' + (opts.key || 'base');
  return d;
}
