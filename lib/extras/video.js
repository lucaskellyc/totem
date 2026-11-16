import * as THREE from "three";

const noopUpdate = function () {};

export class VideoEffect {
  constructor({ focusY = -5, activeRange = 6, enabled = null } = {}) {
    this.videos = [];
    this.focusY = focusY;
    this.activeRange = activeRange;
    // Optional `() => boolean` gate (e.g. column visibility). When it returns
    // false, every video here is paused so it releases its hardware decoder —
    // iOS only has a few, and collapsed mode hides all but the active column.
    this.enabled = enabled;
    // Set while prime() runs, so update() doesn't pause what it's warming.
    this.priming = false;
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
    // autoplay:false — don't kick every video into decoding on load (a phone
    // sees a decode storm mid texture-upload). update() starts only the
    // in-focus video of a visible column, within a frame.
    const entry = createVideoTexture({ url: spec.video, autoplay: false });
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

  // Buffer and decode the first frame of every in-focus video, then pause.
  // Run behind the loading screen, so a column paging into view for the first
  // time doesn't fetch, spin up a decoder and upload a frame mid-drag.
  async prime(timeout = 1500) {
    this.priming = true;
    const due = this.videos.filter(
      (v) => Math.abs(v.group.position.y - this.focusY) <= this.activeRange,
    );
    await Promise.all(due.map((v) => v.entry.prime(timeout)));
    this.priming = false;
  }

  update() {
    if (this.priming) return;
    const gateOpen = this.enabled ? this.enabled() : true;
    for (const v of this.videos) {
      const worldY = v.group.position.y;
      const inFocus = Math.abs(worldY - this.focusY) <= this.activeRange;
      if (this.docHidden || !gateOpen || !inFocus) v.entry.pause();
      else v.entry.play();
    }
  }
}

function createVideoTexture(spec) {
  const opts = typeof spec === "string" ? { url: spec } : spec;
  const {
    url,
    loop = true,
    playbackRate = 1,
    autoplay = true,
    crossOrigin = "anonymous",
    flipY = false,
    colorSpace = THREE.SRGBColorSpace,
    // "metadata" (not "auto") so eight videos don't all buffer + decode up
    // front on load; a video buffers when update() first plays it.
    preload = "metadata",
  } = opts;

  const video = document.createElement("video");
  video.crossOrigin = crossOrigin;
  video.loop = loop;
  // Always muted — the scene is silent by design, so no spec can unmute a video.
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = preload;
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
    // Resolves once a first frame is decoded (or on timeout), leaving the
    // video paused unless something asked it to play meanwhile. iOS ignores
    // preload, so it takes a real play() to get a frame.
    prime(timeout) {
      return new Promise((resolve) => {
        const done = () => {
          clearTimeout(timer);
          video.removeEventListener("loadeddata", done);
          if (!state.wanted && !video.paused) video.pause();
          // rVFC may not have fired before the pause; flag the frame for upload.
          if (video.readyState >= 2) texture.needsUpdate = true;
          resolve();
        };
        const timer = setTimeout(done, timeout);
        if (video.readyState >= 2) return done();
        video.addEventListener("loadeddata", done);
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(done);
      });
    },
  };
}
