import * as THREE from "three";

// Gem: a faceted-jewel look on top of a low-roughness standard material. The
// point lights already in the block glint off the crisp specular (the "facets"),
// while a fresnel-driven, hue-rotating iridescence is injected into the emissive
// term so the body cycles through the spectrum and the grazing edges disperse
// into a complementary prismatic rim + a white-hot sparkle. Everything is driven
// by `uTime` so it animates with a single uniform tick (like the water shader),
// and it needs no environment map — the color comes entirely from the shader.
// On top of that sits the shine: a mirror clearcoat, a fake studio reflection
// (a hot key light plus a softbox strip, looked up along the reflected view
// ray) and per-facet twinkles that flash as the gem turns.
const GEM_PARS = /* glsl */ `
  uniform float uTime;
  uniform float uHueBase;
  uniform float uHueSpeed;
  uniform float uDispersion;
  uniform float uFresnelPower;
  uniform float uEdgeGain;
  uniform float uInnerGain;
  uniform float uSparkle;
  uniform float uBrightness;
  uniform float uShine;
  uniform float uTwinkle;

  // Full-saturation hue wheel (HSV with s = v = 1) -> rgb.
  vec3 gemHue2rgb(float h) {
    h = fract(h);
    vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
    return clamp(min(k, 4.0 - k), 0.0, 1.0);
  }
`;

export function createGemMaterial({
  color = 0x3a6ea5,
  hueBase,
  hueSpeed = 0.5,
  dispersion = 0.55,
  fresnelPower = 2.6,
  edgeGain = 1.35,
  innerGain = 0.28,
  sparkle = 0.6,
  shine = 0.8,
  twinkle = 0.4,
  roughness = 0.02,
  metalness = 0.5,
} = {}) {
  const tint = new THREE.Color().setHex(
    typeof color === "number" ? color : 0x3a6ea5,
  );
  const hsl = { h: 0, s: 0, l: 0 };
  tint.getHSL(hsl);

  // Deep tinted body so the diffuse never washes out the injected iridescence;
  // the low roughness + mirror clearcoat let the block's point lights read as
  // crisp facet glints.
  const mat = new THREE.MeshPhysicalMaterial({
    color: tint,
    roughness,
    metalness,
    clearcoat: 1,
    clearcoatRoughness: 0,
  });

  const uniforms = {
    uTime: { value: 0 },
    uHueBase: { value: hueBase ?? hsl.h },
    uHueSpeed: { value: hueSpeed },
    uDispersion: { value: dispersion },
    uFresnelPower: { value: fresnelPower },
    uEdgeGain: { value: edgeGain },
    uInnerGain: { value: innerGain },
    uSparkle: { value: sparkle },
    uShine: { value: shine },
    uTwinkle: { value: twinkle },
    // Scroll/column dim (1 = full). Driven from the totem's per-mesh emissive
    // fade so the gem dims off-focus like neon and the other glows.
    uBrightness: { value: 1 },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${GEM_PARS}`,
    );

    // Emissive runs after the normal is resolved (`normal` is view-space, unit)
    // and after `totalEmissiveRadiance` is seeded, so we add our glow there.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      {
        vec3 vd = normalize(vViewPosition);
        float ndv = clamp(dot(normalize(normal), vd), 0.0, 1.0);
        float fres = pow(1.0 - ndv, uFresnelPower);
        float h = uHueBase + uTime * uHueSpeed;
        float facet = dot(normalize(normal), vec3(0.5773)) * 0.5 + 0.5;
        vec3 body = gemHue2rgb(h + facet * 0.12);
        vec3 edge = gemHue2rgb(h + fres * uDispersion + 0.5);
        vec3 gem = body * uInnerGain + edge * (fres * uEdgeGain);
        gem += pow(fres, 6.0) * uSparkle;

        // Studio reflection along the reflected view ray (view space): a tight
        // key light up and to the right, and a soft strip overhead. Facets are
        // flat, so each one catches it whole and flashes as the gem turns.
        vec3 n = normalize(normal);
        vec3 r = reflect(-vd, n);
        float key = pow(max(dot(r, normalize(vec3(0.45, 0.7, 0.55))), 0.0), 48.0) * 4.0;
        float strip = smoothstep(0.55, 0.85, r.y) * (1.0 - smoothstep(0.85, 1.0, r.y)) * 0.9;
        vec3 shine = vec3(key + strip) * mix(vec3(1.0), edge, 0.25);

        // Twinkle: each facet (keyed by its quantized normal) pulses on its
        // own random beat, sharpened so it reads as a brief star-like flash.
        float seed = fract(sin(dot(floor(n * 12.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float tw = pow(0.5 + 0.5 * sin(seed * 6.2832 + uTime * (2.0 + seed * 3.0)), 32.0);
        shine += vec3(tw * (0.4 + fres) * 2.5) * uTwinkle;

        gem += shine * uShine;
        totalEmissiveRadiance += gem * uBrightness;
      }`,
    );
  };

  mat.uniforms = uniforms;
  mat.name = "gem";
  return mat;
}

// Block-decorator effect (mirrors WaterEffect): swaps any `type: "gem"` mesh to
// a gem material and advances every instance's clock from one `update(t)` call.
export class GemEffect {
  constructor() {
    this.materials = [];
  }

  applyTo(root, spec) {
    if (spec.type !== "gem") return;
    root.traverse((node) => {
      if (!node.isMesh) return;
      const mat = createGemMaterial({
        color: spec.color,
        hueSpeed: spec.hueSpeed,
        dispersion: spec.dispersion,
        shine: spec.shine,
        twinkle: spec.twinkle,
      });
      node.material = mat;
      this.materials.push(mat);
    });
  }

  update(t) {
    for (const mat of this.materials) {
      mat.uniforms.uTime.value = t;
      // The totem stashes each tracked emissive material's scroll/column fade on
      // userData before _updateExtras runs; honor it so the gem dims off-focus.
      mat.uniforms.uBrightness.value = mat.userData.emissiveFade ?? 1;
    }
  }
}
