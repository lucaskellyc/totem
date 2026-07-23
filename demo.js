import * as THREE from "three";
import { Totem } from "./lib/totem/totem.js";
import { attachGestures } from "./lib/totem/gestures.js";
import { VideoEffect } from "./lib/extras/video.js";
import { WaterEffect } from "./lib/extras/water.js";
import { Filters } from "./lib/extras/filters.js";
import { ColumnsRenderPass } from "./lib/extras/columnsPass.js";
import { columnBlocks } from "./blocks.js";

// Share the cache so blocks reused across columns download once.
THREE.Cache.enabled = true;

const COLUMN_COUNT = 3;
// Below this per-column width the columns get too thin, so we collapse to just
// the center column shown full-width.
const MIN_COLUMN_WIDTH = 220;

// Keep a constant horizontal field of view across column widths so a column's
// content isn't cropped left/right when it's narrow — narrower columns reveal
// more vertically instead of clipping the block's sides. FRAME_WIDTH is the
// world-space width kept visible at the block plane, FOCUS_DISTANCE the camera→
// plane distance (camera sits at z = FOCUS_DISTANCE looking down -z).
const FRAME_WIDTH = 3.8;
const FOCUS_DISTANCE = 5;
const H_HALF_TAN = FRAME_WIDTH / 2 / FOCUS_DISTANCE;
const fovForAspect = (aspect) =>
  THREE.MathUtils.radToDeg(2 * Math.atan(H_HALF_TAN / aspect));

const loadingFill = document.getElementById("loading-bar-fill");
document.getElementById("loading-bar")?.classList.add("visible");

const container = document.body;

const renderer = new THREE.WebGLRenderer({ antialias: true });
const canvas = renderer.domElement;
container.appendChild(canvas);
renderer.setSize(container.clientWidth, container.clientHeight, false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const loadingManager = new THREE.LoadingManager();

// The bar's real progress arrives in discrete jumps as each asset finishes. To
// keep the fill gliding instead of snapping, we treat that as a *target* and
// ease the shown width toward it every frame.
let targetProgress = 0;
let shownProgress = 0;
loadingManager.onProgress = (_url, loaded, total) => {
  targetProgress = loaded / total;
};

const animateLoadingBar = () => {
  // Smaller factor = smoother, slower catch-up.
  shownProgress += (targetProgress - shownProgress) * 0.06;
  if (targetProgress >= 1 && shownProgress > 0.999) shownProgress = 1;
  if (loadingFill) loadingFill.style.width = `${shownProgress * 100}%`;
  if (shownProgress < 1) requestAnimationFrame(animateLoadingBar);
};
requestAnimationFrame(animateLoadingBar);

// Logical (renderer) width the column rects tile across.
let totalWidth = container.clientWidth;

// Map a pointer/wheel event to a logical X in [0, totalWidth] so hit-testing
// lines up with the column rects even with safe-area overscan on the canvas.
const hitColumn = (col, event) => {
  if (!col.visible) return false;
  const bounds = canvas.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * totalWidth;
  return x >= col.rect.x && x < col.rect.x + col.rect.w;
};

const centerColumn = Math.floor((COLUMN_COUNT - 1) / 2);

const columns = Array.from({ length: COLUMN_COUNT }, (_, i) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, -5.5, 5);
  camera.lookAt(0, -5.5, 0);

  const video = new VideoEffect();
  const water = new WaterEffect();
  const totem = new Totem({ loadingManager });
  totem._decorateBlock = ({ spec, root, components, componentRoots, group }) => {
    video.applyTo(root, spec, group);
    water.applyTo(root, spec);
    componentRoots.forEach((compRoot, ci) => {
      video.applyTo(compRoot, components[ci], group);
      water.applyTo(compRoot, components[ci]);
    });
  };
  totem._updateExtras = (t) => {
    video.update();
    water.update(t);
  };
  scene.add(totem);

  const col = {
    scene,
    camera,
    totem,
    video,
    water,
    blocks: columnBlocks(i),
    rect: { x: 0, y: 0, w: 1, h: 1 },
    visible: true,
    gestures: null,
  };
  col.gestures = attachGestures(canvas, totem, {
    // Center column drifts the opposite way from its neighbours.
    autoScroll: i === centerColumn ? -0.02 : 0.02,
    autoScrollResumeDelay: 1000,
    hitTest: (event) => hitColumn(col, event),
  });
  return col;
});

const filters = new Filters(renderer, new ColumnsRenderPass(columns), {
  bloom: { strength: 0.4, radius: 0.2, threshold: 0.96 },
  fisheye: { strength: 0.25 },
  edgeBlur: { start: 0.55, strength: 8 },
});

const layoutColumns = () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  totalWidth = w;

  // Too narrow to tile: show only the center column, full-width.
  if (w / columns.length < MIN_COLUMN_WIDTH) {
    const aspect = w / h;
    columns.forEach((col, i) => {
      col.visible = i === centerColumn;
      col.rect = { x: 0, y: 0, w, h };
      col.camera.aspect = aspect;
      col.camera.fov = fovForAspect(aspect);
      col.camera.updateProjectionMatrix();
    });
    return;
  }

  let x = 0;
  columns.forEach((col, i) => {
    const cw = i === columns.length - 1 ? w - x : Math.round(w / columns.length);
    const aspect = cw / h;
    col.visible = true;
    col.rect = { x, y: 0, w: cw, h };
    col.camera.aspect = aspect;
    col.camera.fov = fovForAspect(aspect);
    col.camera.updateProjectionMatrix();
    x += cw;
  });
};
layoutColumns();

const onResize = () => {
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  filters.setSize(container.clientWidth, container.clientHeight);
  layoutColumns();
};
window.addEventListener("resize", onResize);
window.visualViewport?.addEventListener("resize", onResize);

function animate() {
  requestAnimationFrame(animate);
  for (const col of columns) {
    col.gestures.update();
    col.totem.update();
  }
  filters.render();
}
animate();

await new Promise((resolve) => setTimeout(resolve, 1500));
await Promise.all(columns.map((col) => col.totem.loadBlocks(col.blocks)));

// Let the eased loop glide the fill up to 100% rather than snapping it.
targetProgress = 1;
setTimeout(() => loadingFill?.classList.add("complete"), 1000);
setTimeout(() => {
  document.getElementById("loading")?.classList.add("done");
  canvas.classList.add("intro-done");
}, 2500);
