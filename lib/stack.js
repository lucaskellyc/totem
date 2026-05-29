import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createBulbMaterial, createWaterMaterial } from "./shaders.js";

async function loadTexture(loader, url, { colorSpace = THREE.SRGBColorSpace } = {}) {
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

const linear = { colorSpace: THREE.NoColorSpace };

const noopUpdate = function () {};

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

async function loadMaps(loader, entry) {
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

function applyMaterial(
  root,
  {
    type = "standard",
    color,
    map,
    normalMap,
    roughnessMap,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    opacity,
    flowDir,
    flowSpeed,
    flowScale,
    ridgeStrength,
    stretch,
    alphaRange,
    displacement,
    contrast,
  } = {},
) {
  if (type === "water") {
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.material = createWaterMaterial({
        color,
        opacity,
        metalness,
        roughness,
        flowDir,
        flowSpeed,
        flowScale,
        ridgeStrength,
        stretch,
        alphaRange,
        displacement,
        contrast,
      });
    });
    return;
  }
  if (
    color === undefined &&
    !map &&
    !normalMap &&
    !roughnessMap &&
    roughness === undefined &&
    metalness === undefined &&
    emissive === undefined &&
    emissiveIntensity === undefined
  ) {
    return;
  }
  const params = {};
  if (color !== undefined) params.color = new THREE.Color().setHex(color);
  if (map) params.map = map;
  const Material =
    type === "unlit" ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
  if (type !== "unlit") {
    if (normalMap) params.normalMap = normalMap;
    if (roughnessMap) params.roughnessMap = roughnessMap;
    if (roughness !== undefined) params.roughness = roughness;
    if (metalness !== undefined) params.metalness = metalness;
    if (emissive !== undefined) params.emissive = new THREE.Color().setHex(emissive);
    if (emissiveIntensity !== undefined) params.emissiveIntensity = emissiveIntensity;
  }
  root.traverse((node) => {
    if (node.isMesh) node.material = new Material(params);
  });
}

export class Stack extends THREE.Group {
  constructor() {
    super();
    this.blocks = [];
    this.origin = 0;
    this.scrollPos = 0;
    this.shifting = false;
    this._loader = null;
    this._textureLoader = null;
    this._lights = [];
    this._blinkers = [];
    this._unlitMeshes = [];
    this._waterMaterials = [];
    this._videos = [];
    this._docHidden = typeof document !== "undefined" && document.hidden;
    this._startTime = performance.now();
    this.lightFocusY = -5;
    this.lightFalloff = 6;
    this.unlitFocusY = -5;
    this.unlitFalloff = 0.4;
    this.videoFocusY = -5;
    this.videoActiveRange = 6;
    if (typeof document !== "undefined") {
      this._onVisibility = () => {
        this._docHidden = document.hidden;
      };
      document.addEventListener("visibilitychange", this._onVisibility);
    }
  }

  _trackVideo(group, videoEntry) {
    if (!videoEntry) return;
    this._videos.push({ group, entry: videoEntry });
  }

