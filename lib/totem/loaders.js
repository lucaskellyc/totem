import * as THREE from "three";
import { isMobile } from "./env.js";

const linear = { colorSpace: THREE.NoColorSpace };

// Mobile GPUs — iOS Safari especially — have a tight per-tab texture-memory
// budget. The source maps are 2K–4K JPGs and, across three columns, uploading
// them at native size blows that budget and the tab is silently reloaded (the
// "crash"). On touch devices, downscale any map whose longest edge exceeds
// MAX_TEXTURE_SIZE before it reaches the GPU — a phone column is only a few
// hundred px wide, so the detail isn't visible anyway. Desktop stays native.
const MAX_TEXTURE_SIZE = isMobile ? 1024 : Infinity;

// Draw an oversized image down into a canvas so three uploads the smaller copy;
// returns the original untouched when it's already within the cap.
function capImageSize(image, maxSize) {
  const w = image.naturalWidth ?? image.width ?? 0;
  const h = image.naturalHeight ?? image.height ?? 0;
  const longest = Math.max(w, h);
  if (!longest || longest <= maxSize) return image;
  const scale = maxSize / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function loadTexture(
  loader,
  url,
  { colorSpace = THREE.SRGBColorSpace } = {},
) {
  let tex;
  try {
    tex = await loader.loadAsync(url);
  } catch (cause) {
    throw new Error(`Failed to load texture: ${url}`, { cause });
  }
  if (MAX_TEXTURE_SIZE !== Infinity && tex.image) {
    const capped = capImageSize(tex.image, MAX_TEXTURE_SIZE);
    if (capped !== tex.image) {
      tex.image = capped;
      tex.needsUpdate = true;
    }
  }
  tex.colorSpace = colorSpace;
  tex.flipY = false;
  return tex;
}

export async function loadMaps(loader, entry) {
  const [map, normalMap, roughnessMap, alphaMap] = await Promise.all([
    entry.texture ? loadTexture(loader, entry.texture) : null,
    entry.normalMap ? loadTexture(loader, entry.normalMap, linear) : null,
    entry.roughnessMap ? loadTexture(loader, entry.roughnessMap, linear) : null,
    entry.alphaMap ? loadTexture(loader, entry.alphaMap, linear) : null,
  ]);
  return { map, normalMap, roughnessMap, alphaMap };
}
