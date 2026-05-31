import * as THREE from "three";

const linear = { colorSpace: THREE.NoColorSpace };

const noopUpdate = function () {};

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
  tex.colorSpace = colorSpace;
  tex.flipY = false;
  return tex;
}

export function createVideoTexture(spec) {
  const opts = typeof spec === "string" ? { url: spec } : spec;
  const {
    url,
    loop = true,
    muted = true,
    playbackRate = 1,
    autoplay = true,
    crossOrigin = "anonymous",
    flipY = false,
    colorSpace = THREE.SRGBColorSpace,
  } = opts;

  const video = document.createElement("video");
  video.crossOrigin = crossOrigin;
  video.loop = loop;
  video.muted = muted;
  video.defaultMuted = muted;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  video.src = url;
  video.playbackRate = playbackRate;

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = colorSpace;
  texture.flipY = flipY;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  if (typeof video.requestVideoFrameCallback === "function") {
    const onFrame = () => {
      texture.needsUpdate = true;
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
    texture.update = noopUpdate;
  }

  const state = { wanted: !!autoplay };
  const tryPlay = () => {
    if (!state.wanted || !video.paused) return;
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  };
  if (autoplay) tryPlay();

  return {
    texture,
    video,
    play() {
      if (state.wanted && !video.paused) return;
      state.wanted = true;
      tryPlay();
    },
    pause() {
      if (!state.wanted && video.paused) return;
      state.wanted = false;
      if (!video.paused) video.pause();
    },
  };
}

export async function loadMaps(loader, entry) {
  const [map, normalMap, roughnessMap] = await Promise.all([
    entry.texture ? loadTexture(loader, entry.texture) : null,
    entry.normalMap ? loadTexture(loader, entry.normalMap, linear) : null,
    entry.roughnessMap ? loadTexture(loader, entry.roughnessMap, linear) : null,
  ]);
  const video = entry.video ? createVideoTexture(entry.video) : null;
  return {
    map: video ? video.texture : map,
    normalMap,
    roughnessMap,
    video,
  };
}
