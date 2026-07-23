import * as THREE from "three";
import { Totem } from "./lib/totem/totem.js";
import { attachGestures } from "./lib/totem/gestures.js";
import { VideoEffect } from "./lib/extras/video.js";
import { WaterEffect } from "./lib/extras/water.js";
import { BulbEffect } from "./lib/extras/bulb.js";
import { Filters } from "./lib/extras/filters.js";
import { ColumnsRenderPass } from "./lib/extras/columnsPass.js";
import { columnBlocks } from "./blocks.js";

// Share the cache so blocks reused across columns download once.
THREE.Cache.enabled = true;

const COLUMN_COUNT = 3;
// Below this per-column width the columns get too thin, so we collapse to just
// the center column shown full-width.
const MIN_COLUMN_WIDTH = 220;
// Master switch for the collapsed-mode horizontal paging interaction (drag +
// trackpad swipe to flip columns, slide/dim/snap, and browser back/forward
// suppression). Set false to disable it all and restore default behaviour.
const COLUMN_PAGING = true;
// Sub-switch (only applies when COLUMN_PAGING is on): trackpad two-finger swipe
// paging. Set false to keep click-and-drag paging but hand horizontal wheels —
// and browser back/forward nav — back to the browser.
const TRACKPAD_PAGING = false;

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

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
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

// In collapsed (single-column) mode this is the column shown full-width; a
// horizontal swipe cycles it. `collapsed` is set by layoutColumns per viewport.
let activeColumn = centerColumn;
let collapsed = false;
// Horizontal paging (collapsed mode): `dragX` is the live px offset of the
// active column (0 = settled) as the finger tracks; the incoming neighbour is
// drawn beside it. `snapTarget` drives the release animation (null while idle
// or finger-down).
let dragX = 0;
let snapTarget = null;

const columns = Array.from({ length: COLUMN_COUNT }, (_, i) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, -5.5, 5);
  camera.lookAt(0, -5.5, 0);

  const video = new VideoEffect();
  const water = new WaterEffect();
  const bulb = new BulbEffect({ hz: 1.5 });
  const totem = new Totem({ loadingManager });
  totem._decorateBlock = ({ spec, root, components, componentRoots, group }) => {
    video.applyTo(root, spec, group);
    water.applyTo(root, spec);
    bulb.applyTo(root, spec);
    componentRoots.forEach((compRoot, ci) => {
      video.applyTo(compRoot, components[ci], group);
      water.applyTo(compRoot, components[ci]);
      bulb.applyTo(compRoot, components[ci]);
    });
  };
  totem._updateExtras = (t) => {
    video.update();
    water.update(t);
    bulb.update(t);
  };
  scene.add(totem);

  const col = {
    scene,
    camera,
    totem,
    video,
    water,
    bulb,
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
    // Only the on-screen column hit-tests while collapsed; dragging it slides
    // to the adjacent column, snapping on release.
    swipeEnabled: () => COLUMN_PAGING && collapsed,
    wheelSwipeEnabled: () => TRACKPAD_PAGING,
    onSwipeMove: (dx) => dragColumns(dx),
    onSwipeEnd: (dx, velocity) => releaseColumns(dx, velocity),
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
  collapsed = w / columns.length < MIN_COLUMN_WIDTH;

  // Too narrow to tile: page a single full-width column. Give every column the
  // full-width camera so any can slide into view, then position them by dragX.
  if (collapsed) {
    const aspect = w / h;
    columns.forEach((col) => {
      col.camera.aspect = aspect;
      col.camera.fov = fovForAspect(aspect);
      col.camera.updateProjectionMatrix();
    });
    applyCollapsedLayout();
    return;
  }

  // Leaving collapsed mode: clear any in-progress paging.
  dragX = 0;
  snapTarget = null;

  let x = 0;
  columns.forEach((col, i) => {
    const cw = i === columns.length - 1 ? w - x : Math.round(w / columns.length);
    const aspect = cw / h;
    col.visible = true;
    col.rect = { x, y: 0, w: cw, h };
    col.totem.brightness = 1;
    col.camera.aspect = aspect;
    col.camera.fov = fovForAspect(aspect);
    col.camera.updateProjectionMatrix();
    x += cw;
  });
};

