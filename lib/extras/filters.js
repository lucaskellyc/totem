import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const FisheyeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.3 },
    uZoom: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uZoom;
    varying vec2 vUv;

    void main() {
      vec2 uv = (vUv - 0.5) / uZoom;
      float r2 = dot(uv, uv);
      vec2 warped = uv * (1.0 + uStrength * r2) + 0.5;
      if (warped.x < 0.0 || warped.x > 1.0 || warped.y < 0.0 || warped.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        gl_FragColor = texture2D(tDiffuse, warped);
      }
    }
  `,
};

const EdgeBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uStart: { value: 0.5 },
    uStrength: { value: 6.0 },
    uPower: { value: 2.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uStart;
    uniform float uStrength;
    uniform float uPower;
    varying vec2 vUv;

    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float t = clamp((r - uStart) / max(1.0 - uStart, 1e-4), 0.0, 1.0);
      float radius = pow(t, uPower) * uStrength;

      if (radius < 0.5) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 texel = 1.0 / uResolution;
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float total = 1.0;
      const int RINGS = 2;
      const int SAMPLES = 8;
      for (int ring = 1; ring <= RINGS; ring++) {
        float ringR = radius * (float(ring) / float(RINGS));
        for (int i = 0; i < SAMPLES; i++) {
          float a = 6.2831853 * (float(i) + 0.5 * float(ring)) / float(SAMPLES);
          vec2 off = vec2(cos(a), sin(a)) * texel * ringR;
          col += texture2D(tDiffuse, vUv + off).rgb;
          total += 1.0;
        }
      }
      gl_FragColor = vec4(col / total, 1.0);
    }
  `,
};

export class Filters {
  constructor(renderer, scene, camera, {
    bloom = null,
    fisheye = null,
    edgeBlur = null,
    output = true,
  } = {}) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const size = new THREE.Vector2();
    renderer.getSize(size);

    this.bloom = null;
    if (bloom) {
      const pass = new UnrealBloomPass(
        size,
        bloom.strength ?? 0.6,
        bloom.radius ?? 0.4,
        bloom.threshold ?? 0.85,
      );
      this.composer.addPass(pass);
      this.bloom = pass;
    }

    this.fisheye = null;
    if (fisheye) {
      const pass = new ShaderPass(FisheyeShader);
      pass.uniforms.uStrength.value = fisheye.strength ?? 0.3;
      pass.uniforms.uZoom.value = fisheye.zoom ?? 1.0;
      this.composer.addPass(pass);
      this.fisheye = pass;
    }

    this.edgeBlur = null;
    if (edgeBlur) {
      const pass = new ShaderPass(EdgeBlurShader);
      pass.uniforms.uStart.value = edgeBlur.start ?? 0.5;
      pass.uniforms.uStrength.value = edgeBlur.strength ?? 6.0;
      pass.uniforms.uPower.value = edgeBlur.power ?? 2.0;
      pass.uniforms.uResolution.value = new THREE.Vector2();
      this.composer.addPass(pass);
      this.edgeBlur = pass;
    }

    if (output) this.composer.addPass(new OutputPass());

    this.setSize(size.x, size.y);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    if (this.edgeBlur) {
      this.edgeBlur.uniforms.uResolution.value.set(w * pr, h * pr);
    }
  }

  render() {
    this.composer.render();
  }
}
