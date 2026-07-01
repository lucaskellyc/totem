import * as THREE from "three";
import { Totem } from "./lib/totem/totem.js";
import { attachGestures } from "./lib/totem/gestures.js";
import { VideoEffect } from "./lib/extras/video.js";
import { WaterEffect } from "./lib/extras/water.js";
import { SoundEffect } from "./lib/extras/sound.js";
import { Filters } from "./lib/extras/filters.js";
import { blocks } from "./blocks.js";

const loadingFill = document.getElementById("loading-bar-fill");
document.getElementById("loading-bar")?.classList.add("visible");

const container = document.body;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  container.clientWidth / container.clientHeight,
  0.1,
  100,
);
camera.position.set(0, -5.5, 4);
camera.lookAt(0, -5.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
const canvas = renderer.domElement;
container.appendChild(canvas);
renderer.setSize(container.clientWidth, container.clientHeight, false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (_url, loaded, total) => {
  if (loadingFill) loadingFill.style.width = `${(loaded / total) * 100}%`;
};

const video = new VideoEffect();
const water = new WaterEffect();
const sound = new SoundEffect();
camera.add(sound.listener);
const totem = new Totem({ loadingManager });
totem._decorateBlock = ({ spec, group, root, components, componentRoots }) => {
  video.applyTo(root, spec, group);
  water.applyTo(root, spec);
  sound.applyTo(root, spec, group);
  componentRoots.forEach((compRoot, i) => {
    video.applyTo(compRoot, components[i], group);
    water.applyTo(compRoot, components[i]);
    sound.applyTo(compRoot, components[i], group);
  });
};
totem._updateExtras = (t) => {
  video.update();
  water.update(t);
  sound.update();
};
scene.add(totem);

const gestures = attachGestures(canvas, totem, {
  autoScroll: 0.02,
  autoScrollResumeDelay: 1000,
});

const filters = new Filters(renderer, scene, camera, {
  bloom: { strength: 0.4, radius: 0.2, threshold: 0.96 },
  fisheye: { strength: 0.25 },
  edgeBlur: { start: 0.55, strength: 8 },
});

window.addEventListener("resize", () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  filters.setSize(w, h);
});

function animate() {
  requestAnimationFrame(animate);
  gestures.update();
  totem.update();
  filters.render();
}
animate();

await new Promise((resolve) => setTimeout(resolve, 1500));
await totem.loadBlocks(blocks);

if (loadingFill) loadingFill.style.width = "100%";
setTimeout(() => loadingFill?.classList.add("complete"), 1000);
setTimeout(() => {
  document.getElementById("loading")?.classList.add("done");
  canvas.classList.add("intro-done");
}, 2500);