// Brightness for a column whose band sits at offset x (0 = centred): full at
// centre, easing down to COLLAPSED_DIM once a full column-width off-centre.
const COLLAPSED_DIM = 0.25;
const brightnessForOffset = (x, w) =>
  COLLAPSED_DIM + (1 - COLLAPSED_DIM) * (1 - Math.min(1, Math.abs(x) / w));

// Latched slide direction: +1 sliding toward the next column (dragX < 0), -1
// toward the previous, 0 settled. Latching (rather than reading sign(dragX)
// every frame) stops sub-pixel jitter around 0 — common with trackpad momentum,
// which has no axis-lock slop — from flipping the neighbour and flashing the
// wrong (wrap-around) column mid-slide.
let slideDir = 0;
const NEIGHBOUR_DEADZONE = 10; // px; within this we treat the slide as settled

// Place the active column at dragX and, if mid-slide, its incoming neighbour
// beside it (wrapping); hide the rest. ColumnsRenderPass reads these rects each
// frame, so a negative/overhanging rect is just scissor-clipped at the edges.
// Each placed column is dimmed by how far off-centre it has slid.
const applyCollapsedLayout = () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  const n = columns.length;
  // Re-latch only after settling back near centre; otherwise hold the direction.
  if (Math.abs(dragX) < NEIGHBOUR_DEADZONE) slideDir = 0;
  else if (slideDir === 0) slideDir = dragX < 0 ? 1 : -1;
  const neighbour =
    slideDir > 0
      ? (activeColumn + 1) % n
      : slideDir < 0
        ? (activeColumn - 1 + n) % n
        : -1;
  columns.forEach((col) => {
    col.visible = false;
  });
  const place = (i, x) => {
    columns[i].visible = true;
    columns[i].rect = { x: Math.round(x), y: 0, w, h };
    columns[i].totem.brightness = brightnessForOffset(x, w);
  };
  place(activeColumn, dragX);
  if (neighbour !== -1) place(neighbour, slideDir > 0 ? dragX + w : dragX - w);
};

// Finger-tracking: offset the active column by the drag, clamped to one column.
const dragColumns = (dx) => {
  if (!collapsed) return;
  const w = container.clientWidth;
  dragX = Math.max(-w, Math.min(w, dx));
  snapTarget = null;
  applyCollapsedLayout();
};

// On release, snap to the neighbour if dragged far enough or flicked, else back.
const releaseColumns = (_dx, velocity) => {
  if (!collapsed) {
    dragX = 0;
    snapTarget = null;
    return;
  }
  const w = container.clientWidth;
  const farEnough = Math.abs(dragX) > w * 0.25;
  const flicked =
    Math.abs(velocity) > 0.35 && Math.sign(velocity) === Math.sign(dragX);
  snapTarget = (farEnough || flicked) && dragX !== 0 ? Math.sign(dragX) * w : 0;
};

// Advance the release animation each frame; commit the column change on landing.
const SNAP_EASE = 0.22;
const updatePaging = () => {
  if (!collapsed || snapTarget === null) return;
  dragX += (snapTarget - dragX) * SNAP_EASE;
  if (Math.abs(dragX - snapTarget) < 0.5) {
    if (snapTarget !== 0) {
      const n = columns.length;
      activeColumn =
        snapTarget < 0 ? (activeColumn + 1) % n : (activeColumn - 1 + n) % n;
    }
    dragX = 0;
    snapTarget = null;
  }
  applyCollapsedLayout();
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
  updatePaging();
  filters.render();
}
animate();

await new Promise((resolve) => setTimeout(resolve, 1500));
await Promise.all(columns.map((col) => col.totem.loadBlocks(col.blocks)));

// Warm the GPU while the loading screen is still up: compile every column's
// shaders (incl. shadow depth) and upload its textures, so blocks don't hitch
// as they first render into view.
await Promise.all(
  columns.map((col) => renderer.compileAsync(col.scene, col.camera)),
);

// Let the eased loop glide the fill up to 100% rather than snapping it.
targetProgress = 1;
setTimeout(() => loadingFill?.classList.add("complete"), 1000);
setTimeout(() => {
  document.getElementById("loading")?.classList.add("done");
  canvas.classList.add("intro-done");
}, 2500);
