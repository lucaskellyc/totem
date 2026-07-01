import * as THREE from "three";

export class SoundEffect {
  constructor({ focusY = -5, activeRange = 6 } = {}) {
    this.listener = new THREE.AudioListener();
    this.loader = new THREE.AudioLoader();
    this.sounds = [];
    this.focusY = focusY;
    this.activeRange = activeRange;
    this.docHidden = typeof document !== "undefined" && document.hidden;
    if (typeof document !== "undefined") {
      this._onVisibility = () => {
        this.docHidden = document.hidden;
      };
      document.addEventListener("visibilitychange", this._onVisibility);
    }
    if (typeof window !== "undefined") {
      const resume = () => this.listener.context.resume();
      window.addEventListener("pointerdown", resume, { once: true });
      window.addEventListener("keydown", resume, { once: true });
    }
  }

  applyTo(root, spec, group) {
    if (!spec.sound) return;
    const opts = typeof spec.sound === "string" ? { url: spec.sound } : spec.sound;
    const {
      url,
      volume = 1,
      refDistance = 1,
      rolloff = 2,
      maxDistance,
      distanceModel = "inverse",
      loop = true,
      autoplay = true,
      position,
      fade = null,
    } = opts;

    const sound = new THREE.PositionalAudio(this.listener);
    sound.setRefDistance(refDistance);
    sound.setRolloffFactor(rolloff);
    sound.setDistanceModel(distanceModel);
    if (maxDistance !== undefined) sound.setMaxDistance(maxDistance);
    sound.setLoop(loop);
    sound.setVolume(volume);
    if (position) sound.position.set(...position);
    root.add(sound);

    const state = { wanted: !!autoplay, ready: false };
    this.loader.load(url, (buffer) => {
      sound.setBuffer(buffer);
      state.ready = true;
      if (state.wanted) sound.play();
    });

    this.sounds.push({ group, sound, state, baseVolume: volume, fade });
  }

  update() {
    for (const s of this.sounds) {
      const dist = Math.abs(s.group.position.y - this.focusY);
      let level;
      if (s.fade !== null) {
        const t = 1 - dist / s.fade;
        level = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
      } else {
        level = dist <= this.activeRange ? 1 : 0;
      }
      if (this.docHidden) level = 0;
      s.sound.setVolume(s.baseVolume * level);
      const shouldPlay = level > 0;
      s.state.wanted = shouldPlay;
      if (!s.state.ready) continue;
      if (shouldPlay && !s.sound.isPlaying) s.sound.play();
      else if (!shouldPlay && s.sound.isPlaying) s.sound.pause();
    }
  }
}
