import * as THREE from "three";

const BULB_VERTEX_SHADER = `
  varying vec3 vViewNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const BULB_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uFresnelPower;
  uniform float uFresnelStrength;
  uniform vec3 uHighlightDir;
  uniform float uHighlightPower;
  uniform float uHighlightStrength;
  varying vec3 vViewNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;
  void main() {
    vec3 N = normalize(vViewNormal);
    vec3 V = normalize(vViewDir);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);
    float bodyMask = 1.0 - fresnel * uFresnelStrength;
    vec3 wN = normalize(vWorldNormal);
    float spec = pow(max(dot(wN, uHighlightDir), 0.0), uHighlightPower);
    vec3 emit = uColor * uIntensity;
    vec3 result = emit * bodyMask + vec3(spec * uHighlightStrength) * uIntensity;
    gl_FragColor = vec4(result, 1.0);
  }
`;

export function createBulbMaterial({
  color = 0xffffff,
  intensity = 1,
  fresnelPower = 2.5,
  fresnelStrength = 0.5,
  highlightDir = [0.4, 0.7, 0.6],
  highlightPower = 80,
  highlightStrength = 2,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color().setHex(color) },
      uIntensity: { value: intensity },
      uFresnelPower: { value: fresnelPower },
      uFresnelStrength: { value: fresnelStrength },
      uHighlightDir: {
        value: new THREE.Vector3(...highlightDir).normalize(),
      },
      uHighlightPower: { value: highlightPower },
      uHighlightStrength: { value: highlightStrength },
    },
    vertexShader: BULB_VERTEX_SHADER,
    fragmentShader: BULB_FRAGMENT_SHADER,
    toneMapped: false,
  });
}

const WATER_NOISE_PARS = /* glsl */ `
  uniform float uTime;
  uniform vec2 uFlowDir;
  uniform float uFlowSpeed;
  uniform float uFlowScale;
  uniform float uStretch;
  uniform float uContrast;

  float waterHash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float waterValueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = waterHash21(i);
    float b = waterHash21(i + vec2(1.0, 0.0));
    float c = waterHash21(i + vec2(0.0, 1.0));
    float d = waterHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float waterHeight(vec2 uv) {
    vec2 perp = vec2(-uFlowDir.y, uFlowDir.x);
    vec2 aligned = vec2(dot(uv, perp), dot(uv, uFlowDir));
    vec2 stretched = vec2(aligned.x, aligned.y * uStretch);
    vec2 flowed = vec2(stretched.x, stretched.y - uTime * uFlowSpeed);
    float h = waterValueNoise(flowed * uFlowScale) * 0.6
            + waterValueNoise(flowed * uFlowScale * 2.3 + vec2(50.0)) * 0.4;
    return clamp((h - 0.5) * uContrast + 0.5, 0.0, 1.0);
  }
`;

export function createWaterMaterial({
  color = 0x415062,
  opacity = 0.85,
  metalness = 0,
  roughness = 0.1,
  flowDir = [0, 1],
  flowSpeed = 0.1,
  flowScale = 25,
  ridgeStrength = 0.8,
  stretch = 0.05,
  alphaRange = [0.5, 1.0],
  displacement = 0.05,
  contrast = 5,
} = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHex(color),
    metalness,
    roughness,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });

  const uniforms = {
    uTime: { value: 0 },
    uFlowDir: { value: new THREE.Vector2(...flowDir).normalize() },
    uFlowSpeed: { value: flowSpeed },
    uFlowScale: { value: flowScale },
    uRidgeStrength: { value: ridgeStrength },
    uStretch: { value: stretch },
    uAlphaMin: { value: alphaRange[0] },
    uAlphaMax: { value: alphaRange[1] },
    uDisplacement: { value: displacement },
    uContrast: { value: contrast },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      varying vec2 vWaterUv;
      varying float vWaterHeight;
      uniform float uDisplacement;
      ${WATER_NOISE_PARS}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vWaterUv = uv;
      vWaterHeight = waterHeight(vWaterUv);
      transformed += normal * (vWaterHeight - 0.5) * uDisplacement;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying vec2 vWaterUv;
      varying float vWaterHeight;
      uniform float uRidgeStrength;
      uniform float uAlphaMin;
      uniform float uAlphaMax;
      ${WATER_NOISE_PARS}`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphamap_fragment>",
      `#include <alphamap_fragment>
      diffuseColor.a *= mix(uAlphaMin, uAlphaMax, vWaterHeight);`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      {
        float eps = 0.1;
        float h0 = vWaterHeight;
        float hx = waterHeight(vWaterUv + vec2(eps, 0.0));
        float hy = waterHeight(vWaterUv + vec2(0.0, eps));
        vec2 grad = vec2(h0 - hx, h0 - hy) * uRidgeStrength;

        vec3 viewPos = -vViewPosition;
        vec3 dPdx = dFdx(viewPos);
        vec3 dPdy = dFdy(viewPos);
        vec2 dUVdx = dFdx(vWaterUv);
        vec2 dUVdy = dFdy(vWaterUv);
        float det = dUVdx.x * dUVdy.y - dUVdy.x * dUVdx.y;
        if (abs(det) > 0.0000001) {
          vec3 T = normalize((dPdx * dUVdy.y - dPdy * dUVdx.y) / det);
          vec3 B = normalize((-dPdx * dUVdy.x + dPdy * dUVdx.x) / det);
          normal = normalize(normal + T * grad.x + B * grad.y);
        }
      }`,
    );
  };

  mat.uniforms = uniforms;
  mat.name = "water";
  return mat;
}
