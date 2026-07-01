import * as THREE from "three";

const noopUpdate = function () {};

export class VideoEffect {
  constructor({ focusY = -5, activeRange = 6 } = {}) {
    this.videos = [];
    this.focusY = focusY;
    this.activeRange = activeRange;
    this.docHidden = typeof document !== "undefined" && document.hidden;
    if (typeof document !== "undefined") {
      this._onVisibility = () => {
        this.docHidden = document.hidden;
      };
      document.addEventListener("visibilitychange", this._onVisibility);
    }
  }

  applyTo(root, spec, group) {
    if (!spec.video) return;
    const entry = createVideoTexture(spec.video);
    root.traverse((node) => {
      if (!node.isMesh) return;
      if (spec.type === "unlit") {
        node.material = new THREE.MeshBasicMaterial({ map: entry.texture });
      } else if (node.material) {
        node.material.map = entry.texture;
        node.material.needsUpdate = true;
      }
    });
    this.videos.push({ group, entry });
  }

  update() {
    for (const v of this.videos) {
      const worldY = v.group.position.y;
      const inFocus = Math.abs(worldY - this.focusY) <= this.activeRange;
      if (this.docHidden || !inFocus) v.entry.pause();
      else v.entry.play();
    }
  }
}

function createVideoTexture(spec) {
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