  _attachPlanes(group, planeSpecs) {
    if (!planeSpecs?.length) return;
    for (const spec of planeSpecs) {
      const [w, h] = spec.size ?? [1, 1];
      const geom = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHex(spec.color ?? 0xffffff),
      });
      const mesh = new THREE.Mesh(geom, mat);
      if (spec.position) mesh.position.set(...spec.position);
      if (spec.rotation) mesh.rotation.set(...spec.rotation);
      group.add(mesh);
    }
  }

  _createPrimitive(spec) {
    let geom;
    if (spec.shape === "sphere") {
      geom = new THREE.SphereGeometry(
        spec.radius ?? 0.2,
        spec.widthSegments ?? 24,
        spec.heightSegments ?? 16,
      );
    } else if (spec.shape === "disc") {
      geom = new THREE.CircleGeometry(spec.radius ?? 0.5, spec.segments ?? 48);
    } else if (spec.shape === "plane") {
      const [w, h] = spec.size ?? [1, 1];
      geom = new THREE.PlaneGeometry(w, h, spec.segmentsX ?? 1, spec.segmentsY ?? 1);
    } else {
      throw new Error(`Unknown component shape: ${spec.shape}`);
    }
    return new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
  }

  _trackWaterMaterials(root) {
    root.traverse((node) => {
      if (!node.isMesh) return;
      if (node.material?.name === "water" && node.material.uniforms?.uTime) {
        this._waterMaterials.push(node.material);
      }
    });
  }

  _trackUnlitMeshes(root, group) {
    group.updateMatrixWorld(true);
    const groupY = group.position.y;
    const tmp = new THREE.Vector3();
    root.traverse((node) => {
      if (!node.isMesh || !node.material?.isMeshBasicMaterial) return;
      const mat = node.material;
      if (mat.userData.baseColorHex === undefined) {
        mat.userData.baseColorHex = mat.color.getHex();
      }
      node.getWorldPosition(tmp);
      this._unlitMeshes.push({
        group,
        object: node,
        material: mat,
        localY: tmp.y - groupY,
      });
    });
  }

  _trackBlinkers(root, blinkSpec) {
    if (!blinkSpec) return;
    root.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      this._blinkers.push({
        material: node.material,
        baseIntensity: node.material.emissiveIntensity ?? 1,
        blink: blinkSpec,
        phase: Math.random() * Math.PI * 2,
      });
    });
  }

  _attachLights(group, lightSpecs) {
    if (!lightSpecs?.length) return;
    for (const spec of lightSpecs) {
      const color = new THREE.Color().setHex(spec.color ?? 0xffffff);
      const light = new THREE.PointLight(color, 0);
      light.position.set(...(spec.position ?? [0, 0, 0]));
      light.distance = spec.distance ?? 3.5;
      light.castShadow = spec.castShadow ?? false;
      if (light.castShadow) {
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = light.distance;
        light.shadow.bias = 0;
        light.shadow.radius = 4;
      }
      let mesh = null;
      let baseEmissive = 0;
      let baseColor = null;
      if (spec.shape) {
        mesh = this._createPrimitive(spec);
        baseColor = new THREE.Color().setHex(
          spec.emissive ?? spec.color ?? 0xffffff,
        );
        baseEmissive = spec.emissiveIntensity ?? 1;
        mesh.material = createBulbMaterial({
          color: baseColor.getHex(),
          intensity: baseEmissive,
          fresnelPower: spec.fresnelPower,
          fresnelStrength: spec.fresnelStrength,
          highlightPower: spec.highlightPower,
          highlightStrength: spec.highlightStrength,
        });
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        light.add(mesh);
      }
      group.add(light);
      this._lights.push({
        object: light,
        group,
        localY: light.position.y,
        power: spec.power ?? 15,
        mesh,
        baseEmissive,
        baseColor,
        behavior: spec.behavior ?? null,
        behaviorState: { phase: Math.random() * Math.PI * 2 },
        wantsShadow: light.castShadow,
      });
    }
  }

  _behaviorLevel(behavior, state, t) {
    if (!behavior) return 1;
    const min = behavior.min ?? 0;
    const max = behavior.max ?? 1;
    const rate = behavior.rate ?? 1;
    if (behavior.type === "pulse") {
      const offset =
        behavior.delay !== undefined
          ? -behavior.delay * rate * Math.PI * 2
          : state.phase;
      const ph = t * rate * Math.PI * 2 + offset;
      return min + (max - min) * (0.5 + 0.5 * Math.sin(ph));
    }
    if (behavior.type === "blink") {
      const offset =
        behavior.delay !== undefined
          ? -behavior.delay * rate
          : state.phase / (Math.PI * 2);
      const cycle = ((t * rate + offset) % 1 + 1) % 1;
      const duty = behavior.duty ?? 0.5;
      return cycle < duty ? max : min;
    }
    if (behavior.type === "flicker") {
      const period = 1 / rate;
      if (state.lastT === undefined || t - state.lastT >= period) {
        state.lastT = t;
        state.from = state.to ?? max;
        state.to = min + Math.random() * (max - min);
      }
      const smooth = Math.max(0, Math.min(1, behavior.smooth ?? 1));
      if (smooth === 0) return state.to;
      const alpha = Math.min(1, (t - state.lastT) / (period * smooth));
      return state.from + (state.to - state.from) * alpha;
    }
    return 1;
  }

  update() {
    const t = (performance.now() - this._startTime) / 1000;
    for (const light of this._lights) {
      const worldY = light.group.position.y + light.localY;
      const fade = Math.abs(worldY - this.lightFocusY) * this.lightFalloff;
      const baseIntensity = Math.max(light.power - fade, 0);
      const shouldCast = light.wantsShadow && baseIntensity > 0;
      if (light.object.castShadow !== shouldCast) {
        light.object.castShadow = shouldCast;
      }
      const level = this._behaviorLevel(light.behavior, light.behaviorState, t);
      light.object.intensity = baseIntensity * level;
      if (light.mesh) {
        const ratio = light.power > 0 ? baseIntensity / light.power : 0;
        light.mesh.material.uniforms.uIntensity.value =
          light.baseEmissive * ratio * level;
      }
    }
    for (const b of this._blinkers) {
      const rate = b.blink.rate ?? 1;
      const min = b.blink.min ?? 0;
      const max = b.blink.max ?? b.baseIntensity;
      const phase = (t * rate * Math.PI * 2 + b.phase) % (Math.PI * 2);
      let level;
      if (b.blink.smooth) {
        level = 0.5 + 0.5 * Math.sin(phase);
      } else {
        const duty = b.blink.duty ?? 0.5;
        level = phase / (Math.PI * 2) < duty ? 1 : 0;
      }
      b.material.emissiveIntensity = min + (max - min) * level;
    }
    for (const mat of this._waterMaterials) {
      mat.uniforms.uTime.value = t;
    }
    for (const v of this._videos) {
      const worldY = v.group.position.y;
      const inFocus =
        Math.abs(worldY - this.videoFocusY) <= this.videoActiveRange;
      if (this._docHidden || !inFocus) v.entry.pause();
      else v.entry.play();
    }
    for (const u of this._unlitMeshes) {
      const worldY = u.group.position.y + u.localY;
      const fade = Math.abs(worldY - this.unlitFocusY) * this.unlitFalloff;
      const brightness = Math.max(1 - fade, 0);
      u.material.color
        .setHex(u.material.userData.baseColorHex)
        .multiplyScalar(brightness);
    }
  }

  async _loadGltf(url) {
    try {
      return await this._loader.loadAsync(url);
    } catch (cause) {
      throw new Error(`Failed to load GLB: ${url}`, { cause });
    }
  }

  _applyShadows(root, { castShadow, receiveShadow } = {}) {
    if (castShadow === undefined && receiveShadow === undefined) return;
    root.traverse((node) => {
      if (!node.isMesh) return;
      if (castShadow !== undefined) node.castShadow = castShadow;
      if (receiveShadow !== undefined) node.receiveShadow = receiveShadow;
    });
  }

  addBlock(object, height, focusY) {
    this.add(object);
    this.blocks.push({ object, height, focusY: focusY ?? -height / 2 });
    this._layout();
    return this;
  }

  async loadBlocks(specs) {
    if (!this._loader) this._loader = new GLTFLoader();
    if (!this._textureLoader) this._textureLoader = new THREE.TextureLoader();

    const loaded = await Promise.all(
      specs.map(async (spec) => {
        const components = spec.components ?? [];
        const [blockGltf, blockMaps, componentGltfs, componentMaps] =
          await Promise.all([
            this._loadGltf(spec.url),
            loadMaps(this._textureLoader, spec),
            Promise.all(
              components.map((c) => (c.shape ? null : this._loadGltf(c.url))),
            ),
            Promise.all(components.map((c) => loadMaps(this._textureLoader, c))),
          ]);

        const root = blockGltf.scene;
        applyMaterial(root, {
          type: spec.type,
          color: spec.color,
          roughness: spec.roughness,
          metalness: spec.metalness,
          ...blockMaps,
        });
        this._applyShadows(root, {
          castShadow: spec.castShadow,
          receiveShadow: spec.receiveShadow,
        });
        root.updateMatrixWorld(true);
        const bbox = new THREE.Box3().setFromObject(root, true);
        const height = bbox.max.y - bbox.min.y;
        root.position.y -= bbox.max.y;
        const group = new THREE.Group();
        group.add(root);
        const componentRoots = [];

        componentGltfs.forEach((gltf, i) => {
          const comp = components[i];
          const compRoot = gltf ? gltf.scene : this._createPrimitive(comp);
          applyMaterial(compRoot, {
            type: comp.type,
            color: comp.color,
            roughness: comp.roughness,
            metalness: comp.metalness,
            emissive: comp.emissive,
            emissiveIntensity: comp.emissiveIntensity,
            ...componentMaps[i],
          });
          this._applyShadows(compRoot, {
            castShadow: comp.castShadow,
            receiveShadow: comp.receiveShadow,
          });
          if (comp.position) compRoot.position.set(...comp.position);
          if (comp.rotation) compRoot.rotation.set(...comp.rotation);
          this._trackBlinkers(compRoot, comp.blink);
          group.add(compRoot);
          componentRoots.push(compRoot);
        });

        group.updateMatrixWorld(true);
        const focusBox = new THREE.Box3();
        focusBox.expandByObject(root, true);
        for (const cr of componentRoots) focusBox.expandByObject(cr, true);
        const focusY = focusBox.isEmpty()
          ? -height / 2
          : (focusBox.min.y + focusBox.max.y) / 2;

        this._attachPlanes(group, spec.planes);
        this._attachLights(group, spec.lights);

        this._trackVideo(group, blockMaps.video);
        componentMaps.forEach((m) => this._trackVideo(group, m.video));

        this._trackWaterMaterials(group);
        this._trackUnlitMeshes(group, group);

        return { group, height, focusY };
      }),
    );
    for (const { group, height, focusY } of loaded) {
      this.addBlock(group, height, focusY);
    }
    return this;
  }

  scroll(delta) {
    this.scrollPos += delta;

    if (this.shifting) {
      this.shifting = false;
      this._layout();
      return;
    }

    const topY = this.origin + this.scrollPos;
    if (topY < 0) {
      const moved = this.blocks.pop();
      this.origin += moved.height;
      this.blocks.unshift(moved);
      this.shifting = true;
    } else if (topY > this.blocks[0].height) {
      const moved = this.blocks.shift();
      this.origin -= moved.height;
      this.blocks.push(moved);
      this.shifting = true;
    }

    this._layout();
  }

  _layout() {
    let y = this.origin + this.scrollPos;
    for (const block of this.blocks) {
      block.object.position.y = y;
      y -= block.height;
    }
  }
}
