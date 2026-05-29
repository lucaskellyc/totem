import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { Stack } from "./lib/stack.js";
import { attachInteract } from "./lib/interact.js";
import { blocks } from "./blocks.js";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, -5.5, 8);
camera.lookAt(0, -5.5, 0);

const ZOOM_WIDE_WIDTH = 1200;
const ZOOM_NARROW_WIDTH = 400;
const ZOOM_BASE_Z = 5;
const ZOOM_FAR_Z = 6;
function fitCameraZoom() {
  const t = THREE.MathUtils.clamp(
    (ZOOM_WIDE_WIDTH - window.innerWidth) /
      (ZOOM_WIDE_WIDTH - ZOOM_NARROW_WIDTH),
    0,
    1,
  );
  camera.position.z = THREE.MathUtils.lerp(ZOOM_BASE_Z, ZOOM_FAR_Z, t);
}
fitCameraZoom();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

//scene.add(new THREE.AmbientLight(0xffffff, 0.2));

const composerTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  { samples: 4, type: THREE.HalfFloatType },
);
const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(scene, camera));
const bokehPass = new BokehPass(scene, camera, {
  focus: camera.position.z,
  aperture: 0.005,
  maxblur: 0.05,
});
composer.addPass(bokehPass);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.2,
  0.6,
  0.6,
);
composer.addPass(bloomPass);
const vignettePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 1 },
    uInner: { value: 0.4 },
    uOuter: { value: 0.7 },
    uColor: { value: new THREE.Color(0x000000) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uInner;
    uniform float uOuter;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec2 p = vUv - 0.5;
      float d = length(p) * 1.41421356;
      float v = smoothstep(uInner, uOuter, d);
      vec3 col = mix(tex.rgb, uColor, v * uStrength);
      gl_FragColor = vec4(col, tex.a);
    }
  `,
});
composer.addPass(vignettePass);
composer.addPass(new OutputPass());

const loadingManager = new THREE.LoadingManager();
const loadingFill = document.getElementById("loading-bar-fill");
loadingManager.onProgress = (_url, loaded, total) => {
  if (loadingFill) loadingFill.style.width = `${(loaded / total) * 100}%`;
};

const stack = new Stack({ loadingManager });
scene.add(stack);

await stack.loadBlocks(blocks);
if (loadingFill) {
  loadingFill.style.width = "100%";
  setTimeout(() => {
    loadingFill.classList.add("complete");
  }, 1000);
}
setTimeout(() => {
  document.getElementById("loading")?.classList.add("done");
}, 2000);

const interact = attachInteract(renderer.domElement, stack, {
  autoScroll: 0.02,
  autoScrollResumeDelay: 1000,
});

for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
  window.addEventListener(ev, (e) => e.preventDefault());
}
document.addEventListener("dblclick", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  fitCameraZoom();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const AUTOFOCUS_LERP = 0.08;
function updateAutoFocus() {
  if (!stack.blocks.length) return;
  let best = null;
  let bestDy = Infinity;
  for (const b of stack.blocks) {
    const worldY = b.object.position.y + b.focusY;
    const dy = Math.abs(worldY - camera.position.y);
    if (dy < bestDy) {
      best = b;
      bestDy = dy;
    }
  }
  const worldY = best.object.position.y + best.focusY;
  const dy = worldY - camera.position.y;
  const dz = camera.position.z;
  const target = Math.sqrt(dy * dy + dz * dz);
  bokehPass.uniforms.focus.value = THREE.MathUtils.lerp(
    bokehPass.uniforms.focus.value,
    target,
    AUTOFOCUS_LERP,
  );
}

function animate() {
  requestAnimationFrame(animate);
  interact.update();
  stack.update();
  updateAutoFocus();
  composer.render();
}
animate();
